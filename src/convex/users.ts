import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
	authComponent,
	DEFAULT_APP_ROLE,
	normalizeAppRole,
	type AppRole
} from './auth';

const ORG_ROLE_VALUES = ['ADMIN', 'TSO', 'HEAD_REFEREE', 'SCORE_KEEPER', 'QUEUER'] as const;

type OrgRoleValue = (typeof ORG_ROLE_VALUES)[number];

const ORG_ROLE_SET = new Set<OrgRoleValue>(ORG_ROLE_VALUES);

const USER_ROLE_VALUES = ['TEAM_MENTOR', 'TEAM_LEADER', 'TEAM_MEMBER', 'COMMON'] as const;

type UserRoleValue = (typeof USER_ROLE_VALUES)[number];

const USER_ROLE_SET = new Set<UserRoleValue>(USER_ROLE_VALUES);

const toArray = <T>(value: T | T[] | null | undefined): T[] => {
	if (value === null || value === undefined) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
};

const normalizeOrgRole = (role: string | null | undefined): OrgRoleValue | null => {
	if (!role) {
		return null;
	}

	const normalized = role.trim().replace(/-/g, '_').toUpperCase();

	if (normalized === 'TOURNAMENT_SCORING_OFFICER') {
		return 'TSO';
	}

	if (normalized === 'QUEUE_MANAGER') {
		return 'QUEUER';
	}

	if (ORG_ROLE_SET.has(normalized as OrgRoleValue)) {
		return normalized as OrgRoleValue;
	}

	return null;
};

const normalizeUserRole = (role: string | null | undefined): UserRoleValue | null => {
	if (!role) {
		return null;
	}

	const normalized = role.trim().replace(/-/g, '_').toUpperCase();
	if (USER_ROLE_SET.has(normalized as UserRoleValue)) {
		return normalized as UserRoleValue;
	}

	return null;
};

const ensureUserRoleRecord = async (
	ctx: MutationCtx,
	userId: Id<'users'>,
	role: UserRoleValue,
	assignedBy?: Id<'users'>
) => {
	const existing = await ctx.db
		.query('user_roles')
		.withIndex('by_user_role', (q) => q.eq('user_id', userId).eq('role', role))
		.unique();

	if (!existing) {
		await ctx.db.insert('user_roles', {
			user_id: userId,
			role,
			assigned_at: Date.now(),
			assigned_by: assignedBy
		});
	}
};

const ensureOrgRoleRecord = async (
	ctx: MutationCtx,
	userId: Id<'users'>,
	role: OrgRoleValue,
	assignedBy?: Id<'users'>
) => {
	const existing = await ctx.db
		.query('org_user_roles')
		.withIndex('by_user_role', (q) => q.eq('user_id', userId).eq('role', role))
		.unique();

	if (!existing) {
		await ctx.db.insert('org_user_roles', {
			user_id: userId,
			role,
			assigned_at: Date.now(),
			assigned_by: assignedBy
		});
	}
};

/**
 * Sync or create app user from Better Auth user on first login
 * This mutation should be called from the client after successful auth
 */
