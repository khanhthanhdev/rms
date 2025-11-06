# RBAC Flow Diagrams

This document provides visual representations of the authentication and authorization flows in the RMS.

## Admin Route Access Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Request: /admin/users                    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              1. Global Hook (hooks.server.ts)                    │
│  • Extract auth token from cookies                              │
│  • Store in event.locals.token                                  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│        2. Admin Layout Server (admin/+layout.server.ts)          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Create Convex HTTP Client                              │    │
│  │  • Use cookies and auth token                          │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       │                                          │
│                       ▼                                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Query: getCurrentUser()                                │    │
│  │  • Fetch user from Convex backend                      │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       │                                          │
│             ┌─────────┴──────────┐                              │
│             │ User exists?        │                              │
│             └─────────┬──────────┘                              │
│                  NO   │   YES                                    │
│        ┌──────────────┴───────────────┐                         │
│        │                              │                         │
│        ▼                              ▼                         │
│  ┌─────────────┐         ┌──────────────────────────────┐      │
│  │ Return 401  │         │ Extract & Normalize Roles     │      │
│  │ Unauthorized│         │  • orgRoles (from teams)      │      │
│  └─────────────┘         │  • appRole (custom field)     │      │
│                          │  • role (Better Auth)         │      │
│                          └──────────────┬────────────────┘      │
│                                         │                        │
│                                         ▼                        │
│                          ┌──────────────────────────────┐       │
│                          │ Check: Has ADMIN role?       │       │
│                          │  isAdmin = orgRoles.includes │       │
│                          │            ('ADMIN') ||      │       │
│                          │            appRole === ...   │       │
│                          └──────────────┬───────────────┘       │
│                                    NO   │   YES                 │
│                          ┌──────────────┴──────────────┐        │
│                          │                             │        │
│                          ▼                             ▼        │
│                    ┌─────────────┐         ┌─────────────────┐ │
│                    │ Return 403  │         │ Return user     │ │
│                    │ Forbidden   │         │ data with       │ │
│                    │             │         │ isAdmin: true   │ │
│                    └─────────────┘         └────────┬────────┘ │
└──────────────────────────────────────────────────────┼──────────┘
                                                       │
                                                       ▼
                                     ┌───────────────────────────┐
                                     │ Load /admin/users page    │
                                     │  • User management UI     │
                                     │  • Admin actions enabled  │
                                     └───────────────────────────┘
```

## Role Resolution Flow

```
┌────────────────────────────────────────────────────────────────┐
│             collectUserRoleNames(ctx, userId, scope?)          │
└────────────────────────────────┬───────────────────────────────┘
                                 │
         ┌───────────────────────┼──────────────────────┐
         │                       │                      │
         ▼                       ▼                      ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  1. User Table   │   │  2. user_roles   │   │ 3. org_user_roles│
│                  │   │     Table        │   │     Table        │
│  • appRole field │   │                  │   │                  │
│  • Custom role   │   │  • Dedicated     │   │  • Organization  │
│    assignment    │   │    role table    │   │    level roles   │
│                  │   │  • Global roles  │   │  • TSO, etc.     │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ 4. Better Auth User   │
                    │                       │
                    │  • role field         │
                    │  • roles field        │
                    │  • Fallback/Legacy    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ 5. Team Memberships   │
                    │    (if scope.teamId)  │
                    │                       │
                    │  • team_members table │
                    │  • Scoped to team     │
                    │  • TEAM_MENTOR, etc.  │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Normalize All Roles  │
                    │                       │
                    │  • Uppercase          │
                    │  • Replace - with _   │
                    │  • Map aliases        │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Add Fallback: COMMON  │
                    │  (if no roles found)  │
                    └───────────┬───────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ Set<RoleName> │
                        │               │
                        │ • ADMIN       │
                        │ • TSO         │
                        │ • TEAM_MENTOR │
                        │ • COMMON      │
                        │ • ...         │
                        └───────────────┘
```

## Permission Check Flow

```
┌─────────────────────────────────────────────────────────────────┐
│         hasPermission(ctx, userId, 'tournaments.create')        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ Parse Permission String │
                    │                         │
                    │  resource = 'tournaments'│
                    │  action   = 'create'    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Get User's Roles        │
                    │                         │
                    │ userRoles =             │
                    │  collectUserRoleNames() │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ For each role:          │
                    │                         │
                    │  1. Get role object     │
                    │  2. Get role.statements │
                    │  3. Check if resource   │
                    │     has action          │
                    └────────────┬────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼                             ▼
         ┌────────────────┐           ┌────────────────┐
         │ Example: ADMIN │           │ Example: TSO   │
         │                │           │                │
         │ statements: {  │           │ statements: {  │
         │   tournaments: │           │   tournaments: │
         │     ['create', │           │     ['create', │
         │      'update', │           │      'update', │
         │      'delete', │           │      'delete', │
         │      ...]      │           │      ...]      │
         │ }              │           │ }              │
         └────────┬───────┘           └────────┬───────┘
                  │                            │
                  │ ✓ Has 'create'             │ ✓ Has 'create'
                  │                            │
                  └──────────────┬─────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │  Return TRUE   │
                        │                │
                        │ User has the   │
                        │ permission!    │
                        └────────────────┘
```

## Data Flow: User Authentication to Route Access

```
┌──────────────┐
│ User Browser │
└──────┬───────┘
       │ 1. HTTP Request
       │    GET /admin/users
       │    Cookie: auth_token=xyz...
       │
       ▼
