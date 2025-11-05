# RBAC Quick Start Guide

## Overview

Role-Based Access Control (RBAC) is now configured with Better Auth and Convex. This guide shows you how to use it.

## Quick Setup

### 1. User Authentication & Sync

After a user signs in, sync them to the app database:

```typescript
// Client-side (after successful auth)
import { useConvexClient } from 'convex-svelte';
import { api } from '../convex/_generated/api';

const client = useConvexClient();

async function handleSignIn() {
  // After Better Auth sign-in succeeds...
  const result = await client.mutation(api.users.syncUser, {});
  
  if (result.isNewUser) {
    console.log('New user created with COMMON role');
  }
}
```

### 2. Protect Mutations

```typescript
import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { requirePermission } from './lib/permissions';
import { authComponent } from './auth';

export const createTournament = mutation({
  args: {
    name: v.string(),
    code: v.string()
  },
  returns: v.id('tournaments'),
  handler: async (ctx, args) => {
    // 1. Get authenticated user
    const betterAuthUser = await authComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error('Not authenticated');
    }
    
    // 2. Get app user
    const appUser = await ctx.db
      .query('users')
      .withIndex('authId', (q) => q.eq('authId', betterAuthUser.userId || betterAuthUser._id))
      .unique();
    
    if (!appUser) {
      throw new Error('User not found');
    }
    
    // 3. Check permission
    await requirePermission(ctx, appUser._id, 'tournaments.create');
    
    // 4. Proceed with mutation
    const now = Date.now();
    return await ctx.db.insert('tournaments', {
      tournament_name: args.name,
      tournament_code: args.code,
      tournament_owner_id: appUser._id,
      tournament_alliance_team_limit: 2,
      created_at: now,
      updated_at: now
    });
  }
});
```

### 3. Check Permissions in UI

```typescript
import { query } from './_generated/server';
import { v } from 'convex/values';
import { hasPermission } from './lib/permissions';
import { authComponent } from './auth';

export const canCreateTournament = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    try {
      const betterAuthUser = await authComponent.getAuthUser(ctx);
      if (!betterAuthUser) return false;
      
      const appUser = await ctx.db
        .query('users')
        .withIndex('authId', (q) => q.eq('authId', betterAuthUser.userId || betterAuthUser._id))
        .unique();
      
      if (!appUser) return false;
      
      return await hasPermission(ctx, appUser._id, 'tournaments.create');
    } catch {
      return false;
    }
  }
});
```

Then in your Svelte component:

```svelte
<script lang="ts">
  import { useQuery } from 'convex-svelte';
  import { api } from '../convex/_generated/api';
  
  let canCreate = $derived(useQuery(api.yourModule.canCreateTournament, () => ({})));
</script>

{#if canCreate.data}
  <button on:click={createTournament}>Create Tournament</button>
{/if}
```

## Common Patterns

### Pattern 1: Helper to Get App User

```typescript
// lib/auth.ts
import { authComponent } from '../auth';
import type { QueryCtx, MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';

export async function getAppUser(ctx: QueryCtx | MutationCtx): Promise<{
  _id: Id<'users'>;
  authId: string;
  email: string;
  // ... other fields
} | null> {
  const betterAuthUser = await authComponent.getAuthUser(ctx);
  if (!betterAuthUser) return null;
  
  return await ctx.db
    .query('users')
    .withIndex('authId', (q) => q.eq('authId', betterAuthUser.userId || betterAuthUser._id))
    .unique();
}

export async function requireAppUser(ctx: QueryCtx | MutationCtx) {
  const user = await getAppUser(ctx);
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
}
```

Then use in your functions:

```typescript
import { requireAppUser } from './lib/auth';
import { requirePermission } from './lib/permissions';

export const someFunction = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const user = await requireAppUser(ctx);
    await requirePermission(ctx, user._id, 'some.permission');
    // ...
  }
});
```

### Pattern 2: Team-Scoped Permissions

```typescript
export const inviteToTeam = mutation({
  args: {
    teamId: v.id('teams'),
    userId: v.id('users'),
    role: v.string()
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAppUser(ctx);
    
    // Permission scoped to specific team
    await requirePermission(
      ctx,
      currentUser._id,
      'team_members.invite',
      { teamId: args.teamId }
    );
    
    // Create invitation...
  }
});
```

### Pattern 3: Admin-Only Functions

