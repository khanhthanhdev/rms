# Admin Route Protection - Quick Reference

## How `/admin/users` is Protected

This document provides a concise reference for understanding how the `/admin/users` route is protected.

---

## File Location

```
src/routes/(app)/admin/+layout.server.ts
```

This single file protects **ALL** routes under `/admin/*`, including:
- `/admin/users`
- `/admin/settings`
- Any future admin routes

---

## Protection Code (Simplified)

```typescript
export const load: LayoutServerLoad = async ({ cookies, locals }) => {
    // 1. Create authenticated Convex client
    const client = createConvexHttpClient({ cookies, convexUrl });
    client.setAuth(locals.token);
    
    // 2. Fetch current user
    const user = await client.query(api.auth.getCurrentUser, {});
    
    if (!user) {
        throw error(401, 'Unauthorized');  // Not logged in
    }
    
    // 3. Extract roles from multiple sources
    const orgRoles = normalizeRoles(user.orgRoles);
    const appRole = normalizeRole(user.appRole);
    const betterAuthRole = normalizeRole(user.role);
    
    // 4. Check if user has ADMIN role
    const isAdmin = orgRoles.includes('ADMIN') || 
                    appRole === 'ADMIN' || 
                    betterAuthRole === 'ADMIN';
    
    if (!isAdmin) {
        throw error(403, 'Forbidden: Admin access required');  // ⛔ BLOCKED
    }
    
    // 5. User is admin - allow access
    return { user: { ...user, isAdmin: true } };  // ✅ ALLOWED
};
```

---

## Role Normalization

All role strings are normalized to handle variations:

```typescript
const normalizeRole = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    
    const normalized = value.trim().replace(/-/g, '_').toUpperCase();
    
    // These all become 'ADMIN':
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

**Supported Admin Variations:**
- `admin` → `ADMIN`
- `ADMIN` → `ADMIN`
- `administrator` → `ADMIN`
- `super-admin` → `ADMIN`
- `SUPERADMIN` → `ADMIN`

---

## Where Roles Come From

The system checks for ADMIN role in **3 different places**:

### 1. Organization Roles (`orgRoles`)
```typescript
user.orgRoles = ['ADMIN', 'TSO']
```
- From `org_user_roles` table in Convex
- Organization-level role assignments
- Example: System administrators

### 2. Application Role (`appRole`)
```typescript
user.appRole = 'ADMIN'
```
- From `users.appRole` field in Convex
- Custom application-level role
- Example: App administrators

### 3. Better Auth Role (`role`)
```typescript
user.role = 'admin'
```
- From Better Auth's built-in role system
- Managed via Better Auth admin API
- Example: Authentication-level admins

**If ANY of these contains 'ADMIN', access is granted.**

---

## Access Flow

```
User Requests /admin/users
        ↓
Is user authenticated?
        ↓ NO → 401 Unauthorized
        ↓ YES
Does user have ADMIN role?
        ↓ NO → 403 Forbidden
        ↓ YES
Allow access to /admin/users
        ↓
Render admin interface
```

---

## HTTP Status Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| **200** | Success | User is authenticated AND has ADMIN role |
| **401** | Unauthorized | No valid authentication token / session expired |
| **403** | Forbidden | Authenticated but lacks ADMIN role |
| **500** | Server Error | Error during role check (database/network issue) |

---

## Testing Access

### Test as Non-Admin

1. Sign in as a regular user (without ADMIN role)
2. Navigate to `/admin/users`
3. **Expected:** 403 Forbidden error page

### Test as Admin

1. Assign ADMIN role to user (via Better Auth admin API or database)
2. Sign in as that user
3. Navigate to `/admin/users`
4. **Expected:** User management page loads successfully

### Test Without Login

1. Clear cookies / logout
2. Navigate to `/admin/users`
3. **Expected:** 401 Unauthorized, redirected to login

---

## Making a User an Admin

### Option 1: Better Auth Admin API

```typescript
import { authClient } from '$lib/auth-client';

await authClient.admin.setRole({
    userId: 'user_id_here',
    role: 'admin'  // Better Auth uses lowercase
});
```

### Option 2: Direct Database (Convex)

```typescript
await ctx.db.insert('org_user_roles', {
    user_id: userIdFromUsersTable,
    role: 'ADMIN'
});
```

### Option 3: Update User Document

```typescript
await ctx.db.patch(userIdFromUsersTable, {
    appRole: 'ADMIN'
});
```

---

## Code Location Map

| Purpose | File | Line(s) |
|---------|------|---------|
| Admin route guard | `src/routes/(app)/admin/+layout.server.ts` | 35-95 |
| Role normalization | `src/routes/(app)/admin/+layout.server.ts` | 12-33 |
| Role definitions | `src/convex/auth.ts` | 18-28 |
| Permission functions | `src/convex/lib/permissions.ts` | All |
| User management UI | `src/routes/(app)/admin/users/+page.svelte` | All |
| Auth hook | `src/hooks.server.ts` | 6-14 |

---

## Security Notes

✅ **Server-Side Only**
- All role checks happen on the server
- Client cannot bypass this protection
- Tokens are HTTP-only cookies

✅ **Defense in Depth**
- Multiple sources for roles
- Normalized to prevent bypass
- Fail-safe defaults (deny access if uncertain)

✅ **Clear Error Messages**
- 401: "Please log in"
- 403: "Admin access required"
- Never reveals what roles exist to non-admins

⚠️ **Important**
- Never check roles client-side for security
- Always use server-side guards
- Don't expose role-checking logic to frontend

---

## Common Issues

### Issue: Admin user gets 403 Forbidden

**Causes:**
1. Role not properly set in database
2. Role string doesn't match (check normalization)
3. Cached session (clear cookies and re-login)

**Debug:**
```typescript
// Add to +layout.server.ts temporarily
console.log('User roles:', {
    orgRoles,
    appRole,
    betterAuthRole,
    isAdmin
});
```

### Issue: Regular user can access admin routes

**Cause:** This should never happen. If it does:
1. Check if `+layout.server.ts` is in the correct location
2. Verify the file is named exactly `+layout.server.ts`
3. Check if there's a parent layout overriding this one

**Location:** Must be at `src/routes/(app)/admin/+layout.server.ts`

---

## Quick Command Reference

```bash
# View admin layout guard
cat src/routes/(app)/admin/+layout.server.ts

# Check user's roles in database (via Convex dashboard)
# Navigate to: https://dashboard.convex.dev
# Select your project → Data → users table
# Find user and check: appRole, orgRoles fields

# Assign admin role via Better Auth
# (From SvelteKit server code or API route)
await authClient.admin.setRole({
  userId: 'user_id',
  role: 'admin'
});
```

---

## Summary

**Question:** How is `/admin/users` protected?

**Answer:** 
1. SvelteKit layout server (`+layout.server.ts`) runs before loading any admin page
2. It fetches the current user from Convex
3. It checks if the user has 'ADMIN' role from any of 3 sources (orgRoles, appRole, Better Auth role)
4. If yes → allows access
5. If no → returns 403 Forbidden
6. If not logged in → returns 401 Unauthorized

**Result:** Only authenticated users with ADMIN role can access `/admin/users` and all other `/admin/*` routes.

---

For complete technical details, see:
- **RBAC_ANALYSIS.md** - Full documentation
- **RBAC_FLOW_DIAGRAM.md** - Visual diagrams
- **RBAC_README.md** - Documentation index
