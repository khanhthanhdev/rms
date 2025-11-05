import type { Role } from 'better-auth/plugins/access';
import type { Id } from '../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../_generated/server';
import {
	ADMIN,
	COMMON,
	HEAD_REFEREE,
	QUEUER,
	SCORE_KEEPER,
	TEAM_LEADER,
	TEAM_MEMBER,
	TEAM_MENTOR,
	TSO,
	betterAuthComponent,
	statement
} from '../auth';

// Role objects for permission checking
const ROLE_MAP = {
	ADMIN,
	TEAM_MENTOR,
	TEAM_LEADER,
	TEAM_MEMBER,
	COMMON,
	TSO,
	HEAD_REFEREE,
	SCORE_KEEPER,
	QUEUER
} as const satisfies Record<string, Role>;

type RoleMap = typeof ROLE_MAP;
type RoleName = keyof RoleMap;

type PermissionFromStatements<S extends Record<string, readonly string[]>> = {
	[Resource in keyof S]: S[Resource] extends readonly string[]
		? `${Resource & string}.${S[Resource][number] & string}`
		: never;
}[keyof S];

export type Permission = PermissionFromStatements<typeof statement>;

export type TeamRole = Extract<RoleName, 'TEAM_MENTOR' | 'TEAM_LEADER' | 'TEAM_MEMBER' | 'COMMON'>;

export type OrgRole = Extract<RoleName, 'ADMIN' | 'TSO' | 'HEAD_REFEREE' | 'SCORE_KEEPER' | 'QUEUER'>;

/**
 * Scope for permission checks
 * Allows checking permissions within a specific team context
 */
export interface PermissionScope {
	teamId?: Id<'teams'>;
	tournamentId?: Id<'tournaments'>;
}

const FALLBACK_ROLE: TeamRole = 'COMMON';

const hasOwn = (object: object, key: PropertyKey) =>
	Object.prototype.hasOwnProperty.call(object, key);

const toArray = <T>(value: T | T[] | null | undefined): T[] => {
	if (value === null || value === undefined) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
};

const ROLE_ALIAS_MAP: Record<string, RoleName> = {
	TOURNAMENT_SCORING_OFFICER: 'TSO',
	TSO: 'TSO',
	QUEUE_MANAGER: 'QUEUER',
	QUEUER: 'QUEUER',
	ADMIN: 'ADMIN',
	TEAM_MENTOR: 'TEAM_MENTOR',
	TEAM_LEADER: 'TEAM_LEADER',
	TEAM_MEMBER: 'TEAM_MEMBER',
	COMMON: 'COMMON',
	HEAD_REFEREE: 'HEAD_REFEREE',
	SCORE_KEEPER: 'SCORE_KEEPER'
};

const normalizeRoleKey = (rawRole: string | null | undefined): RoleName | null => {
	if (!rawRole) {
		return null;
	}

	const trimmed = rawRole.trim();
	if (!trimmed) {
		return null;
	}

	if (hasOwn(ROLE_ALIAS_MAP, trimmed)) {
		return ROLE_ALIAS_MAP[trimmed];
	}

	const normalized = trimmed.replace(/-/g, '_').toUpperCase();
	if (hasOwn(ROLE_ALIAS_MAP, normalized)) {
		return ROLE_ALIAS_MAP[normalized];
	}

	return null;
};

const loadAuthUserByAuthId = async (ctx: QueryCtx | MutationCtx, authId: string) => {
	if (!authId) {
		return null;
	}

	try {
		const byUserId = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
			model: 'user',
			where: [
				{
					field: 'userId',
					operator: 'eq',
					value: authId
				}
			]
		});

		if (byUserId) {
			return byUserId;
		}

		return await ctx.runQuery(betterAuthComponent.adapter.findOne, {
			model: 'user',
			where: [
				{
					field: 'id',
					operator: 'eq',
					value: authId
				}
			]
		});
	} catch {
		return null;
	}
};

const getScopedTeamMemberships = async (
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>,
	scope?: PermissionScope
) => {
	let memberships = await ctx.db
		.query('team_members')
		.withIndex('by_user', (q) => q.eq('user_id', userId))
		.filter((q) => q.eq(q.field('is_active'), true))
		.collect();

	if (scope?.teamId) {
		memberships = memberships.filter((membership) => membership.team_id === scope.teamId);
	}

	const tournamentId = scope?.tournamentId;
	if (tournamentId) {
		const tournamentTeams = await ctx.db
			.query('team_tournament_participation')
			.withIndex('by_tournament', (q) => q.eq('tournament_id', tournamentId))
			.collect();

		if (tournamentTeams.length === 0) {
			return [];
		}

		const activeTeams = new Set(
			tournamentTeams.filter((entry) => entry.is_active !== false).map((entry) => entry.team_id)
		);

		memberships = memberships.filter((membership) => activeTeams.has(membership.team_id));
	}

	return memberships;
};

