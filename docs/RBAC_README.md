# RBAC Documentation Summary

This directory contains comprehensive documentation on the Role-Based Access Control (RBAC) system implemented in the RMS (Restaurant Management System).

## Documentation Files

### 1. RBAC_ANALYSIS.md
**Primary technical documentation** covering:
- Complete architecture overview of the 3-layer RBAC system
- Detailed explanation of all user roles (ADMIN, TSO, HEAD_REFEREE, etc.)
- Step-by-step breakdown of how admin routes are protected
- Permission system documentation with code examples
- Security considerations and best practices
- Testing guidelines

**Key sections:**
- User Roles (9 different roles from ADMIN to COMMON)
- Route Protection Mechanisms (hooks.server.ts and layout guards)
- Admin Route Protection (detailed analysis of `/admin/users` protection)
- Permission System (fine-grained resource-based access control)
- Code Examples (practical implementation patterns)

### 2. RBAC_FLOW_DIAGRAM.md
**Visual documentation** featuring:
- Admin Route Access Flow (complete request-to-response flow)
- Role Resolution Flow (how roles are collected from multiple sources)
- Permission Check Flow (permission evaluation process)
- Data Flow diagrams (authentication to route access)
- Role Hierarchy visualization
- Multi-Source Role Collection diagram

**Purpose:** 
Provides visual representations to quickly understand complex flows without reading through code.

## Quick Start

### Understanding Admin Route Protection

The `/admin/users` route (and all `/admin/*` routes) are protected by:

**File:** `src/routes/(app)/admin/+layout.server.ts`

**Protection Logic:**
1. Extracts auth token from cookies via `hooks.server.ts`
2. Creates authenticated Convex client
3. Fetches current user from Convex backend
4. Collects roles from multiple sources:
   - `orgRoles` (organization/team-level roles)
   - `appRole` (custom application role field)
   - `role` (Better Auth's built-in role)
5. Checks if user has ADMIN role in any source
6. Returns 403 Forbidden if not an admin
7. Returns user data with `isAdmin: true` if authorized

### Key Code Location

```
src/
├── hooks.server.ts                      # Global auth token extraction
├── routes/
│   └── (app)/
│       └── admin/
│           ├── +layout.server.ts        # ⭐ ADMIN ROUTE PROTECTION
│           └── users/
│               └── +page.svelte         # User management page
└── convex/
    ├── auth.ts                          # Role definitions & auth config
    └── lib/
        └── permissions.ts               # Permission checking functions
```

### Role Types

**Global Roles:**
- `ADMIN` - Full system access, can access `/admin/*`
- `TSO` - Tournament Scoring Officer
- `HEAD_REFEREE` - Match and scoring management
- `SCORE_KEEPER` - Scoring-only access
- `QUEUER` - Queue management

**Team-Scoped Roles:**
- `TEAM_MENTOR` - Team administrator
- `TEAM_LEADER` - Team coordinator
- `TEAM_MEMBER` - Basic team member
- `COMMON` - Default role, read-only public access

## How It Works

### Multi-Layer Security

```
┌─────────────────────────────────────────┐
│ Layer 1: Authentication                  │
│ (hooks.server.ts)                        │
│ • Validates auth token                   │
│ • Extracts from cookies                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Layer 2: Route Protection                │
│ (+layout.server.ts)                      │
│ • Checks user roles                      │
│ • Enforces route-level access            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Layer 3: Permission Checks               │
│ (Convex functions)                       │
│ • Fine-grained resource permissions      │
│ • Action-level authorization             │
└─────────────────────────────────────────┘
```

### Multi-Source Role Collection

User roles are collected from **5 different sources** to support flexibility and backward compatibility:

1. **users.appRole** - Custom application role field
2. **user_roles table** - Dedicated global role assignments
3. **org_user_roles table** - Organization-level roles (TSO, HEAD_REFEREE, etc.)
4. **Better Auth user.role** - Built-in Better Auth role field
5. **team_members table** - Team membership roles (TEAM_MENTOR, etc.)

This multi-source approach ensures:
- ✅ Backward compatibility with Better Auth
- ✅ Support for both global and scoped roles
- ✅ Flexibility in role assignment
- ✅ Team-specific role management

## Common Use Cases

### 1. Protecting a New Admin Route

Create: `src/routes/(app)/admin/my-feature/+page.svelte`

**No additional code needed!** The parent `admin/+layout.server.ts` automatically protects all routes under `/admin/*`.

### 2. Checking Permissions in Convex

```typescript
import { requirePermission } from './lib/permissions';

export const createTournament = mutation({
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const appUser = await getAppUser(ctx, user._id);
    
    // Require permission
    await requirePermission(ctx, appUser._id, 'tournaments.create');
    
    // Permission granted, proceed...
  }
});
```

### 3. Role-Based UI Rendering

```svelte
<script>
  export let data;
  const isAdmin = data.user?.isAdmin ?? false;
</script>

{#if isAdmin}
  <AdminPanel />
{:else}
  <p>Access denied</p>
{/if}
```

## Security Best Practices

✅ **DO:**
- Always check roles/permissions server-side
- Use the multi-layer approach (auth → route → permission)
- Leverage the permission system for fine-grained control
- Return appropriate HTTP errors (401, 403, 500)

❌ **DON'T:**
- Rely on client-side role checks for security
- Skip server-side validation
- Hard-code role names (use constants from `auth.ts`)
- Bypass the permission system

## Further Reading

- **RBAC_ANALYSIS.md** - Complete technical reference
- **RBAC_FLOW_DIAGRAM.md** - Visual flow diagrams
- **Better Auth Docs** - https://www.better-auth.com/
- **Convex Docs** - https://docs.convex.dev/

## Questions & Troubleshooting

### How do I make a user an admin?

Option 1: Via Better Auth admin API
```typescript
await authClient.admin.setRole({
  userId: 'user_id',
  role: 'admin'
});
```

Option 2: Via Convex database
```typescript
await ctx.db.insert('org_user_roles', {
  user_id: userId,
  role: 'ADMIN'
});
```

### Why use multiple role sources?

- **Flexibility**: Different parts of the system can assign roles
- **Migration**: Supports upgrading from Better Auth roles to custom roles
- **Scoping**: Some roles are global (ADMIN), others are team-scoped (TEAM_MENTOR)
- **Compatibility**: Works with existing Better Auth infrastructure

### What happens if a user has multiple roles?

All roles are collected and merged. The user has the **union** of all permissions from all their roles. For example:
- User with `ADMIN` + `TSO` roles has all ADMIN permissions
- User with `TEAM_MENTOR` (in Team A) + `TEAM_MEMBER` (in Team B) has mentor permissions in Team A and member permissions in Team B

## Contributing

When adding new protected routes:
1. Determine appropriate protection level (route-level vs. permission-level)
2. Use existing layout guards when possible
3. Add new permissions to `statement` in `auth.ts` if needed
4. Document the protection mechanism
5. Add tests for the protection

## License

This documentation is part of the RMS project. See LICENSE file in repository root.