export const syncUser = mutation({
	args: {},
	returns: v.object({
		isNewUser: v.boolean(),
		user: v.union(
			v.object({
				_id: v.id('users'),
				_creationTime: v.number(),
				authId: v.string(),
				email: v.string(),
				fullName: v.optional(v.string()),
				avatarUrl: v.optional(v.string()),
				phone: v.optional(v.string()),
				dateOfBirth: v.optional(v.number()),
				location: v.optional(v.string()),
				userType: v.optional(v.union(v.literal('REGULAR'), v.literal('ORG'))),
				appRole: v.optional(
					v.union(
						v.literal('ADMIN'),
						v.literal('TSO'),
						v.literal('HEAD_REFEREE'),
						v.literal('SCORE_KEEPER'),
						v.literal('QUEUER'),
						v.literal('TEAM_MENTOR'),
						v.literal('TEAM_LEADER'),
						v.literal('TEAM_MEMBER'),
						v.literal('COMMON')
					)
				),
				isActive: v.optional(v.boolean()),
				createdAt: v.number(),
				updatedAt: v.number(),
				lastLoginAt: v.optional(v.number())
			}),
			v.null()
		)
	}),
	handler: async (ctx) => {
		// Get the authenticated Better Auth user
		const betterAuthUser = await authComponent.getAuthUser(ctx);

		if (!betterAuthUser) {
			throw new Error('Not authenticated');
		}

		// Use userId field (not id) to link Better Auth user to app user
		const authUserId = betterAuthUser.userId || betterAuthUser._id;

		const rawRoleCandidates = new Set<string>();

		const pushCandidate = (value: string | string[] | null | undefined) => {
			for (const item of toArray<string>(value)) {
				rawRoleCandidates.add(item);
			}
		};

		pushCandidate(betterAuthUser.role as string | string[] | null | undefined);
		pushCandidate((betterAuthUser as { roles?: string | string[] | null | undefined }).roles);
		pushCandidate(
			(betterAuthUser as { data?: Record<string, unknown> | null | undefined }).data?.role as
				| string
				| string[]
				| null
				| undefined
		);
		pushCandidate(
			(betterAuthUser as { data?: Record<string, unknown> | null | undefined }).data?.roles as
				| string
				| string[]
				| null
				| undefined
		);
		pushCandidate(
			(betterAuthUser as { data?: Record<string, unknown> | null | undefined }).data?.orgRoles as
				| string
				| string[]
				| null
				| undefined
		);
		pushCandidate(
			(betterAuthUser as { data?: Record<string, unknown> | null | undefined }).data?.userRoles as
				| string
				| string[]
				| null
				| undefined
		);

		const explicitAppRoleCandidates: Array<string | null | undefined> = [
			(betterAuthUser as { appRole?: string | null | undefined }).appRole,
			(betterAuthUser as { data?: Record<string, unknown> | null | undefined }).data?.appRole as
				| string
				| null
				| undefined
		];

		const normalizedBetterAuthAppRole =
			[...explicitAppRoleCandidates, ...rawRoleCandidates]
				.map((candidate) => normalizeAppRole(candidate ?? undefined))
				.find((role): role is AppRole => role !== null) ?? null;

		// Check if app user already exists
		let appUser = await ctx.db
			.query('users')
			.withIndex('authId', (q) => q.eq('authId', authUserId))
			.unique();

		const now = Date.now();

		let isNewUser = false;

		// Create app user if doesn't exist (first login)
		if (!appUser) {
			const newUserId = await ctx.db.insert('users', {
				authId: authUserId,
				email: betterAuthUser.email,
				fullName: betterAuthUser.name || undefined,
				avatarUrl: betterAuthUser.image || undefined,
				phone: undefined,
				dateOfBirth: undefined,
				location: undefined,
				userType: 'REGULAR', // Default userType for new users
				isActive: true,
				createdAt: now,
				updatedAt: now,
				lastLoginAt: now,
				appRole: normalizedBetterAuthAppRole ?? DEFAULT_APP_ROLE
			});

			appUser = await ctx.db.get(newUserId);

			isNewUser = true;
		} else {
			await ctx.db.patch(appUser._id, {
				lastLoginAt: now,
				updatedAt: now
			});

			appUser = await ctx.db.get(appUser._id);
		}

		if (!appUser) {
			throw new Error('Failed to load user record');
		}

		const existingAppRole = normalizeAppRole(appUser.appRole ?? null);
		const resolvedAppRole = normalizedBetterAuthAppRole ?? existingAppRole ?? DEFAULT_APP_ROLE;

		if (appUser.appRole !== resolvedAppRole) {
			await ctx.db.patch(appUser._id, {
				appRole: resolvedAppRole,
				updatedAt: now
			});
			const reloaded = await ctx.db.get(appUser._id);
			if (!reloaded) {
				throw new Error('Failed to reload user after role update');
			}
			appUser = reloaded;
		}

		if (!appUser) {
			throw new Error('Failed to load user record');
		}

		// Ensure baseline COMMON role exists
		await ensureUserRoleRecord(ctx, appUser._id, 'COMMON', appUser._id);

		rawRoleCandidates.add(resolvedAppRole);

		for (const rawRole of rawRoleCandidates) {
			const orgRole = normalizeOrgRole(rawRole);
			if (orgRole) {
				await ensureOrgRoleRecord(ctx, appUser._id, orgRole, appUser._id);
				continue;
			}

			const userRole = normalizeUserRole(rawRole);
			if (userRole) {
				await ensureUserRoleRecord(ctx, appUser._id, userRole, appUser._id);
			}
		}

		return { isNewUser, user: appUser };
	}
});