const collectUserRoleNames = async (
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>,
	scope?: PermissionScope
): Promise<Set<RoleName>> => {
	const roleNames = new Set<RoleName>();

	const user = await ctx.db.get(userId);
	if (!user) {
		return roleNames;
	}

	const appRole = normalizeRoleKey(user.appRole as string | null | undefined);
	if (appRole) {
		roleNames.add(appRole);
	}

	const authUser = await loadAuthUserByAuthId(ctx, user.authId);

	// Collect baseline user roles from dedicated table
	const baseRoles = await ctx.db
		.query('user_roles')
		.withIndex('by_user', (q) => q.eq('user_id', userId))
		.collect();

	for (const record of baseRoles) {
		const resolved = normalizeRoleKey(record.role);
		if (resolved) {
			roleNames.add(resolved);
		}
	}

	// Organization-level roles from dedicated table
	const orgRoles = await ctx.db
		.query('org_user_roles')
		.withIndex('by_user', (q) => q.eq('user_id', userId))
		.collect();

	for (const record of orgRoles) {
		const resolved = normalizeRoleKey(record.role);
		if (resolved) {
			roleNames.add(resolved);
		}
	}

	// Fallback: include roles from Better Auth user document for backward compatibility
	if (authUser) {
		const globalRoleCandidates: string[] = [];

		if ('role' in authUser) {
			globalRoleCandidates.push(
				...toArray<string>(authUser.role as string | string[] | null | undefined)
			);
		}

		if ('roles' in authUser) {
			globalRoleCandidates.push(
				...toArray<string>(authUser.roles as string | string[] | null | undefined)
			);
		}

		for (const rawRole of globalRoleCandidates) {
			const resolved = normalizeRoleKey(rawRole);
			if (resolved) {
				roleNames.add(resolved);
			}
		}
	}

	roleNames.add(FALLBACK_ROLE);

	const memberships = await getScopedTeamMemberships(ctx, userId, scope);
	for (const membership of memberships) {
		const resolved = normalizeRoleKey(membership.role);
		if (resolved) {
			roleNames.add(resolved);
		}
	}

	return roleNames;
};

/**
 * Check if a user has a specific permission
 *
 * @param ctx - Convex context (query or mutation)
 * @param userId - The ID of the user in the users table
 * @param permission - The permission to check
 * @param scope - Optional scope for team/tournament specific checks
 * @returns true if user has the permission, false otherwise
 */
export async function hasPermission(
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>,
	permission: Permission,
	scope?: PermissionScope
): Promise<boolean> {
	const [resource, action] = permission.split('.', 2);

	if (!resource || !action) {
		return false;
	}

	const userRoles = await collectUserRoleNames(ctx, userId, scope);
	if (userRoles.size === 0) {
		return false;
	}

	for (const roleName of userRoles) {
		const role = ROLE_MAP[roleName];
		const statements = role?.statements as Record<string, string[]> | undefined;
		const allowedActions = statements?.[resource];

		if (Array.isArray(allowedActions) && allowedActions.includes(action)) {
			return true;
		}
	}

	return false;
}

/**
 * Require that a user has a specific permission
 * Throws an error if the user does not have the permission
 *
 * @param ctx - Convex context (query or mutation)
 * @param userId - The ID of the user in the users table
 * @param permission - The permission to require
 * @param scope - Optional scope for team/tournament specific checks
 * @throws Error if user does not have the permission
 */
export async function requirePermission(
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>,
	permission: Permission,
	scope?: PermissionScope
): Promise<void> {
	const hasPermissionResult = await hasPermission(ctx, userId, permission, scope);

	if (!hasPermissionResult) {
		throw new Error(`Forbidden: Missing required permission '${permission}'`);
	}
}

/**
 * Check if a user has any of the specified roles
 *
 * @param ctx - Convex context
 * @param userId - The ID of the user
 * @param roles - Array of roles to check
 * @param scope - Optional scope for team/tournament specific checks
 * @returns true if user has any of the specified roles
 */
export async function hasAnyRole(
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>,
	roles: Array<TeamRole | OrgRole>,
	scope?: PermissionScope
): Promise<boolean> {
	const userRoles = await collectUserRoleNames(ctx, userId, scope);

	return roles.some((role) => userRoles.has(role));
}

/**
 * Check if a user is an admin
 *
 * @param ctx - Convex context
 * @param userId - The ID of the user
 * @returns true if user has ADMIN role
 */
export async function isAdmin(ctx: QueryCtx | MutationCtx, userId: Id<'users'>): Promise<boolean> {
	return await hasAnyRole(ctx, userId, ['ADMIN']);
}

/**
 * Check if a user is a member of a specific team
 *
 * @param ctx - Convex context
 * @param userId - The ID of the user
 * @param teamId - The ID of the team
 * @returns true if user is an active member of the team
 */
export async function isTeamMember(
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>,
	teamId: Id<'teams'>
): Promise<boolean> {
	const membership = await ctx.db
		.query('team_members')
		.withIndex('by_team_user', (q) => q.eq('team_id', teamId).eq('user_id', userId))
		.filter((q) => q.eq(q.field('is_active'), true))
		.unique();

	return membership !== null;
}
