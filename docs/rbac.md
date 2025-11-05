# Role-Based Access Control (RBAC) Implementation

This document describes the RBAC implementation for the Robotics Management System using Better Auth and Convex.

## Overview

The system uses a two-tier role system:

1. **Team-scoped roles**: Roles within specific teams (TEAM_MENTOR, TEAM_LEADER, TEAM_MEMBER, COMMON)
2. **Organization-level roles**: Global admin/official roles (ADMIN, TOURNAMENT_SCORING_OFFICER, HEAD_REFEREE, SCORE_KEEPER, QUEUE_MANAGER)

## Architecture

### Better Auth Integration

Better Auth's organization plugin is configured to map to our team system:

- **Organization → Teams**: Better Auth "organizations" map to our `teams` table
- **Members → Team Members**: Organization members map to `team_members` table
- **Invitations → Team Invitations**: Organization invitations map to `team_invitations` table

Configuration in `src/convex/auth.ts`:

```typescript
organization({
  ac,
  roles: {
    TEAM_MENTOR,
    TEAM_LEADER,
    TEAM_MEMBER,
    COMMON
  },
  teams: { enabled: false }, // We use teams as top-level org
  schema: {
    organization: {
      modelName: 'teams',
      fields: { name: 'team_name', slug: 'team_number', createdAt: 'created_at' }
    },
    member: {
      modelName: 'team_members',
      fields: {
        organizationId: 'team_id',
        userId: 'user_id',
        role: 'role',
        createdAt: 'joined_at'
      }
    },
    invitation: {
      modelName: 'team_invitations',
      fields: {
        organizationId: 'team_id',
        inviterId: 'invited_by_user_id',
        invitedUserId: 'invited_user_id',
        role: 'invited_role',
        status: 'status',
        expiresAt: 'expires_at'
      }
    }
  }
})
```

### Database Tables

#### Core Tables

1. **users**: Application users (linked to Better Auth via `authId`)
2. **user_roles**: General user roles
3. **org_user_roles**: Organization-level admin/official roles
4. **role_permissions**: Maps roles to specific permissions (source of truth)

#### Team Tables

5. **teams**: Team organizations
6. **team_members**: Team membership with roles
7. **team_invitations**: Invitations to join teams

## Roles

### Team Roles

| Role | Description | Use Case |
|------|-------------|----------|
| `TEAM_MENTOR` | Team mentor with elevated permissions | Can manage team members, update team info |
| `TEAM_LEADER` | Team leader | Can invite members, participate in tournaments |
| `TEAM_MEMBER` | Regular team member | Can participate, view matches/stages |
| `COMMON` | Common user (default) | Basic viewing permissions |

### Organization Roles

| Role | Description | Use Case |
|------|-------------|----------|
| `ADMIN` | System administrator | Full system access |
| `TOURNAMENT_SCORING_OFFICER` | Tournament official | Manage tournaments, assign referees, finalize scores |
| `HEAD_REFEREE` | Head referee | Manage matches, assign referees |
| `SCORE_KEEPER` | Score keeper | Edit and finalize scores |
| `QUEUE_MANAGER` | Queue manager | Manage match queue |

## Permissions

Permissions follow the format `<resource>.<action>`:

### Team Permissions
- `teams.create`, `teams.update`, `teams.delete`, `teams.view_all`
- `team_members.invite`, `team_members.remove`, `team_members.manage_roles`

### Tournament Permissions
- `tournaments.view`, `tournaments.participate`, `tournaments.join`
- `tournaments.manage_participation`, `tournaments.create`, `tournaments.update`, `tournaments.delete`, `tournaments.manage_all`

### Match Permissions
- `matches.view`, `matches.create`, `matches.update`, `matches.delete`, `matches.manage_all`

### Official Permissions
- `fields.manage`, `stages.view`, `stages.manage`
- `referees.assign`, `scoring_profiles.manage`
- `alliances.manage`, `queue.manage`

### Scoring Permissions
- `scores.edit_draft`, `scores.finalize`
- `penalties.manage`

### System Permissions
- `audience.control`, `users.view_all`, `users.manage_roles`

## Permission Helpers

Located in `src/convex/lib/permissions.ts`:

### `hasPermission(ctx, userId, permission, scope?)`

Check if a user has a specific permission.

```typescript
const canFinalize = await hasPermission(ctx, userId, 'scores.finalize');
```

### `requirePermission(ctx, userId, permission, scope?)`

Require permission (throws error if not granted).

```typescript
await requirePermission(ctx, userId, 'teams.create');
```

### `getUserPermissions(ctx, userId, scope?)`

Get all permissions for a user.

```typescript
const permissions = await getUserPermissions(ctx, userId, { teamId });
```

### `hasAnyRole(ctx, userId, roles, scope?)`

Check if user has any of the specified roles.

```typescript
const isOfficial = await hasAnyRole(ctx, userId, ['HEAD_REFEREE', 'SCORE_KEEPER']);
```

### `isAdmin(ctx, userId)`

Check if user is an admin.

```typescript
const admin = await isAdmin(ctx, userId);
```