/**
 * Get the current app user (not Better Auth user)
 */
export const getCurrentAppUser = query({
	args: {},
	returns: v.union(
		v.object({
			_id: v.id('users'),
			_creationTime: v.number(),
			authId: v.string(),
			email: v.string(),
			fullName: v.optional(v.string()),
			avatarUrl: v.optional(v.string()),
			phone: v.optional(v.string()),
			dateOfBirth: v.optional(v.number()),
			location: v.optional(v.string()),
			userType: v.optional(v.union(v.literal('REGULAR'), v.literal('ORG'))),
			appRole: v.optional(
				v.union(
					v.literal('ADMIN'),
					v.literal('TSO'),
					v.literal('HEAD_REFEREE'),
					v.literal('SCORE_KEEPER'),
					v.literal('QUEUER'),
					v.literal('TEAM_MENTOR'),
					v.literal('TEAM_LEADER'),
					v.literal('TEAM_MEMBER'),
					v.literal('COMMON')
				)
			),
			isActive: v.optional(v.boolean()),
			createdAt: v.number(),
			updatedAt: v.number(),
			lastLoginAt: v.optional(v.number())
		}),
		v.null()
	),
	handler: async (ctx) => {
		try {
			const betterAuthUser = await authComponent.getAuthUser(ctx);
			if (!betterAuthUser) {
				return null;
			}

			const authUserId = betterAuthUser.userId || betterAuthUser._id;

			const appUser = await ctx.db
				.query('users')
				.withIndex('authId', (q) => q.eq('authId', authUserId))
				.unique();

			return appUser;
		} catch {
			return null;
		}
	}
});

/**
 * Get user with their roles and permissions
 */
