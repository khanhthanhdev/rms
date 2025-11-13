# RBAC Documentation - Complete Index

This index provides an overview of all RBAC (Role-Based Access Control) documentation for the RMS project.

## Documentation Suite

### 📖 Quick Start
**File:** [ADMIN_PROTECTION_QUICK_REF.md](./ADMIN_PROTECTION_QUICK_REF.md)  
**Size:** 314 lines | ~7.4 KB  
**Purpose:** Fast reference for understanding admin route protection  
**Best for:** Developers who need quick answers about `/admin/users` protection

**Key Topics:**
- Exact code protecting `/admin/users`
- Role normalization process
- Where roles come from (3 sources)
- Testing admin access
- Making users admins
- Troubleshooting guide

---

### 📘 Overview & Index
**File:** [RBAC_README.md](./RBAC_README.md)  
**Size:** 236 lines | ~8.0 KB  
**Purpose:** Entry point and navigation for all RBAC documentation  
**Best for:** First-time readers and getting oriented

**Key Topics:**
- Documentation structure overview
- Quick start guide
- Common use cases
- Security best practices
- FAQ and troubleshooting

---

### 📕 Complete Technical Reference
**File:** [RBAC_ANALYSIS.md](./RBAC_ANALYSIS.md)  
**Size:** 622 lines | ~17 KB  
**Purpose:** Comprehensive technical documentation  
**Best for:** In-depth understanding and implementation

**Key Topics:**
- Architecture overview (3-layer system)
- All 9 user roles explained
- Route protection mechanisms
- Admin route protection (detailed walkthrough)
- Permission system documentation
- Code examples for all scenarios
- Security considerations

**Table of Contents:**
1. Architecture Overview
2. User Roles
3. Route Protection Mechanisms
4. Admin Route Protection
5. Permission System
6. Code Examples

---

### 📊 Visual Diagrams
**File:** [RBAC_FLOW_DIAGRAM.md](./RBAC_FLOW_DIAGRAM.md)  
**Size:** 420 lines | ~27 KB  
**Purpose:** Visual representations of RBAC flows  
**Best for:** Understanding complex flows at a glance

**Diagrams Included:**
1. **Admin Route Access Flow** - Complete request-to-response diagram
2. **Role Resolution Flow** - How roles are collected from multiple sources
3. **Permission Check Flow** - Permission evaluation process
4. **Data Flow** - User authentication to route access
5. **Role Hierarchy** - Visual role structure
6. **Multi-Source Role Collection** - 5 role sources explained

---

## Reading Guide

### For Different Audiences

**New Developers:**
1. Start with: [RBAC_README.md](./RBAC_README.md)
2. Then read: [ADMIN_PROTECTION_QUICK_REF.md](./ADMIN_PROTECTION_QUICK_REF.md)
3. View diagrams: [RBAC_FLOW_DIAGRAM.md](./RBAC_FLOW_DIAGRAM.md)
4. Deep dive: [RBAC_ANALYSIS.md](./RBAC_ANALYSIS.md)

**Experienced Developers:**
1. Quick ref: [ADMIN_PROTECTION_QUICK_REF.md](./ADMIN_PROTECTION_QUICK_REF.md)
2. Visual overview: [RBAC_FLOW_DIAGRAM.md](./RBAC_FLOW_DIAGRAM.md)
3. Implementation details: [RBAC_ANALYSIS.md](./RBAC_ANALYSIS.md)

**Security Auditors:**
1. Technical reference: [RBAC_ANALYSIS.md](./RBAC_ANALYSIS.md) - Security Considerations section
2. Flow diagrams: [RBAC_FLOW_DIAGRAM.md](./RBAC_FLOW_DIAGRAM.md)
3. Code review: Actual implementation files referenced in docs

**Product Managers:**
1. Overview: [RBAC_README.md](./RBAC_README.md)
2. Role types: [RBAC_ANALYSIS.md](./RBAC_ANALYSIS.md) - User Roles section
3. Visual hierarchy: [RBAC_FLOW_DIAGRAM.md](./RBAC_FLOW_DIAGRAM.md) - Role Hierarchy diagram

---

## Key Files in Codebase

### Protection Implementation
| File | Purpose | Lines |
|------|---------|-------|
| `src/hooks.server.ts` | Global auth token extraction | 14 |
| `src/routes/(app)/admin/+layout.server.ts` | **Admin route protection** | 96 |
| `src/convex/auth.ts` | Role definitions & auth config | 482 |
| `src/convex/lib/permissions.ts` | Permission checking functions | 372 |
| `src/routes/(app)/admin/users/+page.svelte` | User management UI | 536 |

