import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

const ORG_ROLE_VALUES = [
	'ADMIN',
	'TOURNAMENT_SCORING_OFFICER',
	'HEAD_REFEREE',
	'SCORE_KEEPER',
	'QUEUE_MANAGER'
] as const;

type OrgRoleValue = (typeof ORG_ROLE_VALUES)[number];

const ORG_ROLE_SET = new Set<OrgRoleValue>(ORG_ROLE_VALUES);

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
	if (ORG_ROLE_SET.has(normalized as OrgRoleValue)) {
		return normalized as OrgRoleValue;
	}

	return null;
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

		// Check if app user already exists
		let appUser = await ctx.db
			.query('users')
			.withIndex('authId', (q) => q.eq('authId', authUserId))
			.unique();

		const now = Date.now();

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
				lastLoginAt: now
			});

			// Note: Better Auth handles role assignment automatically via organization membership
			// Default role 'COMMON' is set in the organization plugin configuration

			appUser = await ctx.db.get(newUserId);

			return { isNewUser: true, user: appUser };
		}

		// Update last login time for existing users
		await ctx.db.patch(appUser._id, {
			lastLoginAt: now,
			updatedAt: now
		});

		return { isNewUser: false, user: appUser };
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
					v.literal('TOURNAMENT_SCORING_OFFICER'),
					v.literal('HEAD_REFEREE'),
					v.literal('SCORE_KEEPER'),
					v.literal('QUEUE_MANAGER')
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

			// Get team memberships with roles (Better Auth organization roles)
			const teamMemberships = await ctx.db
				.query('team_members')
				.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
				.filter((q) => q.eq(q.field('is_active'), true))
				.collect();

			// Normalize Better Auth global roles to our known org roles
			const orgRoles = toArray<string>(betterAuthUser.role as string | string[] | null | undefined).reduce<
				OrgRoleValue[]
			>((acc, rawRole) => {
				const normalized = normalizeOrgRole(rawRole);
				if (normalized) {
					acc.push(normalized);
				}

				return acc;
			}, []);

			return {
				...appUser,
				// Team-scoped roles from team memberships
				roles: teamMemberships.map((tm) => tm.role),
				// Global roles from Better Auth (ADMIN, etc.)
				orgRoles,
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
