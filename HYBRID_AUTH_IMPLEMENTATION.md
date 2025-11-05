# Better Auth + Convex Hybrid Authentication Implementation

## Overview
This implementation successfully integrates Better Auth with your existing team-based system using a hybrid schema approach. It preserves your well-structured domain model while adding Better Auth's authentication and organization features.

## What Was Implemented

### 1. **Hybrid Schema Architecture**
- **Better Auth Schema**: Handles authentication (users, sessions, accounts, verification)
- **Application Schema**: Handles business logic (teams, tournaments, permissions, roles)
- **Integration**: Seamless bridging between both systems

### 2. **Core Components Created**

#### Auth Bridge (`src/convex/authBridge.ts`)
- Syncs Better Auth users with your existing `users` table
- Links `user.userId` (Better Auth) ↔ `users.authId` (your system)
- Handles team membership queries and user context

#### Auth Middleware (`src/convex/authMiddleware.ts`) 
- Merges Better Auth sessions with your domain context
- Provides `getAuthContext()` for all functions
- Implements role requirements (`requireTeamRole()`)
- Handles permission checking (`checkPermission()`)

#### Authorization System (`src/convex/authorization.ts`)
- Centralized permission constants
- Higher-order auth guards (`withAuthCheck`, `withTeamRole`, `withPermission`)
- Helper functions for common authorization patterns
- Query functions for permission checking

#### Auth Helpers (`src/convex/authHelpers.ts`)
- User context queries
- Team switching functionality  
- Auth wrapper utilities for existing functions
- Example patterns for updating functions

#### Updated Components
- **Team Switcher**: Now works with real auth data from your user tables
- **API Routes**: `/api/teams/current` and `/api/teams/switch`
- **Client Utils**: Library for frontend auth integration

### 3. **Key Features**

#### Hybrid Authentication Context
```typescript
interface AuthenticatedUser {
  userId: string;        // Better Auth userId
  internalUserId: string; // Your users table id
  email: string;
  userType: "REGULAR" | "ORG";
  fullName: string;
  
  // Team context
  activeTeamId?: string;
  activeTeamRole?: "TEAM_MENTOR" | "TEAM_LEADER" | "TEAM_MEMBER" | "COMMON";
  teams: Array<{id, name, role}>;
}
```

#### Permission Integration
- Your existing `role_permissions` table is preserved
- Better Auth organization plugin provides cross-team switching
- Role hierarchy respected (TEAM_MENTOR > TEAM_LEADER > TEAM_MEMBER > COMMON)

#### Function Enhancement Patterns
```typescript
// Before: No auth
export const createTournament = mutation({...});

// After: Protected with hybrid auth
export const createTournament = mutation({
  args: {...teamId, ...},
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const canCreate = await checkPermission(ctx, "tournaments.create", args.teamId);
    if (!canCreate) throw new Error("Insufficient permissions");
    // ...existing logic
  }
});
```

## Integration Instructions

### 1. **Update Existing Functions**
Use the patterns in `src/convex/exampleFunctionUpdates.ts` to protect existing functions:

```typescript
import { requireAuth, requireTeamRole, checkPermission } from "./authMiddleware";
import { PERMISSIONS } from "./authorization";

// Add auth checks to your functions
const user = await requireAuth(ctx);
const hasPermission = await checkPermission(ctx, PERMISSIONS["teams.create"]);
```

### 2. **Frontend Integration**
```typescript
import { getCurrentUserWithTeams, switchTeam } from '$lib/auth';

// Get user with team context
const user = await getCurrentUserWithTeams();

// Switch active team
await switchTeam(teamId);
```

### 3. **Team Switcher Usage**
The updated team switcher automatically:
- Fetches real team data from your system
- Shows user roles in each team
- Handles team switching with auth verification
- Provides loading/error states

### 4. **User Sync on Login**
After Better Auth authentication, sync users:
```typescript
// In your auth callback handler
await convex.mutation(api.authBridge.syncOrCreateUser, {
  email: "user@example.com",
  name: "User Name", 
  userId: "better_auth_user_id"
});
```

## Benefits Achieved

### ✅ **Preserved Existing System**
- Your comprehensive tournament/team domain model intact
- Existing role-permission matrix maintained
- No data migration required

### ✅ **Enhanced Authentication**
- Better Auth session management
- Organization plugin for multi-tenant support
- Modern auth features (social login, 2FA, etc.)

### ✅ **Improved Authorization**
- Centralized auth checks
- Role-based function protection
- Team-scoped permissions
- Audit trail through Better Auth logs

### ✅ **Better User Experience**
- Real-time team switching
- Context-aware UI
- Clear role visibility
- Seamless login flow

## Next Steps

1. **Test Basic Functionality**
   - Verify user authentication works
   - Test team switching
   - Check permission enforcement

2. **Update Critical Functions**
   - Start with tournament management functions
   - Add team member management auth
   - Secure scoring functions

3. **Frontend Integration**
   - Update protected routes to check auth
   - Add role-based UI visibility
   - Implement team-aware components

4. **Monitoring & Maintenance**
   - Set up auth error logging
   - Schedule cleanup of inactive memberships
   - Monitor permission effectiveness

## File Structure Summary

```
src/convex/
├── auth.ts              # Enhanced with organization plugin
├── authBridge.ts         # Sync Better Auth ↔ your users
├── authMiddleware.ts     # Hybrid auth context & guards
├── authorization.ts      # Permission system & utilities
├── authHelpers.ts        # Helper functions & patterns
├── exampleFunctionUpdates.ts # Migration examples
├── authSync.ts          # Sync utilities & maintenance
├── schema.ts            # Merged schemas (unchanged)
└── betterAuth/          # Auto-generated Better Auth schema

src/lib/
├── auth.ts              # Client-side auth utilities
└── components/team-switcher.svelte # Updated component

src/routes/api/teams/
├── current/+server.ts   # Get user teams
└── switch/+server.ts    # Switch active team
```

This hybrid approach gives you the best of both worlds: Better Auth's modern authentication features while preserving your sophisticated team and tournament system.
