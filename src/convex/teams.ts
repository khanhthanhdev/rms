import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { authComponent } from './auth';
import { requirePermission } from './lib/permissions';

/**
 * Create a new team
 * Requires 'teams.create' permission globally
 * Creator gets TEAM_MENTOR role if 18+, otherwise error
 */
export const createTeam = mutation({
	args: {
		teamName: v.string(),
		location: v.string()
	},
	returns: v.id('teams'),
	handler: async (ctx, args) => {
		// 1. Authenticate and get app user
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

		// 2. Enforce global permission
		await requirePermission(ctx, appUser._id, 'teams.create');

		// 3. Determine creator's role based on age
		const creatorRole = 'TEAM_MENTOR' as const;
		const currentTime = Date.now();

		if (!appUser.dateOfBirth) {
			throw new Error('Date of birth is required to create a team');
		}

		const age = Math.floor((currentTime - appUser.dateOfBirth) / (365.25 * 24 * 60 * 60 * 1000));
		if (age < 18) {
			throw new Error('You must be at least 18 years old to create a team');
		}

		// 4. Generate unique team number using efficient counter
		// This avoids querying all teams and is atomic/thread-safe
		const counterName = 'team_number';

		// Try to get existing counter
		const existingCounter = await ctx.db
			.query('counters')
			.withIndex('by_name', (q) => q.eq('name', counterName))
			.unique();

		let newNumber: number;
		if (existingCounter) {
			// Atomically increment and return the new value
			newNumber = existingCounter.value + 1;
			await ctx.db.patch(existingCounter._id, {
				value: newNumber,
				updated_at: Date.now()
			});
		} else {
			// Create new counter starting from 1
			newNumber = 1;
			await ctx.db.insert('counters', {
				name: counterName,
				value: newNumber,
				updated_at: Date.now()
			});
		}

		const teamNumber = newNumber.toString().padStart(5, '0');

		// 5. Create the team
		const now = Date.now();
		const teamId = await ctx.db.insert('teams', {
			team_name: args.teamName,
			team_number: teamNumber,
			location: args.location,
			max_members: 10, // Default value
			status: 'DRAFT',
			created_by: appUser._id,
			created_at: now,
			updated_at: now,
			updated_by: appUser._id
		});

		// 6. Add creator as team member
		await ctx.db.insert('team_members', {
			team_id: teamId,
			user_id: appUser._id,
			role: creatorRole,
			is_active: true,
			joined_at: now,
			created_at: now,
			updated_at: now,
			updated_by: appUser._id
		});

		return teamId;
	}
});