### `isTeamMember(ctx, userId, teamId)`

Check if user is a member of a team.

```typescript
const member = await isTeamMember(ctx, userId, teamId);
```

## Usage Examples

### Example 1: Protected Mutation

```typescript
export const createTournament = mutation({
  args: { name: v.string(), code: v.string() },
  returns: v.id('tournaments'),
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    
    // Require permission
    await requirePermission(ctx, user._id, 'tournaments.create');
    
    // User has permission, proceed
    return await ctx.db.insert('tournaments', {
      tournament_name: args.name,
      tournament_code: args.code,
      tournament_owner_id: user._id,
      created_at: Date.now(),
      updated_at: Date.now()
    });
  }
});
```

### Example 2: Team-Scoped Permission

```typescript
export const inviteMember = mutation({
  args: { teamId: v.id('teams'), userId: v.id('users') },
  returns: v.id('team_invitations'),
  handler: async (ctx, args) => {
    const currentUser = await getAppUser(ctx);
    
    // Check permission within team scope
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

### Example 3: Conditional UI

```typescript
export const canEditScore = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await getAppUser(ctx);
    if (!user) return false;
    
    return await hasPermission(ctx, user._id, 'scores.edit_draft');
  }
});
```

## User Lifecycle

### 1. First Login

When a user first logs in:

1. Client calls `syncUser` mutation after auth
2. Creates app user in `users` table
3. Auto-assigns `COMMON` role in `user_roles` table
4. Sets `userType` to `REGULAR`

```typescript
// Client-side after auth
const result = await client.mutation(api.users.syncUser, {});
```

### 2. Joining a Team

When a user joins a team:

1. Invitation created with `team_invitations`
2. User accepts invitation
3. Record created in `team_members` with assigned role
4. User gains team-scoped permissions

### 3. Becoming an Official

To grant organization-level roles:

1. Admin creates record in `org_user_roles`
2. User immediately gains associated permissions
3. Permissions are global (not team-scoped)

## Permission Resolution

When checking permissions, the system:

1. **Collects roles**:
   - Team roles (if `teamId` in scope)
   - General user roles from `user_roles`
   - Org roles from `org_user_roles`

2. **Queries permissions**:
   - Fetches permissions from `role_permissions` table
   - Matches by `role` field (team roles) or `org_role` field (org roles)

3. **Merges permissions**:
   - Combines all granted permissions
   - Returns true if permission is granted by any role

## Best Practices

### 1. Always Authenticate First

```typescript
const betterAuthUser = await authComponent.getAuthUser(ctx);
if (!betterAuthUser) {
  throw new Error('Not authenticated');
}

const appUser = await getAppUserFromAuth(ctx, betterAuthUser);
```

### 2. Use `requirePermission` for Mutations

```typescript
// Good
await requirePermission(ctx, userId, 'matches.create');

// Bad - missing permission check
// Directly creating match without authorization
```

### 3. Use `hasPermission` for Queries/UI

```typescript
// Check permission without throwing error
const canEdit = await hasPermission(ctx, userId, 'teams.update', { teamId });
```

### 4. Scope Permissions When Relevant

```typescript
// Team-scoped
await requirePermission(ctx, userId, 'team_members.invite', { teamId });

// Global
await requirePermission(ctx, userId, 'tournaments.create');
```

### 5. Seed Default Permissions

Create seed data in `role_permissions` table for each role:

```typescript
// Example seed for TEAM_LEADER
await ctx.db.insert('role_permissions', {
  role: 'TEAM_LEADER',
  permission: 'team_members.invite',
  created_at: Date.now()
});

// Example seed for ADMIN
await ctx.db.insert('role_permissions', {
  org_role: 'ADMIN',
  permission: 'users.manage_roles',
  created_at: Date.now()
});
```

## Security Considerations

1. **Client-Side Checks**: Use permission checks to show/hide UI, but always enforce on the server
2. **Server-Side Enforcement**: Always use `requirePermission` in mutations
3. **Scope Validation**: Verify team/tournament IDs exist before checking scoped permissions
4. **Inactive Members**: System filters for `is_active: true` in team memberships
5. **Token Security**: Invitation tokens should be cryptographically random (use `crypto.randomUUID()`)

## Migration Path

If you need to add new permissions or roles:

1. Add permission to Permission type in `permissions.ts`
2. Add to schema `role_permissions` union
3. Create seed records in `role_permissions` table
4. Use in your functions with `requirePermission` or `hasPermission`

## Testing Permissions

Create test users with different roles and verify:

```typescript
// Test admin access
const admin = await createUser({ role: 'ADMIN' });
assert(await isAdmin(ctx, admin._id));

// Test team permissions
const leader = await createUser({});
await addTeamMember(teamId, leader._id, 'TEAM_LEADER');
assert(await hasPermission(ctx, leader._id, 'team_members.invite', { teamId }));
```

## References

- [Better Auth Organization Plugin](https://www.better-auth.com/docs/plugins/organization)
- [Better Auth Access Control](https://www.better-auth.com/docs/plugins/access)
- [Convex Auth Documentation](https://docs.convex.dev/auth)