### Key Concepts

**3-Layer Security Model:**
```
Layer 1: Authentication (hooks.server.ts)
         ↓
Layer 2: Route Protection (+layout.server.ts)
         ↓
Layer 3: Permission Checks (Convex functions)
```

**5 Role Sources:**
1. `users.appRole` field
2. `user_roles` table
3. `org_user_roles` table
4. Better Auth `user.role` field
5. `team_members` table (team-scoped)

**9 User Roles:**
- ADMIN (highest privilege)
- TSO, HEAD_REFEREE, SCORE_KEEPER, QUEUER (org-level)
- TEAM_MENTOR, TEAM_LEADER, TEAM_MEMBER (team-scoped)
- COMMON (default, lowest privilege)

---

## Quick Facts

### Admin Route Protection

**Question:** How is `/admin/users` protected?

**Answer:** The file `src/routes/(app)/admin/+layout.server.ts` checks if the user has the ADMIN role in any of 3 sources (orgRoles, appRole, Better Auth role) and returns 403 Forbidden if not.

**Protected Routes:**
- `/admin/users` ✅
- `/admin/*` (all admin routes) ✅
- Future admin routes automatically ✅

**Status Codes:**
- 200 = Authorized admin
- 401 = Not logged in
- 403 = Logged in but not admin
- 500 = Server error

---

## Additional RBAC Documentation

The repository also contains related RBAC documentation:

- **rbac.md** - General RBAC concepts
- **rbac-quickstart.md** - Quick start guide
- **admin_plugin.md** - Better Auth admin plugin docs
- **role_field_resolution.md** - Role field resolution details

These complement the main documentation suite but focus on different aspects of the RBAC system.

---

## Code Examples Quick Links

### Protecting a New Admin Route
See: [RBAC_ANALYSIS.md - Example 1](./RBAC_ANALYSIS.md#example-1-protecting-a-custom-admin-route)

### Checking Permissions in Convex
See: [RBAC_ANALYSIS.md - Example 2](./RBAC_ANALYSIS.md#example-2-checking-permissions-in-convex)

### Team-Scoped Permission Check
See: [RBAC_ANALYSIS.md - Example 3](./RBAC_ANALYSIS.md#example-3-team-scoped-permission-check)

### Admin Check in SvelteKit Server Action
See: [RBAC_ANALYSIS.md - Example 4](./RBAC_ANALYSIS.md#example-4-admin-check-in-sveltekit-server-action)

### Making a User an Admin
See: [ADMIN_PROTECTION_QUICK_REF.md - Making a User an Admin](./ADMIN_PROTECTION_QUICK_REF.md#making-a-user-an-admin)

---

## Diagrams Quick Links

### Visual Flow Diagrams
- [Admin Route Access Flow](./RBAC_FLOW_DIAGRAM.md#admin-route-access-flow)
- [Role Resolution Flow](./RBAC_FLOW_DIAGRAM.md#role-resolution-flow)
- [Permission Check Flow](./RBAC_FLOW_DIAGRAM.md#permission-check-flow)
- [Data Flow](./RBAC_FLOW_DIAGRAM.md#data-flow-user-authentication-to-route-access)
- [Role Hierarchy](./RBAC_FLOW_DIAGRAM.md#role-hierarchy-and-permissions)
- [Multi-Source Role Collection](./RBAC_FLOW_DIAGRAM.md#multi-source-role-collection)

---

## Documentation Statistics

| Metric | Value |
|--------|-------|
| Total Documents | 4 |
| Total Lines | 1,592 |
| Total Size | ~59 KB |
| Code Examples | 10+ |
| Diagrams | 6 |
| Coverage | Complete RBAC system |

---

## Contributing to Documentation

When updating RBAC documentation:

1. **Keep consistency** - Follow the structure of existing docs
2. **Update all relevant files** - Changes may affect multiple documents
3. **Add examples** - Code examples help understanding
4. **Update diagrams** - Visual aids are crucial
5. **Test code examples** - Ensure examples actually work

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-06 | 1.0 | Initial comprehensive RBAC documentation suite created |

---

## Feedback

For questions, issues, or improvements to this documentation:
1. Create an issue in the repository
2. Reference the specific document and section
3. Suggest improvements with examples

---

## License

This documentation is part of the RMS project. See LICENSE file in repository root.

---

**Last Updated:** November 6, 2025  
**Maintained By:** RMS Development Team  
**Status:** ✅ Complete and up-to-date