┌──────────────────────────────────────────┐
│         SvelteKit Server                  │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │  hooks.server.ts                    │ │
│  │  • Extract token from cookies       │ │
│  │  • locals.token = 'xyz...'          │ │
│  └─────────────────┬───────────────────┘ │
│                    │                      │
│                    ▼                      │
│  ┌─────────────────────────────────────┐ │
│  │  admin/+layout.server.ts            │ │
│  │  • Create Convex client with token  │ │
│  │  • Check user roles                 │ │
│  └─────────────────┬───────────────────┘ │
└────────────────────┼──────────────────────┘
                     │
                     │ 2. Query getCurrentUser
                     │
                     ▼
┌──────────────────────────────────────────┐
│         Convex Backend                    │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │  auth.ts: getCurrentUser()          │ │
│  │  • Validate auth token              │ │
│  │  • Fetch user from database         │ │
│  │  • Collect roles from:              │ │
│  │    - users.appRole                  │ │
│  │    - user_roles table               │ │
│  │    - org_user_roles table           │ │
│  │    - team_members table             │ │
│  │  • Return user + roles              │ │
│  └─────────────────┬───────────────────┘ │
└────────────────────┼──────────────────────┘
                     │
                     │ 3. User data with roles
                     │
                     ▼
┌──────────────────────────────────────────┐
│         SvelteKit Server                  │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │  admin/+layout.server.ts            │ │
│  │  • Check if ADMIN in roles          │ │
│  │  • If yes: return user data         │ │
│  │  • If no: throw 403 error           │ │
│  └─────────────────┬───────────────────┘ │
└────────────────────┼──────────────────────┘
                     │
                     │ 4. Response
                     │
                     ▼
┌──────────────────────────────────────────┐
│  admin/users/+page.svelte                 │
│                                           │
│  • Render user management UI              │
│  • Display user list                      │
│  • Enable admin actions                   │
└───────────────────┬───────────────────────┘
                    │
                    │ 5. HTML Response
                    │
                    ▼
             ┌──────────────┐
             │ User Browser │
             │              │
             │ Shows admin  │
             │ interface    │
             └──────────────┘
```

## Role Hierarchy and Permissions

```
                    ┌─────────────┐
                    │    ADMIN    │ ← Full System Access
                    │             │
                    │ All permissions
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼─────┐     ┌─────▼──────┐
   │   TSO   │      │HEAD_REFEREE│     │TEAM_MENTOR │
   │         │      │            │     │            │
   │Tournament│      │   Match    │     │   Team     │
   │ Admin   │      │   Admin    │     │   Admin    │
   └────┬────┘      └──────┬─────┘     └─────┬──────┘
        │                  │                  │
        │           ┌──────┴──────┐           │
        │           │             │           │
   ┌────▼────┐  ┌──▼──────┐  ┌───▼──────┐ ┌──▼─────────┐
   │ QUEUER  │  │  SCORE  │  │   TEAM   │ │    TEAM    │
   │         │  │  KEEPER │  │  LEADER  │ │   MEMBER   │
   │ Queue   │  │         │  │          │ │            │
   │ Only    │  │ Scoring │  │ Limited  │ │  Basic     │
   │         │  │  Only   │  │  Team    │ │  Team      │
   └─────────┘  └─────────┘  └──────────┘ └────┬───────┘
                                               │
                                         ┌─────▼──────┐
                                         │   COMMON   │
                                         │            │
                                         │  Default   │
                                         │  Read-Only │
                                         └────────────┘
```

## Multi-Source Role Collection

```
                      ┌──────────────────┐
                      │   User Request   │
                      └────────┬─────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │  Need to check permissions     │
              └────────────┬───────────────────┘
                           │
                           ▼
              ┌────────────────────────────────┐
              │ collectUserRoleNames(userId)   │
              └────────────┬───────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ users table  │  │ user_roles   │  │org_user_roles│
│              │  │   table      │  │    table     │
│ appRole:     │  │              │  │              │
│  'ADMIN'     │  │ {user_id,    │  │ {user_id,    │
│              │  │  role:       │  │  role:       │
│              │  │  'TSO'}      │  │  'ADMIN'}    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
                ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │ Better Auth  │  │ team_members │
        │  user doc    │  │    table     │
        │              │  │              │
        │ role:        │  │ {user_id,    │
        │  'admin'     │  │  team_id,    │
        │              │  │  role:       │
        │              │  │  'TEAM_      │
        │              │  │   MENTOR'}   │
        └──────┬───────┘  └──────┬───────┘
               │                 │
               └────────┬────────┘
                        │
                        ▼
          ┌─────────────────────────┐
          │   Normalize All Roles   │
          │                         │
          │ • ADMIN (from appRole)  │
          │ • ADMIN (from org_roles)│
          │ • TSO (from user_roles) │
          │ • TEAM_MENTOR (from     │
          │   team membership)      │
          │ • COMMON (default)      │
          └────────────┬────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Deduplicated   │
              │  Role Set:     │
              │                │
              │ { 'ADMIN',     │
              │   'TSO',       │
              │   'TEAM_MENTOR'│
              │   'COMMON' }   │
              └────────────────┘
```

---

## Legend

```
┌─────────┐
│  Box    │  = Process or Component
└─────────┘

    │
    ▼        = Flow direction

┌─────────┐
│Question?│  = Decision point
└───┬─────┘
 YES│ NO

✓          = Check/Validation passed
```

---

## Key Takeaways

1. **Multiple Layers**: Authentication → Route Guard → Permission Check
2. **Multiple Sources**: Roles come from 5+ different sources
3. **Fail-Safe**: Defaults to least privilege (COMMON role)
4. **Server-Side**: All security checks happen on the server
5. **Hierarchical**: ADMIN has all permissions, roles cascade down
6. **Scoped**: Permissions can be checked globally or within team/tournament scope
