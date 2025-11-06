import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { hasPermission, requirePermission } from './lib/permissions';
import type { Id } from './_generated/dataModel';

type TeamRole = 'TEAM_MENTOR' | 'TEAM_LEADER' | 'TEAM_MEMBER' | 'COMMON';

const TEAM_STATUS_VALUES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
const LIST_SORT_VALUES = ['recent', 'name_asc', 'name_desc'] as const;

const teamRoleValidator = v.union(
	v.literal('TEAM_MENTOR'),
	v.literal('TEAM_LEADER'),
	v.literal('TEAM_MEMBER'),
	v.literal('COMMON')
);

const teamStatusValidator = v.union(...TEAM_STATUS_VALUES.map(v.literal));

const listSortValidator = v.union(...LIST_SORT_VALUES.map(v.literal));

const inviteRoleValidator = v.union(v.literal('TEAM_LEADER'), v.literal('TEAM_MEMBER'));

const matchStatusValidator = v.union(
	v.literal('SCHEDULED'),
	v.literal('QUEUEING'),
	v.literal('IN_PROGRESS'),
	v.literal('COMPLETED'),
	v.literal('CANCELLED')
);

const invitationStatusValidator = v.union(
	v.literal('PENDING'),
	v.literal('ACCEPTED'),
	v.literal('REJECTED'),
	v.literal('CANCELLED'),
	v.literal('EXPIRED')
);

const notificationTypeValidator = v.union(v.literal('MATCH'), v.literal('INVITE'));

