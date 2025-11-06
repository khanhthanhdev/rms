# Role-Based Access Control (RBAC) Analysis

## Overview

This document provides a comprehensive analysis of how the RMS (Restaurant Management System) implements role-based access control to protect routes and restrict access based on user roles. The system uses a multi-layered approach combining SvelteKit server-side route protection, Better Auth for authentication, and Convex for backend permission checks.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [User Roles](#user-roles)
3. [Route Protection Mechanisms](#route-protection-mechanisms)
4. [Admin Route Protection](#admin-route-protection)
5. [Permission System](#permission-system)
6. [Code Examples](#code-examples)

---

## Architecture Overview

The RBAC system consists of three main layers:

1. **Authentication Layer** (`hooks.server.ts`)
   - Extracts authentication tokens from cookies
   - Makes tokens available to all server-side code via `locals.token`

2. **Route Protection Layer** (SvelteKit `+layout.server.ts` files)
   - Server-side route guards that run before page loads
   - Check user roles and permissions
   - Redirect unauthorized users

3. **Backend Permission Layer** (Convex functions)
   - Fine-grained permission checks
   - Resource-based access control
   - Team and tournament scoping

---

## User Roles

### Application Roles (AppRole)

Defined in `src/convex/auth.ts`, lines 18-28:

```typescript
export const APP_ROLE_VALUES = [
	'ADMIN',           // Global admin with full access
	'TSO',             // Tournament Scoring Officer
	'HEAD_REFEREE',    // Head Referee
	'SCORE_KEEPER',    // Score Keeper
	'QUEUER',          // Queue Manager
	'TEAM_MENTOR',     // Team Mentor
	'TEAM_LEADER',     // Team Leader
	'TEAM_MEMBER',     // Team Member
	'COMMON'           // Default role for basic users
] as const;
```

### Role Hierarchy

1. **ADMIN** - Highest level, full system access
   - Can access all admin routes (`/admin/*`)
   - Can manage all users, teams, and tournaments
   - Has all permissions across the system

2. **TSO (Tournament Scoring Officer)** - Tournament-level admin
   - Can manage tournaments, matches, fields, stages
   - Can assign referees, manage scoring, queue
   - Cannot access user management

3. **HEAD_REFEREE** - Match and scoring management
   - Can manage matches and assign referees
   - Can edit and finalize scores
   - Cannot create tournaments

4. **SCORE_KEEPER** - Scoring-only access
   - Can view matches and edit scores
   - Cannot manage other aspects

5. **QUEUER** - Queue management only
   - Can manage queue
   - Can view tournaments and matches

6. **TEAM_MENTOR** - Team-level management
   - Can create and update teams
   - Can manage team members and roles
   - Can participate in tournaments

7. **TEAM_LEADER** - Team coordination
   - Can update team info
   - Can invite team members
   - Can manage tournament participation

8. **TEAM_MEMBER** - Basic team member
   - Can participate in tournaments
   - Can view team and tournament info

9. **COMMON** - Default role
   - Can view public tournament info
   - Can create teams
   - Baseline permissions

---

## Route Protection Mechanisms

### 1. Global Authentication Hook

**File:** `src/hooks.server.ts`

```typescript
export const handle: Handle = async ({ event, resolve }) => {
	if (SITE_URL && !process.env.SITE_URL) {
		process.env.SITE_URL = SITE_URL;
	}

	// Extract auth token from cookies and make available to all routes
	event.locals.token = await getToken(createAuth, event.cookies);

	return resolve(event);
};
```

**Purpose:** 
- Runs on every request
- Extracts authentication token from cookies
- Makes token available via `event.locals.token` for all server-side code

### 2. Route-Level Protection

SvelteKit uses a file-based routing system. Route protection is implemented using `+layout.server.ts` files that apply to all routes in their directory and subdirectories.

---

## Admin Route Protection

### Implementation Details

**File:** `src/routes/(app)/admin/+layout.server.ts`

This is the **critical file** that protects all admin routes including `/admin/users`.

#### Step-by-Step Flow

1. **Create Convex HTTP Client** (lines 36-52)
   ```typescript
   const client = createConvexHttpClient({ cookies, convexUrl });
   
   if (typeof locals.token === 'string' && locals.token.length > 0) {
       client.setAuth(locals.token);
   }
   ```
   - Creates authenticated client with user's token
   - This client can make authenticated queries to Convex backend

2. **Fetch Current User** (lines 58-64)
   ```typescript
   const user = await client.query(api.auth.getCurrentUser, {});
   
   if (!user) {
       throw error(401, 'Unauthorized');
   }
   ```
   - Queries Convex to get current user info
   - If no user is authenticated, throws 401 error

3. **Extract and Normalize Roles** (lines 66-76)
   ```typescript
   const orgRolesRaw = Array.isArray((user as { orgRoles?: unknown }).orgRoles)
       ? ((user as { orgRoles?: unknown[] }).orgRoles ?? [])
       : [];
   
   const orgRoles = orgRolesRaw
       .map((role) => normalizeRole(role))
       .filter((role): role is string => role !== null);
   
   const appRole = normalizeRole((user as { appRole?: unknown }).appRole);
   const betterAuthRole = normalizeRole((user as { role?: unknown }).role);
   ```
   - Extracts roles from multiple sources:
     - `orgRoles`: Organization/team-level roles
     - `appRole`: Application-level role (custom field)
     - `role`: Better Auth's built-in role field

4. **Check ADMIN Role** (lines 77-81)
   ```typescript
   const isAdmin = orgRoles.includes('ADMIN') || 
                   appRole === 'ADMIN' || 
                   betterAuthRole === 'ADMIN';
   
   if (!isAdmin) {
       throw error(403, 'Forbidden: Admin access required');
   }
   ```
   - Checks if user has ADMIN role in any of the three sources
   - If not an admin, throws 403 Forbidden error
   - **This is the key check that protects admin routes**

5. **Role Normalization** (lines 12-33)
   ```typescript
   const normalizeRole = (value: unknown): string | null => {
       if (typeof value !== 'string') {
           return null;
       }
       
       const trimmed = value.trim();
       if (!trimmed) {
           return null;
       }
       
       const normalized = trimmed.replace(/-/g, '_').toUpperCase();
       
       switch (normalized) {
           case 'ADMIN':
           case 'ADMINISTRATOR':
           case 'SUPER_ADMIN':
           case 'SUPERADMIN':
               return 'ADMIN';
           default:
               return normalized;
       }
   };
   ```
   - Normalizes role strings to consistent format
   - Handles variations like "admin", "ADMINISTRATOR", "super-admin"
   - All convert to canonical "ADMIN"

6. **Return User Data** (lines 83-90)
   ```typescript
   return {
       user: {
           ...user,
           appRole: appRole ?? (user as { appRole?: unknown }).appRole ?? null,
           orgRoles,
           isAdmin: true
       }
   };
   ```
   - Makes user data available to all admin pages
   - Includes normalized roles and `isAdmin` flag

### Protected Routes

All routes under `/admin/*` are protected by this layout:
- `/admin/users` - User management page
- Any future admin pages added to the `/admin` directory

### Error Handling

The system returns different HTTP errors for different scenarios:

- **401 Unauthorized**: User is not authenticated (no valid session)
- **403 Forbidden**: User is authenticated but lacks ADMIN role
- **500 Internal Server Error**: System error during role check

---

## Permission System

### Fine-Grained Permissions

**File:** `src/convex/lib/permissions.ts`

Beyond simple role checks, the system implements a comprehensive permission system for granular access control.

#### Resource-Based Permissions

Defined in `auth.ts`, lines 69-94:

```typescript
export const statement = {
	...defaultStatements,
	teams: ['create', 'update', 'delete', 'view_all'],
	team_members: ['invite', 'remove', 'manage_roles'],
	tournaments: [
		'view',
		'participate',
		'join',
		'manage_participation',
		'create',
		'update',
		'delete',
		'manage_all'
	],
	matches: ['view', 'create', 'update', 'delete', 'manage_all'],
	fields: ['manage'],
	stages: ['view', 'manage'],
	referees: ['assign'],
	scoring_profiles: ['manage'],
	alliances: ['manage'],
	queue: ['manage'],
	scores: ['edit_draft', 'finalize'],
	penalties: ['manage'],
	audience: ['control'],
	users: ['view_all', 'manage_roles']
} as const;
```

#### Permission Check Functions

**File:** `src/convex/lib/permissions.ts`

1. **hasPermission** (lines 267-295)
   ```typescript
   export async function hasPermission(
       ctx: QueryCtx | MutationCtx,
       userId: Id<'users'>,
       permission: Permission,
       scope?: PermissionScope
   ): Promise<boolean>
   ```
   - Checks if user has a specific permission
   - Supports team/tournament scoping
   - Example: `hasPermission(ctx, userId, 'tournaments.create')`

2. **requirePermission** (lines 307-318)
   ```typescript
   export async function requirePermission(
       ctx: QueryCtx | MutationCtx,
       userId: Id<'users'>,
       permission: Permission,
       scope?: PermissionScope
   ): Promise<void>
   ```
   - Requires user to have permission, throws error if not
   - Used to protect Convex mutations and queries

3. **isAdmin** (lines 347-349)
   ```typescript
   export async function isAdmin(
       ctx: QueryCtx | MutationCtx, 
       userId: Id<'users'>
   ): Promise<boolean>
   ```
   - Simple helper to check if user has ADMIN role
   - Used for quick admin checks in backend code

4. **hasAnyRole** (lines 329-338)
   ```typescript
   export async function hasAnyRole(
       ctx: QueryCtx | MutationCtx,
       userId: Id<'users'>,
       roles: Array<TeamRole | OrgRole>,
       scope?: PermissionScope
   ): Promise<boolean>
   ```
   - Checks if user has any of specified roles
   - Example: `hasAnyRole(ctx, userId, ['ADMIN', 'TSO'])`

#### Role-to-Permission Mapping

Each role is mapped to a set of permissions:

**ADMIN Role** (lines 107):
```typescript
export const ADMIN = ac.newRole(cloneStatements(statement));
```
- Has ALL permissions from the statement object
- Full access to every resource and action

**TSO Role** (lines 109-129):
```typescript
export const TSO = ac.newRole({
	tournaments: ['view', 'participate', 'join', 'manage_participation', 
	              'create', 'update', 'delete', 'manage_all'],
	matches: ['view', 'create', 'update', 'delete', 'manage_all'],
	fields: ['manage'],
	stages: ['view', 'manage'],
	referees: ['assign'],
	scoring_profiles: ['manage'],
	queue: ['manage'],
	scores: ['edit_draft', 'finalize'],
	penalties: ['manage'],
	audience: ['control']
});
```

**COMMON Role** (lines 191-196):
```typescript
export const COMMON = ac.newRole({
	teams: ['create'],
	tournaments: ['view'],
	matches: ['view'],
	stages: ['view']
});
```
- Minimal permissions for basic users

#### Role Resolution

**Function:** `collectUserRoleNames` in `permissions.ts` (lines 176-256)

The system collects roles from multiple sources:

1. **User's appRole field** from users table
2. **User roles from user_roles table** (dedicated role assignments)
3. **Organization roles from org_user_roles table** (org-level roles)
4. **Better Auth roles** from auth user document (fallback)
5. **Team membership roles** from team_members table (scoped to teams)

This multi-source approach ensures:
- Backward compatibility with Better Auth
- Flexibility in role assignment
- Support for both global and scoped roles

---

## Code Examples

### Example 1: Protecting a Custom Admin Route

To protect a new admin route `/admin/reports`:

```typescript
// src/routes/(app)/admin/reports/+page.svelte
<script lang="ts">
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
	
	// User is guaranteed to be an admin here because
	// the parent +layout.server.ts already verified it
	const user = data.user;
</script>

<h1>Admin Reports</h1>
<p>Welcome, {user.name}! You are an admin.</p>
```

No additional protection needed - the parent `admin/+layout.server.ts` handles it!

### Example 2: Checking Permissions in Convex

```typescript
// src/convex/tournaments.ts
import { mutation } from './_generated/server';
import { requirePermission } from './lib/permissions';

export const createTournament = mutation({
	args: { name: v.string(), /* ... */ },
	handler: async (ctx, args) => {
		// Get current user
		const user = await getCurrentUser(ctx);
		if (!user) {
			throw new Error('Unauthorized');
		}
		
		// Find user in users table
		const appUser = await ctx.db
			.query('users')
			.withIndex('authId', (q) => q.eq('authId', user._id))
			.unique();
		
		if (!appUser) {
			throw new Error('User not found');
		}
		
		// Require 'tournaments.create' permission
		await requirePermission(ctx, appUser._id, 'tournaments.create');
		
		// User has permission, proceed with creating tournament
		const tournamentId = await ctx.db.insert('tournaments', {
			name: args.name,
			// ...
		});
		
		return tournamentId;
	}
});
```

### Example 3: Team-Scoped Permission Check

```typescript
import { hasPermission } from './lib/permissions';

export const updateTeam = mutation({
	args: { teamId: v.id('teams'), /* ... */ },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user) throw new Error('Unauthorized');
		
		const appUser = await ctx.db
			.query('users')
			.withIndex('authId', (q) => q.eq('authId', user._id))
			.unique();
		
		if (!appUser) throw new Error('User not found');
		
		// Check permission within team scope
		const canUpdate = await hasPermission(
			ctx, 
			appUser._id, 
			'teams.update',
			{ teamId: args.teamId }  // Scope to specific team
		);
		
		if (!canUpdate) {
			throw new Error('Forbidden: Cannot update this team');
		}
		
		// Proceed with update
	}
});
```

### Example 4: Admin Check in SvelteKit Server Action

```typescript
// src/routes/(app)/some-page/+page.server.ts
import type { Actions } from './$types';
import { error } from '@sveltejs/kit';
import { createServerConvexClient } from '$lib/server/create-convex-client';
import { api } from '$convex/_generated/api.js';

export const actions: Actions = {
	adminAction: async ({ cookies, locals }) => {
		const client = createServerConvexClient({
			cookies,
			token: typeof locals.token === 'string' ? locals.token : null
		});
		
		// Get current user
		const user = await client.query(api.auth.getCurrentUser, {});
		
		if (!user) {
			throw error(401, 'Unauthorized');
		}
		
		// Check if user is admin
		const appUser = await client.query(api.users.getByAuthId, { 
			authId: user._id 
		});
		
		const isAdmin = await client.query(api.lib.permissions.isAdmin, {
			userId: appUser._id
		});
		
		if (!isAdmin) {
			throw error(403, 'Admin access required');
		}
		
		// Proceed with admin action
	}
};
```

---

## Security Considerations

### 1. Server-Side Only

All role checks MUST be performed server-side:
- In `+layout.server.ts` or `+page.server.ts` files
- In Convex queries and mutations
- **Never** rely on client-side role checks for security

### 2. Defense in Depth

The system uses multiple layers of protection:
- Authentication token validation
- Route-level role checks
- Function-level permission checks
- Resource-level access control

### 3. Token Security

- Tokens are stored in HTTP-only cookies
- Tokens are validated on every request
- Token extraction is handled by Better Auth integration

### 4. Role Normalization

- All role strings are normalized to prevent bypass via casing
- Multiple role name variations map to canonical names
- Example: "admin", "ADMIN", "Administrator" all become "ADMIN"

### 5. Fail-Safe Defaults

- If role cannot be determined, defaults to 'COMMON' (least privilege)
- Missing user returns 401 Unauthorized
- Missing permissions throws errors rather than silently failing

---

## Testing Role Protection

To test the admin route protection:

1. **As non-admin user:**
   - Navigate to `/admin/users`
   - Should receive 403 Forbidden error
   - Should not see admin pages

2. **As admin user:**
   - Navigate to `/admin/users`
   - Should see the user management interface
   - Should be able to perform admin actions

3. **Without authentication:**
   - Navigate to `/admin/users`
   - Should receive 401 Unauthorized
   - Should be redirected to sign-in

---

## Summary

The RMS implements a robust, multi-layered RBAC system:

1. **Authentication** via Better Auth and Convex
2. **Route Protection** via SvelteKit server-side layouts
3. **Permission System** with fine-grained resource-based access control
4. **Admin Routes** protected by checking for ADMIN role in `+layout.server.ts`

The `/admin/users` route is protected by:
- The `src/routes/(app)/admin/+layout.server.ts` file
- Which checks for ADMIN role in orgRoles, appRole, or Better Auth role
- Returning 403 Forbidden if user lacks ADMIN role
- Making admin status available to all child routes

This architecture ensures that only authenticated users with the ADMIN role can access admin routes, while supporting flexible permission checks throughout the application.