```typescript
import { isAdmin } from './lib/permissions';

export const deleteUser = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const currentUser = await requireAppUser(ctx);
    
    if (!await isAdmin(ctx, currentUser._id)) {
      throw new Error('Admin access required');
    }
    
    // Soft delete
    await ctx.db.patch(args.userId, {
      isActive: false,
      updatedAt: Date.now()
    });
  }
});
```

## Assigning Roles

### Team Roles

Team roles are assigned through `team_members`:

```typescript
export const addTeamMember = mutation({
  args: {
    teamId: v.id('teams'),
    userId: v.id('users'),
    role: v.union(
      v.literal('TEAM_MENTOR'),
      v.literal('TEAM_LEADER'),
      v.literal('TEAM_MEMBER')
    )
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAppUser(ctx);
    await requirePermission(ctx, currentUser._id, 'team_members.invite', { teamId: args.teamId });
    
    const now = Date.now();
    await ctx.db.insert('team_members', {
      team_id: args.teamId,
      user_id: args.userId,
      role: args.role,
      is_active: true,
      joined_at: now,
      created_at: now,
      updated_at: now
    });
  }
});
```

### Org Roles (Admin Only)

```typescript
export const assignOrgRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.union(
      v.literal('ADMIN'),
      v.literal('TOURNAMENT_SCORING_OFFICER'),
      v.literal('HEAD_REFEREE'),
      v.literal('SCORE_KEEPER'),
      v.literal('QUEUE_MANAGER')
    )
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAppUser(ctx);
    
    // Only admins can assign org roles
    if (!await isAdmin(ctx, currentUser._id)) {
      throw new Error('Admin access required');
    }
    
    await ctx.db.insert('org_user_roles', {
      org_user_id: args.userId,
      org_role: args.role,
      created_at: Date.now()
    });
  }
});
```

## Seeding Permissions

You need to populate the `role_permissions` table with permission mappings. Create a seed script:

```typescript
// convex/seed.ts
import { internalMutation } from './_generated/server';

export const seedPermissions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // ADMIN has all permissions
    const adminPermissions = [
      'teams.create', 'teams.update', 'teams.delete', 'teams.view_all',
      'tournaments.create', 'tournaments.manage_all',
      'users.view_all', 'users.manage_roles',
      // ... all other permissions
    ];
    
    for (const permission of adminPermissions) {
      await ctx.db.insert('role_permissions', {
        org_role: 'ADMIN',
        permission: permission as any,
        created_at: now
      });
    }
    
    // TEAM_LEADER permissions
    const teamLeaderPerms = [
      'team_members.invite',
      'teams.update',
      'tournaments.participate'
    ];
    
    for (const permission of teamLeaderPerms) {
      await ctx.db.insert('role_permissions', {
        role: 'TEAM_LEADER',
        permission: permission as any,
        created_at: now
      });
    }
    
    // Add more role-permission mappings...
  }
});
```

Run once to seed:
```bash
npx convex run seed:seedPermissions
```

## Available Permissions

See [rbac.md](./rbac.md#permissions) for the complete list of permissions.

## Common Issues

### Issue: "User not found" after sign-in

**Solution**: Call `syncUser` mutation after authentication:

```typescript
await client.mutation(api.users.syncUser, {});
```

### Issue: Permission denied but user should have access

**Solution**: Check `role_permissions` table has the mapping:

```typescript
// Check what permissions a user has
const permissions = await client.query(api.users.getMyPermissions, { teamId });
console.log('User permissions:', permissions);
```

### Issue: Team permission not working

**Solution**: Ensure you're passing the `teamId` in the scope:

```typescript
// Correct
await requirePermission(ctx, userId, 'team_members.invite', { teamId });

// Wrong - missing scope
await requirePermission(ctx, userId, 'team_members.invite');
```

## Next Steps

- Read [rbac.md](./rbac.md) for full documentation
- See [permissions.example.ts](../src/convex/lib/permissions.example.ts) for more examples
- Configure role permissions in your database
- Implement permission checks in all mutations

## Helper Reference

| Function | Purpose |
|----------|---------|
| `hasPermission(ctx, userId, permission, scope?)` | Check if user has permission (non-throwing) |
| `requirePermission(ctx, userId, permission, scope?)` | Require permission (throws if denied) |
| `getUserPermissions(ctx, userId, scope?)` | Get all user permissions |
| `isAdmin(ctx, userId)` | Check if user is admin |
| `isTeamMember(ctx, userId, teamId)` | Check if user is team member |
| `hasAnyRole(ctx, userId, roles, scope?)` | Check if user has any of specified roles |