const generateInvitationToken = (): string => {
	const globalCrypto = globalThis.crypto as typeof globalThis.crypto | undefined;

	if (globalCrypto?.randomUUID) {
		return globalCrypto.randomUUID();
	}

	const bytes = new Uint8Array(16);

	if (globalCrypto?.getRandomValues) {
		globalCrypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}

	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

interface AuthContext {
	appUser: {
		_id: Id<'users'>;
		authId: string;
		dateOfBirth?: number | null;
		appRole?: string | null;
		updatedAt: number;
	};
}

const loadAuthContext = async (
	ctx: QueryCtx | MutationCtx
): Promise<AuthContext | null> => {
	const betterAuthUser = await authComponent.getAuthUser(ctx).catch(() => null);
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

	return {
		appUser
	};
};

const requireAuthContext = async (ctx: QueryCtx | MutationCtx): Promise<AuthContext> => {
	const authContext = await loadAuthContext(ctx);
	if (!authContext) {
		throw new Error('Not authenticated');
	}
	return authContext;
};

const loadActiveMemberships = async (
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>
) => {
	return await ctx.db
		.query('team_members')
		.withIndex('by_user', (q) => q.eq('user_id', userId))
		.filter((q) => q.eq(q.field('is_active'), true))
		.collect();
};

const ensureMentorRoleRecord = async (
	ctx: MutationCtx,
	userId: Id<'users'>,
	assignedBy: Id<'users'>
) => {
	const existing = await ctx.db
		.query('user_roles')
		.withIndex('by_user_role', (q) => q.eq('user_id', userId).eq('role', 'TEAM_MENTOR'))
		.unique();

	if (!existing) {
		await ctx.db.insert('user_roles', {
			user_id: userId,
			role: 'TEAM_MENTOR',
			assigned_at: Date.now(),
			assigned_by: assignedBy
		});
	}
};

const calculateAge = (dateOfBirth: number | null | undefined): number | null => {
	if (!dateOfBirth) {
		return null;
	}

	const now = Date.now();
	return Math.floor((now - dateOfBirth) / (365.25 * 24 * 60 * 60 * 1000));
};

/**
 * Create a new team
 * Requires 'teams.create' permission globally
 * Creator gets TEAM_MENTOR role if 18+, otherwise error
 */
export const createTeam = mutation({
	args: {
		teamName: v.string(),
		location: v.string(),
		description: v.optional(v.string()),
		imageUrl: v.optional(v.string())
	},
	returns: v.object({
		teamId: v.id('teams'),
		teamNumber: v.string()
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		// 2. Enforce global permission
		await requirePermission(ctx, appUser._id, 'teams.create');

		const activeMemberships = await loadActiveMemberships(ctx, appUser._id);
		const holdsRestrictedRole = activeMemberships.some(
			(membership) => membership.role === 'TEAM_LEADER' || membership.role === 'TEAM_MEMBER'
		);

		if (holdsRestrictedRole) {
			throw new Error('Team leaders and members can only belong to one active team at a time');
		}

		// 3. Determine creator's role based on age
		const currentTime = Date.now();

		if (!appUser.dateOfBirth) {
			throw new Error('Date of birth is required to create a team');
		}

		const age = calculateAge(appUser.dateOfBirth);
		if (age === null || age < 18) {
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
		const teamRecord: {
			team_name: string;
			team_number: string;
			location: string;
			max_members: number;
			status: (typeof TEAM_STATUS_VALUES)[number];
			created_by: Id<'users'>;
			created_at: number;
			updated_at: number;
			updated_by: Id<'users'>;
			team_descriptions?: string;
			team_image_url?: string;
		} = {
			team_name: args.teamName,
			team_number: teamNumber,
			location: args.location,
			max_members: 10, // Default value
			status: 'DRAFT',
			created_by: appUser._id,
			created_at: now,
			updated_at: now,
			updated_by: appUser._id
		};

		if (args.description !== undefined) {
			teamRecord.team_descriptions = args.description;
		}

		if (args.imageUrl !== undefined) {
			teamRecord.team_image_url = args.imageUrl;
		}

		const teamId = await ctx.db.insert('teams', teamRecord);

		// 6. Add creator as team member
		await ctx.db.insert('team_members', {
			team_id: teamId,
			user_id: appUser._id,
			role: 'TEAM_MENTOR',
			is_active: true,
			joined_at: now,
			created_at: now,
			updated_at: now,
			updated_by: appUser._id
		});

		await ensureMentorRoleRecord(ctx, appUser._id, appUser._id);

		if (appUser.appRole !== 'TEAM_MENTOR') {
			await ctx.db.patch(appUser._id, {
				appRole: 'TEAM_MENTOR',
				updatedAt: now
			});
		}

		return { teamId, teamNumber };
	}
});

export const listTeams = query({
	args: {
		page: v.optional(v.number()),
		pageSize: v.optional(v.number()),
		search: v.optional(v.string()),
		status: v.optional(teamStatusValidator),
		location: v.optional(v.string()),
		sort: v.optional(listSortValidator)
	},
	returns: v.object({
		page: v.number(),
		pageSize: v.number(),
		total: v.number(),
		totalPages: v.number(),
		hasMore: v.boolean(),
		canCreateTeam: v.boolean(),
		teams: v.array(
			v.object({
				id: v.id('teams'),
				teamName: v.string(),
				teamNumber: v.string(),
				location: v.string(),
				status: teamStatusValidator,
				avatarUrl: v.optional(v.string()),
				description: v.optional(v.string()),
				createdAt: v.number(),
				updatedAt: v.number(),
				memberCount: v.number(),
				isOwnTeam: v.boolean(),
				membershipRole: v.optional(teamRoleValidator)
			})
		)
	}),
	handler: async (ctx, args) => {
		const authContext = await loadAuthContext(ctx);
		const appUser = authContext?.appUser ?? null;

		const memberships: Awaited<ReturnType<typeof loadActiveMemberships>> = appUser
			? await loadActiveMemberships(ctx, appUser._id)
			: [];
		const membershipMap = new Map<Id<'teams'>, TeamRole>();
		for (const membership of memberships) {
			membershipMap.set(membership.team_id, membership.role);
		}

		const age = appUser ? calculateAge(appUser.dateOfBirth ?? null) : null;
		const holdsRestrictedRole = memberships.some(
			(membership) => membership.role === 'TEAM_LEADER' || membership.role === 'TEAM_MEMBER'
		);
		const canCreateTeam = Boolean(
			appUser && age !== null && age >= 18 && !holdsRestrictedRole
		);

		const pageSize = Math.max(args.pageSize ?? 20, 1);
		const page = Math.max(args.page ?? 1, 1);
		const offset = (page - 1) * pageSize;

		let teamsQuery = ctx.db.query('teams');

		if (args.status) {
			teamsQuery = teamsQuery.filter((q) => q.eq(q.field('status'), args.status));
		}

		const allTeams = await teamsQuery.collect();

		const searchTerm = args.search?.trim().toLowerCase();
		const locationTerm = args.location?.trim().toLowerCase();
		const filteredTeams = allTeams.filter((team) => {
			const matchesSearch = (() => {
				if (!searchTerm) {
					return true;
				}

				const name = team.team_name.toLowerCase();
				const number = team.team_number.toLowerCase();
				const location = team.location.toLowerCase();
				return (
					name.includes(searchTerm) ||
					number.includes(searchTerm) ||
					location.includes(searchTerm)
				);
			})();

			const matchesLocation = (() => {
				if (!locationTerm) {
					return true;
				}

				return team.location.toLowerCase().includes(locationTerm);
			})();

			return matchesSearch && matchesLocation;
		});

		const sortMode = args.sort ?? 'recent';
		const sortedTeams = filteredTeams.sort((a, b) => {
			if (sortMode === 'name_asc') {
				return a.team_name.localeCompare(b.team_name);
			}

			if (sortMode === 'name_desc') {
				return b.team_name.localeCompare(a.team_name);
			}

			return b.created_at - a.created_at;
		});

		const total = sortedTeams.length;
		const totalPages = Math.max(Math.ceil(total / pageSize), 1);
		const paginated = sortedTeams.slice(offset, offset + pageSize);

		const responseTeams = [];
		for (const team of paginated) {
			const members = await ctx.db
				.query('team_members')
				.withIndex('by_team_user', (q) => q.eq('team_id', team._id))
				.filter((q) => q.eq(q.field('is_active'), true))
				.collect();

			const membershipRole = membershipMap.get(team._id);

			responseTeams.push({
				id: team._id,
				teamName: team.team_name,
				teamNumber: team.team_number,
				location: team.location,
				status: team.status,
				avatarUrl: team.team_image_url ?? undefined,
				description: team.team_descriptions ?? undefined,
				createdAt: team.created_at,
				updatedAt: team.updated_at,
				memberCount: members.length,
				isOwnTeam: membershipMap.has(team._id),
				membershipRole
			});
		}

		return {
			page,
			pageSize,
			total,
			totalPages,
			hasMore: offset + pageSize < total,
			canCreateTeam,
			teams: responseTeams
		};
	}
});

export const getCreationContext = query({
	args: {},
	returns: v.object({
		canCreate: v.boolean(),
		reasons: v.array(v.string()),
		age: v.optional(v.number()),
		mentorTeamCount: v.number(),
		activeMembershipCount: v.number(),
		restrictedRoles: v.array(teamRoleValidator)
	}),
	handler: async (ctx) => {
		const authContext = await loadAuthContext(ctx);
		if (!authContext) {
			return {
				canCreate: false,
				reasons: ['You must be signed in to create a team'],
				age: undefined,
				mentorTeamCount: 0,
				activeMembershipCount: 0,
				restrictedRoles: []
			};
		}

		const { appUser } = authContext;
		const memberships = await loadActiveMemberships(ctx, appUser._id);
		const age = calculateAge(appUser.dateOfBirth ?? null);

		const reasons: string[] = [];

		if (appUser.dateOfBirth == null) {
			reasons.push('Add your date of birth to your profile before creating a team.');
		} else if (age !== null && age < 18) {
			reasons.push('You must be at least 18 years old to create a team.');
		}

		const restrictedMemberships = memberships.filter(
			(membership) => membership.role === 'TEAM_LEADER' || membership.role === 'TEAM_MEMBER'
		);

		if (restrictedMemberships.length > 0) {
			reasons.push(
				'Team leaders and members can only belong to one active team. Leave your current team before creating a new one.'
			);
		}

		return {
			canCreate: reasons.length === 0,
			reasons,
			age: age ?? undefined,
			mentorTeamCount: memberships.filter(
				(membership) => membership.role === 'TEAM_MENTOR'
			).length,
			activeMembershipCount: memberships.length,
			restrictedRoles: restrictedMemberships.map((membership) => membership.role)
		};
	}
});

export const getTeamManagement = query({
	args: {
		teamNumber: v.string()
	},
	returns: v.union(
		v.object({
			currentUserId: v.id('users'),
			team: v.object({
				id: v.id('teams'),
				teamName: v.string(),
				teamNumber: v.string(),
				location: v.string(),
				status: teamStatusValidator,
				description: v.optional(v.string()),
				avatarUrl: v.optional(v.string()),
				maxMembers: v.number(),
				createdAt: v.number(),
				updatedAt: v.number()
			}),
			membership: v.union(
				v.object({
					role: teamRoleValidator,
					isMentor: v.boolean()
				}),
				v.null()
			),
			permissions: v.object({
				canUpdate: v.boolean(),
				canInvite: v.boolean(),
				canManageMembers: v.boolean()
			}),
			members: v.array(
				v.object({
					id: v.id('team_members'),
					userId: v.id('users'),
					fullName: v.optional(v.string()),
					email: v.string(),
					role: teamRoleValidator,
					isActive: v.boolean(),
					joinedAt: v.number()
				})
			),
			invitations: v.array(
				v.object({
					id: v.id('team_invitations'),
					invitedUserId: v.id('users'),
					invitedEmail: v.string(),
					role: teamRoleValidator,
					status: invitationStatusValidator,
					expiresAt: v.number(),
					createdAt: v.number()
				})
			),
			upcomingMatches: v.array(
				v.object({
					matchId: v.id('matches'),
					matchCode: v.string(),
					status: matchStatusValidator,
					startTime: v.optional(v.number()),
					stageId: v.optional(v.id('stages')),
					fieldId: v.optional(v.id('fields'))
				})
			),
			notifications: v.array(
				v.object({
					id: v.string(),
					type: notificationTypeValidator,
					message: v.string(),
					createdAt: v.number()
				})
			)
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		const authContext = await requireAuthContext(ctx);
		const { appUser } = authContext;

		const team = await ctx.db
			.query('teams')
			.withIndex('by_team_number', (q) => q.eq('team_number', args.teamNumber))
			.unique();

		if (!team) {
			return null;
		}

		const membership = await ctx.db
			.query('team_members')
			.withIndex('by_team_user', (q) => q.eq('team_id', team._id).eq('user_id', appUser._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.unique();

		const membersDocs = await ctx.db
			.query('team_members')
			.withIndex('by_team_user', (q) => q.eq('team_id', team._id))
			.collect();

		const activeMembers = membersDocs.filter((doc) => doc.is_active);

		const members = [];
		for (const member of activeMembers) {
			const user = await ctx.db.get(member.user_id);
			if (!user) {
				continue;
			}

			members.push({
				id: member._id,
				userId: member.user_id,
				fullName: user.fullName ?? user.email,
				email: user.email,
				role: member.role,
				isActive: member.is_active,
				joinedAt: member.joined_at
			});
		}

		const invites = await ctx.db
			.query('team_invitations')
			.withIndex('by_team', (q) => q.eq('team_id', team._id))
			.collect();

		const invitations = [];
		for (const invitation of invites) {
			const invitedUser = await ctx.db.get(invitation.invited_user_id);
			if (!invitedUser) {
				continue;
			}

			invitations.push({
				id: invitation._id,
				invitedUserId: invitation.invited_user_id,
				invitedEmail: invitedUser.email,
				role: invitation.invited_role,
				status: invitation.status,
				expiresAt: invitation.expires_at,
				createdAt: invitation.created_at
			});
		}

		const allianceMemberships = await ctx.db
			.query('team_alliance_members')
			.filter((q) => q.eq(q.field('team_id'), team._id))
			.collect();

		const upcomingMatches = [];
		for (const allianceMember of allianceMemberships) {
			const alliance = await ctx.db.get(allianceMember.alliance_id);
			if (!alliance) {
				continue;
			}

			const match = await ctx.db.get(alliance.alliance_match);
			if (!match) {
				continue;
			}

			if (match.deleted_at) {
				continue;
			}

			if (match.match_status === 'COMPLETED' || match.match_status === 'CANCELLED') {
				continue;
			}

			upcomingMatches.push({
				matchId: match._id,
				matchCode: match.match_code,
				status: match.match_status,
				startTime: match.match_start_time ?? undefined,
				stageId: match.match_stage,
				fieldId: match.match_field
			});
		}

		upcomingMatches.sort((a, b) => {
			const aTime = a.startTime ?? Number.MAX_SAFE_INTEGER;
			const bTime = b.startTime ?? Number.MAX_SAFE_INTEGER;
			return aTime - bTime;
		});

		const notifications = [];

		for (const match of upcomingMatches.slice(0, 5)) {
			notifications.push({
				id: `match-${match.matchId}`,
				type: 'MATCH' as const,
				message: `Match ${match.matchCode} is scheduled soon.`,
				createdAt: match.startTime ?? Date.now()
			});
		}

		for (const invitation of invitations) {
			if (invitation.status === 'PENDING') {
				notifications.push({
					id: `invite-${invitation.id}`,
					type: 'INVITE' as const,
					message: `${invitation.invitedEmail} has a pending invitation as ${invitation.role
						.toLowerCase()
						.replace('_', ' ')}.`,
					createdAt: invitation.createdAt
				});
			}
		}

		const canUpdate = await hasPermission(ctx, appUser._id, 'teams.update', {
			teamId: team._id
		});

		const canManageMembers = Boolean(membership?.role === 'TEAM_MENTOR');

		return {
			currentUserId: appUser._id,
			team: {
				id: team._id,
				teamName: team.team_name,
				teamNumber: team.team_number,
				location: team.location,
				status: team.status,
				description: team.team_descriptions ?? undefined,
				avatarUrl: team.team_image_url ?? undefined,
				maxMembers: team.max_members,
				createdAt: team.created_at,
				updatedAt: team.updated_at
			},
			membership: membership
				? {
						role: membership.role,
						isMentor: membership.role === 'TEAM_MENTOR'
					}
				: null,
			permissions: {
				canUpdate,
				canInvite: canManageMembers,
				canManageMembers: canManageMembers
			},
			members,
			invitations,
			upcomingMatches: upcomingMatches.slice(0, 5),
			notifications
		};
	}
});

export const updateTeam = mutation({
	args: {
		teamId: v.id('teams'),
		teamName: v.string(),
		location: v.string(),
		description: v.optional(v.string()),
		imageUrl: v.optional(v.string())
	},
	returns: v.object({
		success: v.boolean()
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		const membership = await ctx.db
			.query('team_members')
			.withIndex('by_team_user', (q) => q.eq('team_id', args.teamId).eq('user_id', appUser._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.unique();

		if (!membership) {
			throw new Error('You are not a member of this team');
		}

		await requirePermission(ctx, appUser._id, 'teams.update', {
			teamId: args.teamId
		});

		const now = Date.now();

		const updateData: {
			team_name: string;
			location: string;
			updated_at: number;
			updated_by: Id<'users'>;
			team_descriptions?: string;
			team_image_url?: string;
		} = {
			team_name: args.teamName,
			location: args.location,
			updated_at: now,
			updated_by: appUser._id
		};

		if (args.description !== undefined) {
			updateData.team_descriptions = args.description;
		}

		if (args.imageUrl !== undefined) {
			updateData.team_image_url = args.imageUrl;
		}

		await ctx.db.patch(args.teamId, updateData);

		return { success: true };
	}
});

export const inviteTeamMember = mutation({
	args: {
		teamId: v.id('teams'),
		inviteeEmail: v.string(),
		role: inviteRoleValidator
	},
	returns: v.object({
		invitationId: v.id('team_invitations'),
		token: v.string()
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		const membership = await ctx.db
			.query('team_members')
			.withIndex('by_team_user', (q) => q.eq('team_id', args.teamId).eq('user_id', appUser._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.unique();

		if (!membership || membership.role !== 'TEAM_MENTOR') {
			throw new Error('Only team mentors can send invitations');
		}

		const normalizedEmail = args.inviteeEmail.trim().toLowerCase();

		if (!normalizedEmail) {
			throw new Error('Invitee email is required');
		}

		let invitee = await ctx.db
			.query('users')
			.withIndex('email', (q) => q.eq('email', normalizedEmail))
			.unique();

		if (!invitee) {
			invitee = await ctx.db
				.query('users')
				.withIndex('email', (q) => q.eq('email', args.inviteeEmail.trim()))
				.unique();
		}

		if (!invitee) {
			throw new Error('Unable to find a user with that email');
		}

		if (invitee._id === appUser._id) {
			throw new Error('You cannot invite yourself');
		}

		const existingMembership = await ctx.db
			.query('team_members')
			.withIndex('by_team_user', (q) => q.eq('team_id', args.teamId).eq('user_id', invitee._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.unique();

		if (existingMembership) {
			throw new Error('User is already an active member of this team');
		}

		const pendingInvites = await ctx.db
			.query('team_invitations')
			.withIndex('by_team', (q) => q.eq('team_id', args.teamId))
			.collect();

		const pendingInvite = pendingInvites.find(
			(invitation) =>
				invitation.invited_user_id === invitee._id && invitation.status === 'PENDING'
		);

		if (pendingInvite) {
			throw new Error('A pending invitation already exists for this user');
		}

		const token = generateInvitationToken();
		const now = Date.now();
		const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

		const invitationId = await ctx.db.insert('team_invitations', {
			team_id: args.teamId,
			invited_user_id: invitee._id,
			invited_by_user_id: appUser._id,
			invited_role: args.role,
			invitation_token: token,
			status: 'PENDING',
			expires_at: expiresAt,
			created_at: now,
			updated_at: now,
			updated_by: appUser._id
		});

		return {
			invitationId,
			token
		};
	}
});
