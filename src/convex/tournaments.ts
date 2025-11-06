import { v } from 'convex/values';
import {
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { authComponent } from './auth';
import { hasPermission, requirePermission, type PermissionScope } from './lib/permissions';

const TOURNAMENT_STATUS_VALUES = [
	'DRAFT',
	'PUBLISHED',
	'IN_PROGRESS',
	'COMPLETED',
	'CANCELLED'
] as const;

const TOURNAMENT_VISIBILITY_VALUES = ['PUBLIC', 'PRIVATE'] as const;

const LIST_SORT_VALUES = ['recent', 'start_asc', 'start_desc', 'name_asc', 'name_desc'] as const;

const PHASE_FILTER_VALUES = [
	'registration_open',
	'upcoming',
	'in_progress',
	'completed'
] as const;

const teamRoleValidator = v.union(
	v.literal('TEAM_MENTOR'),
	v.literal('TEAM_LEADER'),
	v.literal('TEAM_MEMBER'),
	v.literal('COMMON')
);

const tournamentStatusValidator = v.union(
	...TOURNAMENT_STATUS_VALUES.map((status) => v.literal(status))
);

const tournamentVisibilityValidator = v.union(
	...TOURNAMENT_VISIBILITY_VALUES.map((visibility) => v.literal(visibility))
);

const listSortValidator = v.union(...LIST_SORT_VALUES.map((value) => v.literal(value)));

const phaseFilterValidator = v.union(...PHASE_FILTER_VALUES.map((value) => v.literal(value)));

type TournamentStatus = (typeof TOURNAMENT_STATUS_VALUES)[number];
type TournamentVisibility = (typeof TOURNAMENT_VISIBILITY_VALUES)[number];
type ListSort = (typeof LIST_SORT_VALUES)[number];
type PhaseFilter = (typeof PHASE_FILTER_VALUES)[number];

type DerivedPhase =
	| 'REGISTRATION_OPEN'
	| 'UPCOMING'
	| 'IN_PROGRESS'
	| 'COMPLETED'
	| 'CLOSED';

interface AuthContext {
	appUser: {
		_id: Id<'users'>;
		authId: string;
		appRole?: string | null;
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
	const context = await loadAuthContext(ctx);
	if (!context) {
		throw new Error('Not authenticated');
	}
	return context;
};

const normalizeSearch = (value: string | undefined): string | undefined => {
	if (!value) {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length ? trimmed.toLowerCase() : undefined;
};

const derivePhase = (tournament: {
	start_date?: number | null;
	end_date?: number | null;
	registration_deadline?: number | null;
	tournament_status?: TournamentStatus | null;
}): DerivedPhase => {
	const now = Date.now();
	const status = tournament.tournament_status ?? null;
	const startDate = tournament.start_date ?? null;
	const endDate = tournament.end_date ?? null;
	const registrationDeadline = tournament.registration_deadline ?? null;

	if (status === 'CANCELLED') {
		return 'CLOSED';
	}

	if (status === 'COMPLETED') {
		return 'COMPLETED';
	}

	if (status === 'IN_PROGRESS') {
		return 'IN_PROGRESS';
	}

	if (registrationDeadline && registrationDeadline > now) {
		return 'REGISTRATION_OPEN';
	}

	if (startDate && startDate > now) {
		return 'UPCOMING';
	}

	if (startDate && (!endDate || endDate >= now)) {
		return 'IN_PROGRESS';
	}

	if (endDate && endDate < now) {
		return 'COMPLETED';
	}

	return 'UPCOMING';
};

const isRegistrationOpen = (tournament: {
	registration_deadline?: number | null;
	tournament_status?: TournamentStatus | null;
}) => {
	const deadline = tournament.registration_deadline ?? null;
	const status = tournament.tournament_status ?? null;
	if (!deadline) {
		return status !== 'COMPLETED' && status !== 'CANCELLED';
	}
	return deadline > Date.now() && status !== 'COMPLETED' && status !== 'CANCELLED';
};

const ensureTournamentVisible = (
	tournament: {
		deleted_at?: number | null;
		tournament_visibility?: TournamentVisibility | null;
		tournament_status?: TournamentStatus | null;
	},
	includeDrafts: boolean,
	includePrivate: boolean
) => {
	if (tournament.deleted_at) {
		return false;
	}

	const visibility = tournament.tournament_visibility ?? 'PUBLIC';
	if (!includePrivate && visibility === 'PRIVATE') {
		return false;
	}

	const status = tournament.tournament_status ?? 'DRAFT';
	if (!includeDrafts && status === 'DRAFT') {
		return false;
	}

	return true;
};

const toTournamentScope = (tournamentId: Id<'tournaments'>): PermissionScope => ({
	tournamentId
});

const countActiveRegistrations = async (
	ctx: QueryCtx | MutationCtx,
	tournamentId: Id<'tournaments'>
) => {
	const registrations = await ctx.db
		.query('team_tournament_participation')
		.withIndex('by_tournament', (q) => q.eq('tournament_id', tournamentId))
		.collect();

	return registrations.filter(
		(registration) => !registration.deleted_at && registration.is_active !== false
	).length;
};

const loadRegistrationCounts = async (
	ctx: QueryCtx | MutationCtx,
	tournamentIds: Id<'tournaments'>[]
) => {
	const results = new Map<Id<'tournaments'>, number>();
	for (const tournamentId of tournamentIds) {
		const count = await countActiveRegistrations(ctx, tournamentId);
		results.set(tournamentId, count);
	}
	return results;
};

const sanitizeOptionalString = (value: string | undefined | null) => {
	if (value === undefined || value === null) {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
};

export const listPublicTournaments = query({
	args: {
		page: v.optional(v.number()),
		pageSize: v.optional(v.number()),
		search: v.optional(v.string()),
		phase: v.optional(phaseFilterValidator),
		sort: v.optional(listSortValidator)
	},
	returns: v.object({
		page: v.number(),
		pageSize: v.number(),
		total: v.number(),
		totalPages: v.number(),
		hasMore: v.boolean(),
		tournaments: v.array(
			v.object({
				id: v.id('tournaments'),
				name: v.string(),
				code: v.string(),
				description: v.optional(v.string()),
				location: v.optional(v.string()),
				startDate: v.optional(v.number()),
				registrationDeadline: v.optional(v.number()),
				status: v.optional(tournamentStatusValidator),
				visibility: v.optional(tournamentVisibilityValidator),
				registeredTeams: v.number(),
				teamCapacity: v.optional(v.number()),
				phase: v.union(
					v.literal('REGISTRATION_OPEN'),
					v.literal('UPCOMING'),
					v.literal('IN_PROGRESS'),
					v.literal('COMPLETED'),
					v.literal('CLOSED')
				),
				canEdit: v.boolean(),
				createdAt: v.number()
			})
		)
	}),
	handler: async (ctx, args) => {
		const authContext = await loadAuthContext(ctx);
		const appUser = authContext?.appUser ?? null;

		const includeDrafts = appUser
			? await hasPermission(ctx, appUser._id, 'tournaments.manage_all')
			: false;
		const includePrivate = appUser
			? await hasPermission(ctx, appUser._id, 'tournaments.manage_all')
			: false;

		const searchTerm = normalizeSearch(args.search);
		const phaseFilter = args.phase ?? null;
		const sortMode: ListSort = args.sort ?? 'recent';
		const pageSize = Math.max(Math.min(args.pageSize ?? 10, 50), 1);
		const page = Math.max(args.page ?? 1, 1);
		const offset = (page - 1) * pageSize;

		const tournaments = await ctx.db.query('tournaments').collect();

		const visibleTournaments = tournaments.filter((tournament) =>
			ensureTournamentVisible(tournament, includeDrafts, includePrivate)
		);

		const filtered = visibleTournaments.filter((tournament) => {
			const phase = derivePhase(tournament);

			if (phaseFilter) {
				if (phaseFilter === 'registration_open' && phase !== 'REGISTRATION_OPEN') {
					return false;
				}
				if (phaseFilter === 'upcoming' && phase !== 'UPCOMING') {
					return false;
				}
				if (phaseFilter === 'in_progress' && phase !== 'IN_PROGRESS') {
					return false;
				}
				if (phaseFilter === 'completed' && phase !== 'COMPLETED') {
					return false;
				}
			}

			if (searchTerm) {
				const name = tournament.tournament_name.toLowerCase();
				const code = tournament.tournament_code.toLowerCase();
				const description = tournament.tournament_description?.toLowerCase() ?? '';
				const location = tournament.tournament_location?.toLowerCase() ?? '';
				if (
					!name.includes(searchTerm) &&
					!code.includes(searchTerm) &&
					!description.includes(searchTerm) &&
					!location.includes(searchTerm)
				) {
					return false;
				}
			}

			return true;
		});

		const sorted = filtered.sort((a, b) => {
			if (sortMode === 'name_asc') {
				return a.tournament_name.localeCompare(b.tournament_name);
			}
			if (sortMode === 'name_desc') {
				return b.tournament_name.localeCompare(a.tournament_name);
			}
			if (sortMode === 'start_asc') {
				return (a.start_date ?? Number.MAX_SAFE_INTEGER) - (b.start_date ?? Number.MAX_SAFE_INTEGER);
			}
			if (sortMode === 'start_desc') {
				return (b.start_date ?? 0) - (a.start_date ?? 0);
			}
			return (b.created_at ?? 0) - (a.created_at ?? 0);
		});

		const total = sorted.length;
		const totalPages = Math.max(Math.ceil(total / pageSize), 1);
		const paginated = sorted.slice(offset, offset + pageSize);

		const registrationCounts = await loadRegistrationCounts(
			ctx,
			paginated.map((t) => t._id)
		);

		const editChecks = appUser
			? await Promise.all(
					paginated.map((tournament) =>
						hasPermission(ctx, appUser._id, 'tournaments.update', toTournamentScope(tournament._id))
					)
				)
			: [];

		const response: Array<{
			id: Id<'tournaments'>;
			name: string;
			code: string;
			description?: string;
			location?: string;
			startDate?: number;
			registrationDeadline?: number;
			status?: TournamentStatus;
			visibility?: TournamentVisibility;
			registeredTeams: number;
			teamCapacity?: number;
			phase: DerivedPhase;
			canEdit: boolean;
			createdAt: number;
		}> = [];

		for (const [index, tournament] of paginated.entries()) {
			const phase = derivePhase(tournament);
			const registrationCount = registrationCounts.get(tournament._id) ?? 0;
			const canEdit = appUser ? Boolean(editChecks[index]) : false;

			const entry: {
				id: Id<'tournaments'>;
				name: string;
				code: string;
				description?: string;
				location?: string;
				startDate?: number;
				registrationDeadline?: number;
				status?: TournamentStatus;
				visibility?: TournamentVisibility;
				registeredTeams: number;
				teamCapacity?: number;
				phase: DerivedPhase;
				canEdit: boolean;
				createdAt: number;
			} = {
				id: tournament._id,
				name: tournament.tournament_name,
				code: tournament.tournament_code,
				registeredTeams: registrationCount,
				phase,
				canEdit,
				createdAt: tournament.created_at
			};

			if (tournament.tournament_description) {
				entry.description = tournament.tournament_description;
			}
			if (tournament.tournament_location) {
				entry.location = tournament.tournament_location;
			}
			if (typeof tournament.start_date === 'number') {
				entry.startDate = tournament.start_date;
			}
			if (typeof tournament.registration_deadline === 'number') {
				entry.registrationDeadline = tournament.registration_deadline;
			}
			if (tournament.tournament_status) {
				entry.status = tournament.tournament_status;
			}
			if (tournament.tournament_visibility) {
				entry.visibility = tournament.tournament_visibility;
			}
			if (typeof tournament.team_capacity === 'number') {
				entry.teamCapacity = tournament.team_capacity;
			}

			response.push(entry);
		}

		return {
			page,
			pageSize,
			total,
			totalPages,
			hasMore: offset + paginated.length < total,
			tournaments: response
		};
	}
});

export const getPublicTournament = query({
	args: {
		tournamentId: v.id('tournaments')
	},
	returns: v.object({
		tournament: v.object({
			id: v.id('tournaments'),
			name: v.string(),
			code: v.string(),
			description: v.optional(v.string()),
			location: v.optional(v.string()),
			startDate: v.optional(v.number()),
			endDate: v.optional(v.number()),
			registrationDeadline: v.optional(v.number()),
			status: v.optional(tournamentStatusValidator),
			visibility: v.optional(tournamentVisibilityValidator),
			registeredTeams: v.number(),
			teamCapacity: v.optional(v.number()),
			allianceTeamLimit: v.number(),
			phase: v.union(
				v.literal('REGISTRATION_OPEN'),
				v.literal('UPCOMING'),
				v.literal('IN_PROGRESS'),
				v.literal('COMPLETED'),
				v.literal('CLOSED')
			),
			isRegistrationOpen: v.boolean(),
			canEdit: v.boolean(),
			createdAt: v.number(),
			updatedAt: v.number()
		}),
		announcements: v.array(
			v.object({
				id: v.id('tournament_announcements'),
				title: v.string(),
				message: v.string(),
				createdAt: v.number(),
				publishedAt: v.optional(v.number())
			})
		),
		documents: v.array(
			v.object({
				id: v.id('tournament_documents'),
				title: v.string(),
				description: v.optional(v.string()),
				category: v.optional(v.string()),
				url: v.string()
			})
		)
	}),
	handler: async (ctx, args) => {
		const authContext = await loadAuthContext(ctx);
		const appUser = authContext?.appUser ?? null;

		const tournament = await ctx.db.get(args.tournamentId);
		if (!tournament || tournament.deleted_at) {
			throw new Error('Tournament not found');
		}

		const includePrivate = appUser
			? await hasPermission(ctx, appUser._id, 'tournaments.manage_all')
			: false;
		const includeDrafts = includePrivate;

		if (!ensureTournamentVisible(tournament, includeDrafts, includePrivate)) {
			throw new Error('Tournament not available');
		}

		const registrationCount = await countActiveRegistrations(ctx, tournament._id);
		const phase = derivePhase(tournament);
		const canEdit = appUser
			? await hasPermission(ctx, appUser._id, 'tournaments.update', toTournamentScope(tournament._id))
			: false;

		const rawAnnouncements = await ctx.db
			.query('tournament_announcements')
			.withIndex('by_tournament', (q) => q.eq('tournament_id', tournament._id))
			.collect();

		const announcements = rawAnnouncements
			.filter((announcement) => {
				if (announcement.deleted_at) {
					return false;
				}
				if (announcement.is_published) {
					return true;
				}
				return canEdit;
			})
			.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
			.map((announcement) => {
				const entry: {
					id: Id<'tournament_announcements'>;
					title: string;
					message: string;
					createdAt: number;
					publishedAt?: number;
				} = {
					id: announcement._id,
					title: announcement.title,
					message: announcement.message,
					createdAt: announcement.created_at
				};

				if (typeof announcement.published_at === 'number') {
					entry.publishedAt = announcement.published_at;
				}

				return entry;
			});

		const rawDocuments = await ctx.db
			.query('tournament_documents')
			.withIndex('by_tournament', (q) => q.eq('tournament_id', tournament._id))
			.collect();

		const documents = rawDocuments
			.filter((document) => {
				if (document.deleted_at) {
					return false;
				}
				if (document.is_published) {
					return true;
				}
				return canEdit;
			})
			.sort((a, b) => a.title.localeCompare(b.title))
			.map((document) => {
				const entry: {
					id: Id<'tournament_documents'>;
					title: string;
					description?: string;
					category?: string;
					url: string;
				} = {
					id: document._id,
					title: document.title,
					url: document.link_url
				};

				if (document.description) {
					entry.description = document.description;
				}
				if (document.category) {
					entry.category = document.category;
				}

				return entry;
			});

		const tournamentResponse: {
			id: Id<'tournaments'>;
			name: string;
			code: string;
			description?: string;
			location?: string;
			startDate?: number;
			endDate?: number;
			registrationDeadline?: number;
			status?: TournamentStatus;
			visibility?: TournamentVisibility;
			registeredTeams: number;
			teamCapacity?: number;
			allianceTeamLimit: number;
			phase: DerivedPhase;
			isRegistrationOpen: boolean;
			canEdit: boolean;
			createdAt: number;
			updatedAt: number;
		} = {
			id: tournament._id,
			name: tournament.tournament_name,
			code: tournament.tournament_code,
			registeredTeams: registrationCount,
			allianceTeamLimit: tournament.tournament_alliance_team_limit,
			phase,
			isRegistrationOpen: isRegistrationOpen(tournament),
			canEdit,
			createdAt: tournament.created_at,
			updatedAt: tournament.updated_at
		};

		if (tournament.tournament_description) {
			tournamentResponse.description = tournament.tournament_description;
		}
		if (tournament.tournament_location) {
			tournamentResponse.location = tournament.tournament_location;
		}
		if (typeof tournament.start_date === 'number') {
			tournamentResponse.startDate = tournament.start_date;
		}
		if (typeof tournament.end_date === 'number') {
			tournamentResponse.endDate = tournament.end_date;
		}
		if (typeof tournament.registration_deadline === 'number') {
			tournamentResponse.registrationDeadline = tournament.registration_deadline;
		}
		if (tournament.tournament_status) {
			tournamentResponse.status = tournament.tournament_status;
		}
		if (tournament.tournament_visibility) {
			tournamentResponse.visibility = tournament.tournament_visibility;
		}
		if (typeof tournament.team_capacity === 'number') {
			tournamentResponse.teamCapacity = tournament.team_capacity;
		}

		return {
			tournament: tournamentResponse,
			announcements,
			documents
		};
	}
});

export const getTournamentRegistrationContext = query({
	args: {
		tournamentId: v.id('tournaments')
	},
	returns: v.object({
		tournament: v.object({
			id: v.id('tournaments'),
			name: v.string(),
			code: v.string(),
			registrationDeadline: v.optional(v.number()),
			startDate: v.optional(v.number()),
			status: v.optional(tournamentStatusValidator),
			teamCapacity: v.optional(v.number()),
			registeredTeams: v.number(),
			isRegistrationOpen: v.boolean()
		}),
		teams: v.array(
			v.object({
				id: v.id('teams'),
				name: v.string(),
				role: teamRoleValidator,
				alreadyRegistered: v.boolean()
			})
		),
		canManage: v.boolean()
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		const tournament = await ctx.db.get(args.tournamentId);
		if (!tournament || tournament.deleted_at) {
			throw new Error('Tournament not found');
		}

		const registrationCount = await countActiveRegistrations(ctx, tournament._id);
		const memberships = await ctx.db
			.query('team_members')
			.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.collect();

		const teams = [] as Array<{
			id: Id<'teams'>;
			name: string;
			role: (typeof memberships)[number]['role'];
			alreadyRegistered: boolean;
		}>;

		for (const membership of memberships) {
			const team = await ctx.db.get(membership.team_id);
			if (!team) {
				continue;
			}

			const registrations = await ctx.db
				.query('team_tournament_participation')
				.withIndex('by_team_tournament', (q) =>
					q.eq('team_id', membership.team_id).eq('tournament_id', tournament._id)
				)
				.collect();

			const alreadyRegistered = registrations.some(
				(registration) => !registration.deleted_at && registration.is_active !== false
			);

			teams.push({
				id: team._id,
				name: team.team_name,
				role: membership.role,
				alreadyRegistered
			});
		}

		const canManage = await hasPermission(ctx, appUser._id, 'tournaments.manage_participation', {
			tournamentId: tournament._id
		});

		const tournamentResponse: {
			id: Id<'tournaments'>;
			name: string;
			code: string;
			registrationDeadline?: number;
			startDate?: number;
			status?: TournamentStatus;
			teamCapacity?: number;
			registeredTeams: number;
			isRegistrationOpen: boolean;
		} = {
			id: tournament._id,
			name: tournament.tournament_name,
			code: tournament.tournament_code,
			registeredTeams: registrationCount,
			isRegistrationOpen: isRegistrationOpen(tournament)
		};

		if (typeof tournament.registration_deadline === 'number') {
			tournamentResponse.registrationDeadline = tournament.registration_deadline;
		}
		if (typeof tournament.start_date === 'number') {
			tournamentResponse.startDate = tournament.start_date;
		}
		if (tournament.tournament_status) {
			tournamentResponse.status = tournament.tournament_status;
		}
		if (typeof tournament.team_capacity === 'number') {
			tournamentResponse.teamCapacity = tournament.team_capacity;
		}

		return {
			tournament: tournamentResponse,
			teams,
			canManage
		};
	}
});

export const registerTeam = mutation({
	args: {
		tournamentId: v.id('tournaments'),
		teamId: v.id('teams'),
		robotName: v.optional(v.string()),
		robotDescription: v.optional(v.string())
	},
	returns: v.object({
		success: v.boolean(),
		participationId: v.id('team_tournament_participation')
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		const tournament = await ctx.db.get(args.tournamentId);
		if (!tournament || tournament.deleted_at) {
			throw new Error('Tournament not found');
		}

		if (!isRegistrationOpen(tournament)) {
			throw new Error('Registration is closed for this tournament');
		}

		const team = await ctx.db.get(args.teamId);
		if (!team || team.deleted_at) {
			throw new Error('Team not found');
		}

		const membership = await ctx.db
			.query('team_members')
			.withIndex('by_team_user', (q) => q.eq('team_id', args.teamId).eq('user_id', appUser._id))
			.filter((q) => q.eq(q.field('is_active'), true))
			.unique();

		if (!membership) {
			throw new Error('You must be an active member of the team to register it');
		}

		const canJoin = await hasPermission(ctx, appUser._id, 'tournaments.join', {
			tournamentId: tournament._id
		});

		if (!canJoin) {
			throw new Error('You are not allowed to register teams for this tournament');
		}

		const existingRegistrations = await ctx.db
			.query('team_tournament_participation')
			.withIndex('by_team_tournament', (q) =>
				q.eq('team_id', args.teamId).eq('tournament_id', args.tournamentId)
			)
			.collect();

		const alreadyActive = existingRegistrations.find(
			(registration) => !registration.deleted_at && registration.is_active !== false
		);
		if (alreadyActive) {
			throw new Error('This team is already registered for the tournament');
		}

		const activeCount = await countActiveRegistrations(ctx, args.tournamentId);
		if (tournament.team_capacity && activeCount >= tournament.team_capacity) {
			throw new Error('The tournament has reached its team capacity');
		}

		const now = Date.now();
		const robotName = sanitizeOptionalString(args.robotName);
		const robotDescription = sanitizeOptionalString(args.robotDescription);

		const participationInsert: {
			team_id: Id<'teams'>;
			tournament_id: Id<'tournaments'>;
			created_at: number;
			created_by: Id<'users'>;
			updated_at: number;
			updated_by: Id<'users'>;
			registration_date: number;
			is_active: boolean;
			queue_position: number;
			robot_name?: string;
			robot_description?: string;
		} = {
			team_id: args.teamId,
			tournament_id: args.tournamentId,
			created_at: now,
			created_by: appUser._id,
			updated_at: now,
			updated_by: appUser._id,
			registration_date: now,
			is_active: true,
			queue_position: activeCount + 1
		};

		if (robotName) {
			participationInsert.robot_name = robotName;
		}
		if (robotDescription) {
			participationInsert.robot_description = robotDescription;
		}

		const participationId = await ctx.db.insert('team_tournament_participation', participationInsert);

		return {
			success: true,
			participationId
		};
	}
});

export const createTournament = mutation({
	args: {
		name: v.string(),
		code: v.string(),
		description: v.optional(v.string()),
		location: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		registrationDeadline: v.optional(v.number()),
		teamCapacity: v.optional(v.number()),
		status: v.optional(tournamentStatusValidator),
		visibility: v.optional(tournamentVisibilityValidator),
		allianceTeamLimit: v.number()
	},
	returns: v.object({
		tournamentId: v.id('tournaments')
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);
		await requirePermission(ctx, appUser._id, 'tournaments.create');

		const normalizedCode = args.code.trim().toUpperCase();
		if (!normalizedCode) {
			throw new Error('Tournament code is required');
		}

		const existingByCode = await ctx.db
			.query('tournaments')
			.withIndex('by_code', (q) => q.eq('tournament_code', normalizedCode))
			.unique();

		if (existingByCode) {
			throw new Error('Tournament code already exists');
		}

		const now = Date.now();

		const description = sanitizeOptionalString(args.description);
		const location = sanitizeOptionalString(args.location);
		const tournamentInsert: {
			created_at: number;
			created_by: Id<'users'>;
			tournament_alliance_team_limit: number;
			tournament_code: string;
			tournament_name: string;
			tournament_owner_id: Id<'users'>;
			tournament_status: TournamentStatus | 'DRAFT';
			tournament_visibility: TournamentVisibility | 'PUBLIC';
			updated_at: number;
			updated_by: Id<'users'>;
			tournament_description?: string;
			tournament_location?: string;
			registration_deadline?: number;
			start_date?: number;
			end_date?: number;
			team_capacity?: number;
		} = {
			created_at: now,
			created_by: appUser._id,
			tournament_alliance_team_limit: args.allianceTeamLimit,
			tournament_code: normalizedCode,
			tournament_name: args.name.trim(),
			tournament_owner_id: appUser._id,
			tournament_status: args.status ?? 'DRAFT',
			tournament_visibility: args.visibility ?? 'PUBLIC',
			updated_at: now,
			updated_by: appUser._id
		};

		if (description) {
			tournamentInsert.tournament_description = description;
		}
		if (location) {
			tournamentInsert.tournament_location = location;
		}
		if (typeof args.registrationDeadline === 'number') {
			tournamentInsert.registration_deadline = args.registrationDeadline;
		}
		if (typeof args.startDate === 'number') {
			tournamentInsert.start_date = args.startDate;
		}
		if (typeof args.endDate === 'number') {
			tournamentInsert.end_date = args.endDate;
		}
		if (typeof args.teamCapacity === 'number') {
			tournamentInsert.team_capacity = args.teamCapacity;
		}

		const tournamentId = await ctx.db.insert('tournaments', tournamentInsert);

		return {
			tournamentId
		};
	}
});

export const updateTournament = mutation({
	args: {
		tournamentId: v.id('tournaments'),
		name: v.string(),
		code: v.string(),
		description: v.optional(v.string()),
		location: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		registrationDeadline: v.optional(v.number()),
		teamCapacity: v.optional(v.number()),
		status: v.optional(tournamentStatusValidator),
		visibility: v.optional(tournamentVisibilityValidator),
		allianceTeamLimit: v.number()
	},
	returns: v.object({
		success: v.boolean()
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		await requirePermission(ctx, appUser._id, 'tournaments.update', {
			tournamentId: args.tournamentId
		});

		const tournament = await ctx.db.get(args.tournamentId);
		if (!tournament || tournament.deleted_at) {
			throw new Error('Tournament not found');
		}

		const normalizedCode = args.code.trim().toUpperCase();
		const existingByCode = await ctx.db
			.query('tournaments')
			.withIndex('by_code', (q) => q.eq('tournament_code', normalizedCode))
			.collect();

		if (
			existingByCode.some(
				(existing) => existing._id !== tournament._id && !existing.deleted_at
			)
		) {
			throw new Error('Another tournament uses this code');
		}

		const now = Date.now();

		const updatedDescription = sanitizeOptionalString(args.description);
		const updatedLocation = sanitizeOptionalString(args.location);
		const patch: {
			tournament_name: string;
			tournament_code: string;
			tournament_description?: string;
			tournament_location?: string;
			start_date?: number;
			end_date?: number;
			registration_deadline?: number;
			team_capacity?: number;
			tournament_status: TournamentStatus | 'DRAFT';
			tournament_visibility: TournamentVisibility | 'PUBLIC';
			tournament_alliance_team_limit: number;
			updated_at: number;
			updated_by: Id<'users'>;
		} = {
			tournament_name: args.name.trim(),
			tournament_code: normalizedCode,
			tournament_status: args.status ?? tournament.tournament_status ?? 'DRAFT',
			tournament_visibility: args.visibility ?? tournament.tournament_visibility ?? 'PUBLIC',
			tournament_alliance_team_limit: args.allianceTeamLimit,
			updated_at: now,
			updated_by: appUser._id
		};

		if (updatedDescription) {
			patch.tournament_description = updatedDescription;
		} else if (tournament.tournament_description) {
			patch.tournament_description = undefined;
		}

		if (updatedLocation) {
			patch.tournament_location = updatedLocation;
		} else if (tournament.tournament_location) {
			patch.tournament_location = undefined;
		}

		if (typeof args.startDate === 'number') {
			patch.start_date = args.startDate;
		} else if (typeof tournament.start_date === 'number') {
			patch.start_date = undefined;
		}

		if (typeof args.endDate === 'number') {
			patch.end_date = args.endDate;
		} else if (typeof tournament.end_date === 'number') {
			patch.end_date = undefined;
		}

		if (typeof args.registrationDeadline === 'number') {
			patch.registration_deadline = args.registrationDeadline;
		} else if (typeof tournament.registration_deadline === 'number') {
			patch.registration_deadline = undefined;
		}

		if (typeof args.teamCapacity === 'number') {
			patch.team_capacity = args.teamCapacity;
		} else if (typeof tournament.team_capacity === 'number') {
			patch.team_capacity = undefined;
		}

		await ctx.db.patch(args.tournamentId, patch);

		return { success: true };
	}
});

export const getTournamentEditorContext = query({
	args: {
		tournamentId: v.id('tournaments')
	},
	returns: v.object({
		tournament: v.object({
			id: v.id('tournaments'),
			name: v.string(),
			code: v.string(),
			description: v.optional(v.string()),
			location: v.optional(v.string()),
			startDate: v.optional(v.number()),
			endDate: v.optional(v.number()),
			registrationDeadline: v.optional(v.number()),
			status: v.optional(tournamentStatusValidator),
			visibility: v.optional(tournamentVisibilityValidator),
			teamCapacity: v.optional(v.number()),
			allianceTeamLimit: v.number(),
			registeredTeams: v.number()
		}),
		announcements: v.array(
			v.object({
				id: v.id('tournament_announcements'),
				title: v.string(),
				message: v.string(),
				isPublished: v.boolean(),
				createdAt: v.number()
			})
		),
		documents: v.array(
			v.object({
				id: v.id('tournament_documents'),
				title: v.string(),
				description: v.optional(v.string()),
				category: v.optional(v.string()),
				url: v.string(),
				isPublished: v.boolean()
			})
		)
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		await requirePermission(ctx, appUser._id, 'tournaments.update', {
			tournamentId: args.tournamentId
		});

		const tournament = await ctx.db.get(args.tournamentId);
		if (!tournament || tournament.deleted_at) {
			throw new Error('Tournament not found');
		}

		const registeredTeams = await countActiveRegistrations(ctx, tournament._id);

		const announcements = await ctx.db
			.query('tournament_announcements')
			.withIndex('by_tournament', (q) => q.eq('tournament_id', tournament._id))
			.collect();

		const documents = await ctx.db
			.query('tournament_documents')
			.withIndex('by_tournament', (q) => q.eq('tournament_id', tournament._id))
			.collect();

		const tournamentResponse: {
			id: Id<'tournaments'>;
			name: string;
			code: string;
			description?: string;
			location?: string;
			startDate?: number;
			endDate?: number;
			registrationDeadline?: number;
			status?: TournamentStatus;
			visibility?: TournamentVisibility;
			teamCapacity?: number;
			allianceTeamLimit: number;
			registeredTeams: number;
		} = {
			id: tournament._id,
			name: tournament.tournament_name,
			code: tournament.tournament_code,
			allianceTeamLimit: tournament.tournament_alliance_team_limit,
			registeredTeams
		};

		if (tournament.tournament_description) {
			tournamentResponse.description = tournament.tournament_description;
		}
		if (tournament.tournament_location) {
			tournamentResponse.location = tournament.tournament_location;
		}
		if (typeof tournament.start_date === 'number') {
			tournamentResponse.startDate = tournament.start_date;
		}
		if (typeof tournament.end_date === 'number') {
			tournamentResponse.endDate = tournament.end_date;
		}
		if (typeof tournament.registration_deadline === 'number') {
			tournamentResponse.registrationDeadline = tournament.registration_deadline;
		}
		if (tournament.tournament_status) {
			tournamentResponse.status = tournament.tournament_status;
		}
		if (tournament.tournament_visibility) {
			tournamentResponse.visibility = tournament.tournament_visibility;
		}
		if (typeof tournament.team_capacity === 'number') {
			tournamentResponse.teamCapacity = tournament.team_capacity;
		}

		return {
			tournament: tournamentResponse,
			announcements: announcements
				.filter((announcement) => !announcement.deleted_at)
				.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
				.map((announcement) => ({
					id: announcement._id,
					title: announcement.title,
					message: announcement.message,
					isPublished: announcement.is_published,
					createdAt: announcement.created_at
				})),
			documents: documents
				.filter((document) => !document.deleted_at)
				.sort((a, b) => a.title.localeCompare(b.title))
				.map((document) => {
					const entry: {
						id: Id<'tournament_documents'>;
						title: string;
						description?: string;
						category?: string;
						url: string;
						isPublished: boolean;
					} = {
						id: document._id,
						title: document.title,
						url: document.link_url,
						isPublished: document.is_published
					};

					if (document.description) {
						entry.description = document.description;
					}
					if (document.category) {
						entry.category = document.category;
					}

					return entry;
				})
		};
	}
});

export const createTournamentAnnouncement = mutation({
	args: {
		tournamentId: v.id('tournaments'),
		title: v.string(),
		message: v.string(),
		publish: v.optional(v.boolean())
	},
	returns: v.object({
		announcementId: v.id('tournament_announcements')
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		await requirePermission(ctx, appUser._id, 'tournaments.update', {
			tournamentId: args.tournamentId
		});

		const tournament = await ctx.db.get(args.tournamentId);
		if (!tournament || tournament.deleted_at) {
			throw new Error('Tournament not found');
		}

		const now = Date.now();
		const announcementInsert: {
			created_at: number;
			created_by: Id<'users'>;
			is_published: boolean;
			message: string;
			title: string;
			tournament_id: Id<'tournaments'>;
			updated_at: number;
			updated_by: Id<'users'>;
			published_at?: number;
		} = {
			created_at: now,
			created_by: appUser._id,
			is_published: args.publish ?? false,
			message: args.message.trim(),
			title: args.title.trim(),
			tournament_id: args.tournamentId,
			updated_at: now,
			updated_by: appUser._id
		};

		if (announcementInsert.is_published) {
			announcementInsert.published_at = now;
		}

		const announcementId = await ctx.db.insert('tournament_announcements', announcementInsert);

		return {
			announcementId
		};
	}
});

export const deleteTournamentAnnouncement = mutation({
	args: {
		announcementId: v.id('tournament_announcements')
	},
	returns: v.object({
		success: v.boolean()
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		const announcement = await ctx.db.get(args.announcementId);
		if (!announcement || announcement.deleted_at) {
			return { success: true };
		}

		await requirePermission(ctx, appUser._id, 'tournaments.update', {
			tournamentId: announcement.tournament_id
		});

		const now = Date.now();
		await ctx.db.patch(args.announcementId, {
			deleted_at: now,
			updated_at: now,
			updated_by: appUser._id
		});

		return { success: true };
	}
});

export const createTournamentDocument = mutation({
	args: {
		tournamentId: v.id('tournaments'),
		title: v.string(),
		url: v.string(),
		description: v.optional(v.string()),
		category: v.optional(v.string()),
		publish: v.optional(v.boolean())
	},
	returns: v.object({
		documentId: v.id('tournament_documents')
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		await requirePermission(ctx, appUser._id, 'tournaments.update', {
			tournamentId: args.tournamentId
		});

		const tournament = await ctx.db.get(args.tournamentId);
		if (!tournament || tournament.deleted_at) {
			throw new Error('Tournament not found');
		}

		const now = Date.now();
		const category = sanitizeOptionalString(args.category);
		const description = sanitizeOptionalString(args.description);
		const documentInsert: {
			created_at: number;
			created_by: Id<'users'>;
			is_published: boolean;
			link_url: string;
			title: string;
			tournament_id: Id<'tournaments'>;
			updated_at: number;
			updated_by: Id<'users'>;
			category?: string;
			description?: string;
		} = {
			created_at: now,
			created_by: appUser._id,
			is_published: args.publish ?? true,
			link_url: args.url.trim(),
			title: args.title.trim(),
			tournament_id: args.tournamentId,
			updated_at: now,
			updated_by: appUser._id
		};

		if (category) {
			documentInsert.category = category;
		}
		if (description) {
			documentInsert.description = description;
		}

		const documentId = await ctx.db.insert('tournament_documents', documentInsert);

		return {
			documentId
		};
	}
});

export const deleteTournamentDocument = mutation({
	args: {
		documentId: v.id('tournament_documents')
	},
	returns: v.object({
		success: v.boolean()
	}),
	handler: async (ctx, args) => {
		const { appUser } = await requireAuthContext(ctx);

		const document = await ctx.db.get(args.documentId);
		if (!document || document.deleted_at) {
			return { success: true };
		}

		await requirePermission(ctx, appUser._id, 'tournaments.update', {
			tournamentId: document.tournament_id
		});

		const now = Date.now();
		await ctx.db.patch(args.documentId, {
			deleted_at: now,
			updated_at: now,
			updated_by: appUser._id
		});

		return { success: true };
	}
});