export const getCurrentUserWithRoles = query({
	args: {},
	returns: v.union(
		v.object({
			_id: v.id('users'),
			_creationTime: v.number(),
			authId: v.string(),
			email: v.string(),
			fullName: v.optional(v.string()),
			avatarUrl: v.optional(v.string()),
			phone: v.optional(v.string()),
			dateOfBirth: v.optional(v.number()),
			location: v.optional(v.string()),
			userType: v.optional(v.union(v.literal('REGULAR'), v.literal('ORG'))),
			isActive: v.optional(v.boolean()),
			createdAt: v.number(),
			updatedAt: v.number(),
			lastLoginAt: v.optional(v.number()),
			appRole: v.optional(
				v.union(
					v.literal('ADMIN'),
					v.literal('TSO'),
					v.literal('HEAD_REFEREE'),
					v.literal('SCORE_KEEPER'),
					v.literal('QUEUER'),
					v.literal('TEAM_MENTOR'),
					v.literal('TEAM_LEADER'),
					v.literal('TEAM_MEMBER'),
					v.literal('COMMON')
				)
			),
			roles: v.array(
				v.union(
					v.literal('TEAM_MENTOR'),
					v.literal('TEAM_LEADER'),
					v.literal('TEAM_MEMBER'),
					v.literal('COMMON')
				)
			),
			orgRoles: v.array(
				v.union(
					v.literal('ADMIN'),
					v.literal('TSO'),
					v.literal('HEAD_REFEREE'),
					v.literal('SCORE_KEEPER'),
					v.literal('QUEUER')
				)
			),
			teams: v.array(v.any())
		}),
		v.null()
	),
	handler: async (ctx) => {
		try {
			const betterAuthUser = await authComponent.getAuthUser(ctx);
			if (!betterAuthUser) {
				return null;
			}

			const authUserId = betterAuthUser.userId || betterAuthUser._id;

			const appUser = await ctx.db
				.query('users')
				.withIndex('authId', (q) => q.eq('authId', authUserId))
				.unique();

			if (!appUser) {
				return null;
			}

			const roleSet = new Set<UserRoleValue>();

			// General user roles from dedicated table
			const userRoleRecords = await ctx.db
				.query('user_roles')
				.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
				.collect();

			for (const record of userRoleRecords) {
				roleSet.add(record.role);
			}

			// Get team memberships with roles (Better Auth organization roles)
			const teamMemberships = await ctx.db
				.query('team_members')
				.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
				.filter((q) => q.eq(q.field('is_active'), true))
				.collect();

			for (const membership of teamMemberships) {
				const normalizedRole = normalizeUserRole(membership.role);
				if (normalizedRole) {
					roleSet.add(normalizedRole);
				}
			}

			if (roleSet.size === 0) {
				roleSet.add('COMMON');
			}

			const orgRoleSet = new Set<OrgRoleValue>();

			// Organization roles from dedicated table
			const orgRoleRecords = await ctx.db
				.query('org_user_roles')
				.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
				.collect();

			for (const record of orgRoleRecords) {
				orgRoleSet.add(record.role);
			}

			// Fallback: include legacy roles from Better Auth document
			const legacyRoleSources = [
				betterAuthUser.role as string | string[] | null | undefined,
				(betterAuthUser as { roles?: string | string[] | null | undefined }).roles,
				(betterAuthUser as { data?: Record<string, unknown> | null | undefined }).data?.orgRoles as
					| string
					| string[]
					| null
					| undefined
			];

			for (const source of legacyRoleSources) {
				for (const rawRole of toArray<string>(source)) {
					const normalized = normalizeOrgRole(rawRole);
					if (normalized) {
						orgRoleSet.add(normalized);
					}
				}
			}

			return {
				...appUser,
				roles: Array.from(roleSet),
				orgRoles: Array.from(orgRoleSet),
				teams: teamMemberships
			};
		} catch {
			return null;
		}
	}
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
	args: {
		fullName: v.optional(v.string()),
		location: v.optional(v.string()),
		phone: v.optional(v.string()),
		dateOfBirth: v.optional(v.number()),
		avatarUrl: v.optional(v.string())
	},
	returns: v.union(
		v.object({
			_id: v.id('users'),
			_creationTime: v.number(),
			authId: v.string(),
			email: v.string(),
			fullName: v.optional(v.string()),
			avatarUrl: v.optional(v.string()),
			phone: v.optional(v.string()),
			dateOfBirth: v.optional(v.number()),
			location: v.optional(v.string()),
			userType: v.optional(v.union(v.literal('REGULAR'), v.literal('ORG'))),
			appRole: v.optional(
				v.union(
					v.literal('ADMIN'),
					v.literal('TSO'),
					v.literal('HEAD_REFEREE'),
					v.literal('SCORE_KEEPER'),
					v.literal('QUEUER'),
					v.literal('TEAM_MENTOR'),
					v.literal('TEAM_LEADER'),
					v.literal('TEAM_MEMBER'),
					v.literal('COMMON')
				)
			),
			isActive: v.optional(v.boolean()),
			createdAt: v.number(),
			updatedAt: v.number(),
			lastLoginAt: v.optional(v.number())
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		const betterAuthUser = await authComponent.getAuthUser(ctx);

		if (!betterAuthUser) {
			throw new Error('Not authenticated');
		}

		const authUserId = betterAuthUser.userId || betterAuthUser._id;

		const appUser = await ctx.db
			.query('users')
			.withIndex('authId', (q) => q.eq('authId', authUserId))
			.unique();

		if (!appUser) {
			throw new Error('User not found');
		}

		await ctx.db.patch(appUser._id, {
			...args,
			updatedAt: Date.now()
		});

		return await ctx.db.get(appUser._id);
	}
});
