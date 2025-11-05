import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Convex schema for RMS (Robotics Management System)
 *
 * This schema defines application-specific tables. Better Auth tables are handled
 * by the betterAuth component in convex/betterAuth/schema.ts
 *
 * Key concepts:
 * - Teams act as the primary organizational unit (mapped to Better Auth "organizations")
 * - Role system managed by Better Auth:
 *   1. Team roles: TEAM_MENTOR, TEAM_LEADER, TEAM_MEMBER, COMMON (scoped to teams via organization membership)
 *   2. Global roles: ADMIN (managed by Better Auth admin plugin)
 * - Permissions are defined in auth.ts and enforced via Better Auth access control
 */

const schema = defineSchema({
	// ==================== Application Tables ====================

	/**
	 * Counters table - for generating sequential numbers (team numbers, etc.)
	 * Uses atomic operations for efficient, conflict-free increments
	 */
	counters: defineTable({
		name: v.string(), // e.g., 'team_number'
		value: v.number(), // Current counter value
		updated_at: v.number()
	})
		.index('by_name', ['name']),

	/**
	 * Application users table - the main user records for the app
	 * Links to Better Auth user table via authId
	 */
	users: defineTable({
		authId: v.string(),
		avatarUrl: v.optional(v.string()),
		createdAt: v.number(),
		dateOfBirth: v.optional(v.number()),
		email: v.string(),
		fullName: v.optional(v.string()),
		isActive: v.optional(v.boolean()),
		lastLoginAt: v.optional(v.number()),
		location: v.optional(v.string()),
		phone: v.optional(v.string()),
		updatedAt: v.number(),
		userType: v.optional(v.union(v.literal('REGULAR'), v.literal('ORG')))
	})
		.index('authId', ['authId'])
		.index('email', ['email']),

	// ==================== Team Management (Organization Plugin) ====================

	/**
	 * Teams table - acts as Better Auth "organizations"
	 * The primary organizational unit in the system
	 */
	teams: defineTable({
		created_at: v.number(),
		created_by: v.id('users'),
		deleted_at: v.optional(v.number()),
		location: v.string(),
		max_members: v.number(),
		status: v.union(
			v.literal('DRAFT'),
			v.literal('ACTIVE'),
			v.literal('COMPLETED'),
			v.literal('ARCHIVED')
		),
		team_descriptions: v.optional(v.string()),
		team_image_url: v.optional(v.string()),
		team_name: v.string(),
		team_number: v.string(),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	}).index('by_team_number', ['team_number']),

	/**
	 * Team members - organization membership with team-scoped roles
	 * Maps to Better Auth organization "member" table
	 */
	team_members: defineTable({
		created_at: v.number(),
		deleted_at: v.optional(v.number()),
		is_active: v.boolean(),
		joined_at: v.number(),
		notes: v.optional(v.string()),
		role: v.union(
			v.literal('TEAM_MENTOR'),
			v.literal('TEAM_LEADER'),
			v.literal('TEAM_MEMBER'),
			v.literal('COMMON')
		),
		team_id: v.id('teams'),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users')),
		user_id: v.id('users')
	})
		.index('by_team_user', ['team_id', 'user_id'])
		.index('by_user', ['user_id']),

	/**
	 * Team invitations - invite users to join teams
	 * Maps to Better Auth organization "invitation" table
	 */
	team_invitations: defineTable({
		created_at: v.number(),
		deleted_at: v.optional(v.number()),
		expires_at: v.number(),
		invitation_token: v.string(),
		invited_by_user_id: v.id('users'),
		invited_role: v.union(
			v.literal('TEAM_MENTOR'),
			v.literal('TEAM_LEADER'),
			v.literal('TEAM_MEMBER'),
			v.literal('COMMON')
		),
		invited_user_id: v.id('users'),
		message: v.optional(v.string()),
		responded_at: v.optional(v.number()),
		status: v.union(
			v.literal('PENDING'),
			v.literal('ACCEPTED'),
			v.literal('REJECTED'),
			v.literal('CANCELLED'),
			v.literal('EXPIRED')
		),
		team_id: v.id('teams'),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_token', ['invitation_token'])
		.index('by_team', ['team_id'])
		.index('by_user', ['invited_user_id']),


	// ==================== Tournament Management ====================

	/**
	 * Tournaments - competition events
	 */
	tournaments: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		tournament_alliance_team_limit: v.number(),
		tournament_code: v.string(),
		tournament_description: v.optional(v.string()),
		tournament_name: v.string(),
		tournament_owner_id: v.id('users'),
		tournament_scoring_profile: v.optional(v.id('scoring_profiles')),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	}).index('by_code', ['tournament_code']),

	/**
	 * Team tournament participation - tracks which teams are registered for tournaments
	 */
	team_tournament_participation: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		is_active: v.boolean(),
		queue_position: v.optional(v.number()),
		registration_date: v.number(),
		robot_description: v.optional(v.string()),
		robot_name: v.optional(v.string()),
		team_id: v.id('teams'),
		tournament_id: v.id('tournaments'),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_team_tournament', ['team_id', 'tournament_id'])
		.index('by_tournament', ['tournament_id']),

	/**
	 * Stages - tournament stages (qualification, playoffs, etc.)
	 */
	stages: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		stage_name: v.string(),
		stage_order: v.number(),
		stage_tournament: v.id('tournaments'),
		stage_type: v.union(
			v.literal('ROUND_ROBIN'),
			v.literal('SWISS_ROUND'),
			v.literal('PLAYOFF_ROUND'),
			v.literal('DOUBLE_ELIMINATION')
		),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	}).index('by_tournament', ['stage_tournament']),

	/**
	 * Fields - physical competition fields/arenas
	 */
	fields: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		field_description: v.optional(v.string()),
		field_name: v.string(),
		field_tournament: v.id('tournaments'),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	}).index('by_tournament', ['field_tournament']),

	// ==================== Match Management ====================

	/**
	 * Matches - individual competition matches
	 */
	matches: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		match_code: v.string(),
		match_field: v.id('fields'),
		match_scoring_profile: v.optional(v.id('scoring_profiles')),
		match_stage: v.id('stages'),
		match_start_time: v.optional(v.number()),
		match_status: v.union(
			v.literal('SCHEDULED'),
			v.literal('QUEUEING'),
			v.literal('IN_PROGRESS'),
			v.literal('COMPLETED'),
			v.literal('CANCELLED')
		),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_code', ['match_code'])
		.index('by_stage', ['match_stage'])
		.index('by_status', ['match_status']),

	/**
	 * Team alliances - groups of teams competing together in a match
	 */
	team_alliances: defineTable({
		alliance_color: v.union(v.literal('RED'), v.literal('BLUE')),
		alliance_match: v.id('matches'),
		alliance_score: v.number(),
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	}).index('by_match_color', ['alliance_match', 'alliance_color']),

	/**
	 * Team alliance members - which teams are in which alliances
	 */
	team_alliance_members: defineTable({
		alliance_id: v.id('team_alliances'),
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		team_id: v.id('teams'),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_alliance_team', ['alliance_id', 'team_id'])
		.index('by_alliance', ['alliance_id']),

	// ==================== Scoring ====================

	/**
	 * Scoring profiles - define how matches are scored
	 */
	scoring_profiles: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		profile_description: v.optional(v.string()),
		profile_name: v.string(),
		profile_rules: v.any(),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	}),

	/**
	 * Match scores - scores for alliances in matches
	 */
	match_scores: defineTable({
		alliance_id: v.id('team_alliances'),
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		finalized_at: v.optional(v.number()),
		finalized_by: v.optional(v.id('users')),
		match_id: v.id('matches'),
		score_breakdown: v.optional(v.any()),
		score_keeper: v.optional(v.id('users')),
		score_type: v.union(v.literal('draft'), v.literal('final')),
		total_score: v.number(),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_match_alliance_type', ['match_id', 'alliance_id', 'score_type'])
		.index('by_match', ['match_id']),

	/**
	 * Penalties - rule violations and point deductions
	 */
	penalties: defineTable({
		alliance_id: v.optional(v.id('team_alliances')),
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		issued_at: v.number(),
		issued_by: v.optional(v.id('users')),
		match_id: v.id('matches'),
		penalty_description: v.optional(v.string()),
		penalty_points: v.number(),
		penalty_type: v.string(),
		team_id: v.optional(v.id('teams')),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_match', ['match_id'])
		.index('by_team', ['team_id']),

	// ==================== Officials & Queue Management ====================

	/**
	 * Referees - tournament officials assigned to matches/fields
	 */
	referees: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		referee_field: v.optional(v.id('fields')),
		referee_match: v.optional(v.id('matches')),
		referee_org_user: v.id('users'),
		referee_role: v.union(
			v.literal('HEAD_REFEREE'),
			v.literal('SCORE_KEEPER'),
			v.literal('TOURNAMENT_SCORING_OFFICER'),
			v.literal('QUEUE_MANAGER')
		),
		referee_tournament: v.id('tournaments'),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_tournament', ['referee_tournament'])
		.index('by_match', ['referee_match']),

	/**
	 * Queue status - tracks team readiness for matches
	 */
	queue_status: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		participation_id: v.id('team_tournament_participation'),
		queue_notes: v.optional(v.string()),
		queue_status: v.union(
			v.literal('waiting'),
			v.literal('ready'),
			v.literal('in_queue'),
			v.literal('completed')
		),
		queued_at: v.number(),
		queued_by: v.optional(v.id('users')),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	}).index('by_participation', ['participation_id']),

	// ==================== Audience & Activity ====================

	/**
	 * Audience display - content shown to spectators
	 */
	audience_display: defineTable({
		created_at: v.number(),
		created_by: v.optional(v.id('users')),
		deleted_at: v.optional(v.number()),
		display_content: v.optional(v.any()),
		display_order: v.number(),
		display_title: v.optional(v.string()),
		display_type: v.string(),
		is_active: v.boolean(),
		match_id: v.optional(v.id('matches')),
		tournament_id: v.id('tournaments'),
		updated_at: v.number(),
		updated_by: v.optional(v.id('users'))
	})
		.index('by_tournament', ['tournament_id'])
		.index('by_tournament_order', ['tournament_id', 'display_order']),

	/**
	 * Activity logs - audit trail for system changes
	 */
	activity_logs: defineTable({
		action: v.union(v.literal('INSERT'), v.literal('UPDATE'), v.literal('DELETE')),
		created_at: v.number(),
		entity_id: v.optional(v.string()),
		entity_type: v.string(),
		ip_address: v.optional(v.string()),
		match_id: v.optional(v.id('matches')),
		new_values: v.optional(v.any()),
		old_values: v.optional(v.any()),
		team_id: v.optional(v.id('teams')),
		tournament_id: v.optional(v.id('tournaments')),
		user_agent: v.optional(v.string()),
		user_id: v.optional(v.id('users'))
	})
		.index('by_user', ['user_id'])
		.index('by_entity', ['entity_type', 'entity_id'])
		.index('by_tournament', ['tournament_id'])
});

export default schema;
