import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

const teamRoleValidator = v.union(
	v.literal('TEAM_MENTOR'),
	v.literal('TEAM_LEADER'),
	v.literal('TEAM_MEMBER'),
	v.literal('COMMON')
);

export const userTeamsQuery = query({
	args: {},
	returns: v.array(
		v.object({
			id: v.id('teams'),
			team_name: v.string(),
			name: v.string(),
			role: teamRoleValidator,
			plan: v.optional(v.string())
		})
	),
	handler: async (ctx) => {
		let betterAuthUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
		try {
			betterAuthUser = await authComponent.getAuthUser(ctx);
		} catch {
			return [];
		}

		if (!betterAuthUser) {
			return [];
		}

		const authUserId = betterAuthUser.userId || betterAuthUser._id;

		const appUser = await ctx.db
			.query('users')
			.withIndex('authId', (q) => q.eq('authId', authUserId))
			.unique();

		if (!appUser) {
			return [];
		}

		const memberships = await ctx.db
			.query('team_members')
			.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.collect();

		if (memberships.length === 0) {
			return [];
		}

		const results: Array<{
			id: typeof memberships[number]['team_id'];
			team_name: string;
			name: string;
			role: (typeof memberships)[number]['role'];
			plan?: string;
		}> = [];

		for (const membership of memberships) {
			const team = await ctx.db.get(membership.team_id);
			if (!team) {
				continue;
			}

			results.push({
				id: team._id,
				team_name: team.team_name,
				name: team.team_name,
				role: membership.role,
				plan: undefined
			});
		}

		return results;
	}
});

export const switchActiveTeam = mutation({
	args: {
		teamId: v.id('teams')
	},
	returns: v.object({
		success: v.boolean()
	}),
	handler: async (ctx, args) => {
		const betterAuthUser = await authComponent.getAuthUser(ctx).catch(() => null);
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

		const membership = await ctx.db
			.query('team_members')
			.withIndex('by_team_user', (q) => q.eq('team_id', args.teamId).eq('user_id', appUser._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.unique();

		if (!membership) {
			throw new Error('You are not a member of this team');
		}

		// TODO: integrate with Better Auth session to persist active organization
		return { success: true };
	}
});
