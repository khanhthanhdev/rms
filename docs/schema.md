import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  account: defineTable({
    accessToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(
      v.union(v.null(), v.float64())
    ),
    accountId: v.string(),
    createdAt: v.float64(),
    idToken: v.optional(v.union(v.null(), v.string())),
    password: v.optional(v.union(v.null(), v.string())),
    providerId: v.string(),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    refreshTokenExpiresAt: v.optional(
      v.union(v.null(), v.float64())
    ),
    scope: v.optional(v.union(v.null(), v.string())),
    updatedAt: v.float64(),
    userId: v.string(),
  })
    .index("accountId", ["accountId"])
    .index("accountId_providerId", [
      "accountId",
      "providerId",
    ])
    .index("providerId_userId", ["providerId", "userId"])
    .index("userId", ["userId"]),
  activity_logs: defineTable({
    action: v.union(
      v.literal("INSERT"),
      v.literal("UPDATE"),
      v.literal("DELETE")
    ),
    created_at: v.float64(),
    entity_id: v.optional(v.string()),
    entity_type: v.string(),
    id: v.id("activity_logs"),
    ip_address: v.optional(v.string()),
    match_id: v.optional(v.id("matches")),
    new_values: v.optional(v.any()),
    old_values: v.optional(v.any()),
    team_id: v.optional(v.id("teams")),
    tournament_id: v.optional(v.id("tournaments")),
    user_agent: v.optional(v.string()),
    user_id: v.optional(v.id("users")),
  }),
  audience_display: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    display_content: v.optional(v.any()),
    display_order: v.float64(),
    display_title: v.optional(v.string()),
    display_type: v.string(),
    id: v.id("audience_display"),
    is_active: v.boolean(),
    match_id: v.optional(v.id("matches")),
    tournament_id: v.id("tournaments"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }),
  fields: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    field_description: v.optional(v.string()),
    field_name: v.string(),
    field_tournament: v.id("tournaments"),
    id: v.id("fields"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }),
  jwks: defineTable({
    createdAt: v.float64(),
    privateKey: v.string(),
    publicKey: v.string(),
  }),
  match_scores: defineTable({
    alliance_id: v.id("team_alliances"),
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    finalized_at: v.optional(v.float64()),
    finalized_by: v.optional(v.id("users")),
    id: v.id("match_scores"),
    match_id: v.id("matches"),
    score_breakdown: v.optional(v.any()),
    score_keeper: v.optional(v.id("users")),
    score_type: v.union(
      v.literal("draft"),
      v.literal("final")
    ),
    total_score: v.float64(),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_match_alliance_type", [
    "match_id",
    "alliance_id",
    "score_type",
  ]),
  matches: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("matches"),
    match_code: v.string(),
    match_field: v.id("fields"),
    match_scoring_profile: v.optional(
      v.id("scoring_profiles")
    ),
    match_stage: v.id("stages"),
    match_start_time: v.optional(v.float64()),
    match_status: v.union(
      v.literal("SCHEDULED"),
      v.literal("QUEUEING"),
      v.literal("IN_PROGRESS"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED")
    ),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_code", ["match_code"]),
  org_user_roles: defineTable({
    created_at: v.float64(),
    id: v.id("org_user_roles"),
    org_role: v.union(
      v.literal("ADMIN"),
      v.literal("TOURNAMENT_SCORING_OFFICER"),
      v.literal("HEAD_REFEREE"),
      v.literal("SCORE_KEEPER"),
      v.literal("QUEUE_MANAGER")
    ),
    org_user_id: v.id("users"),
  }).index("by_org_user", ["org_user_id"]),
  penalties: defineTable({
    alliance_id: v.optional(v.id("team_alliances")),
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("penalties"),
    issued_at: v.float64(),
    issued_by: v.optional(v.id("users")),
    match_id: v.id("matches"),
    penalty_description: v.optional(v.string()),
    penalty_points: v.float64(),
    penalty_type: v.string(),
    team_id: v.optional(v.id("teams")),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }),
  queue_status: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("queue_status"),
    participation_id: v.id("team_tournament_participation"),
    queue_notes: v.optional(v.string()),
    queue_status: v.union(
      v.literal("waiting"),
      v.literal("ready"),
      v.literal("in_queue"),
      v.literal("completed")
    ),
    queued_at: v.float64(),
    queued_by: v.optional(v.id("users")),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }),
  referees: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("referees"),
    referee_field: v.optional(v.id("fields")),
    referee_match: v.optional(v.id("matches")),
    referee_org_user: v.id("users"),
    referee_role: v.union(
      v.literal("HEAD_REFEREE"),
      v.literal("SCORE_KEEPER"),
      v.literal("TOURNAMENT_SCORING_OFFICER"),
      v.literal("QUEUE_MANAGER")
    ),
    referee_tournament: v.id("tournaments"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }),
  role_permissions: defineTable({
    created_at: v.float64(),
    id: v.id("role_permissions"),
    org_role: v.optional(
      v.union(
        v.literal("ADMIN"),
        v.literal("TOURNAMENT_SCORING_OFFICER"),
        v.literal("HEAD_REFEREE"),
        v.literal("SCORE_KEEPER"),
        v.literal("QUEUE_MANAGER")
      )
    ),
    permission: v.union(
      v.literal("teams.create"),
      v.literal("teams.update"),
      v.literal("teams.delete"),
      v.literal("teams.view_all"),
      v.literal("team_members.invite"),
      v.literal("team_members.remove"),
      v.literal("team_members.manage_roles"),
      v.literal("tournaments.view"),
      v.literal("tournaments.participate"),
      v.literal("tournaments.join"),
      v.literal("tournaments.manage_participation"),
      v.literal("matches.view"),
      v.literal("stages.view"),
      v.literal("tournaments.create"),
      v.literal("tournaments.update"),
      v.literal("tournaments.delete"),
      v.literal("tournaments.manage_all"),
      v.literal("matches.create"),
      v.literal("matches.update"),
      v.literal("matches.delete"),
      v.literal("matches.manage_all"),
      v.literal("fields.manage"),
      v.literal("stages.manage"),
      v.literal("referees.assign"),
      v.literal("scoring_profiles.manage"),
      v.literal("alliances.manage"),
      v.literal("queue.manage"),
      v.literal("scores.edit_draft"),
      v.literal("scores.finalize"),
      v.literal("penalties.manage"),
      v.literal("audience.control"),
      v.literal("users.view_all"),
      v.literal("users.manage_roles")
    ),
    role: v.optional(
      v.union(
        v.literal("TEAM_MENTOR"),
        v.literal("TEAM_LEADER"),
        v.literal("TEAM_MEMBER"),
        v.literal("COMMON")
      )
    ),
  })
    .index("by_org_role", ["org_role"])
    .index("by_role", ["role"]),
  scoring_profiles: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("scoring_profiles"),
    profile_description: v.optional(v.string()),
    profile_name: v.string(),
    profile_rules: v.any(),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }),
  session: defineTable({
    activeOrganizationId: v.optional(
      v.union(v.null(), v.string())
    ),
    createdAt: v.float64(),
    expiresAt: v.float64(),
    impersonatedBy: v.optional(
      v.union(v.null(), v.string())
    ),
    ipAddress: v.optional(v.union(v.null(), v.string())),
    token: v.string(),
    updatedAt: v.float64(),
    userAgent: v.optional(v.union(v.null(), v.string())),
    userId: v.string(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("expiresAt_userId", ["expiresAt", "userId"])
    .index("token", ["token"])
    .index("userId", ["userId"]),
  stages: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("stages"),
    stage_name: v.string(),
    stage_order: v.float64(),
    stage_tournament: v.id("tournaments"),
    stage_type: v.union(
      v.literal("ROUND_ROBIN"),
      v.literal("SWISS_ROUND"),
      v.literal("PLAYOFF_ROUND"),
      v.literal("DOUBLE_ELIMINATION")
    ),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }),
  team_alliance_members: defineTable({
    alliance_id: v.id("team_alliances"),
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("team_alliance_members"),
    team_id: v.id("teams"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_alliance_team", ["alliance_id", "team_id"]),
  team_alliances: defineTable({
    alliance_color: v.union(
      v.literal("RED"),
      v.literal("BLUE")
    ),
    alliance_match: v.id("matches"),
    alliance_score: v.float64(),
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("team_alliances"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_match_color", [
    "alliance_match",
    "alliance_color",
  ]),
  team_invitations: defineTable({
    created_at: v.float64(),
    deleted_at: v.optional(v.float64()),
    expires_at: v.float64(),
    id: v.id("team_invitations"),
    invitation_token: v.string(),
    invited_by_user_id: v.id("users"),
    invited_role: v.union(
      v.literal("TEAM_MENTOR"),
      v.literal("TEAM_LEADER"),
      v.literal("TEAM_MEMBER"),
      v.literal("COMMON")
    ),
    invited_user_id: v.id("users"),
    message: v.optional(v.string()),
    responded_at: v.optional(v.float64()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("ACCEPTED"),
      v.literal("REJECTED"),
      v.literal("CANCELLED"),
      v.literal("EXPIRED")
    ),
    team_id: v.id("teams"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_token", ["invitation_token"]),
  team_members: defineTable({
    created_at: v.float64(),
    deleted_at: v.optional(v.float64()),
    id: v.id("team_members"),
    is_active: v.boolean(),
    joined_at: v.float64(),
    notes: v.optional(v.string()),
    role: v.union(
      v.literal("TEAM_MENTOR"),
      v.literal("TEAM_LEADER"),
      v.literal("TEAM_MEMBER"),
      v.literal("COMMON")
    ),
    team_id: v.id("teams"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("user")),
    user_id: v.id("users"),
  }).index("by_team_user", ["team_id", "user_id"]),
  team_tournament_participation: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("team_tournament_participation"),
    is_active: v.boolean(),
    queue_position: v.optional(v.float64()),
    registration_date: v.float64(),
    robot_description: v.optional(v.string()),
    robot_name: v.optional(v.string()),
    team_id: v.id("teams"),
    tournament_id: v.id("tournaments"),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_team_tournament", [
    "team_id",
    "tournament_id",
  ]),
  teams: defineTable({
    created_at: v.float64(),
    created_by: v.id("users"),
    deleted_at: v.optional(v.float64()),
    id: v.id("teams"),
    location: v.string(),
    max_members: v.float64(),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("ACTIVE"),
      v.literal("COMPLETED"),
      v.literal("ARCHIVED")
    ),
    team_descriptions: v.optional(v.string()),
    team_image_url: v.optional(v.string()),
    team_name: v.string(),
    team_number: v.string(),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_team_number", ["team_number"]),
  tournaments: defineTable({
    created_at: v.float64(),
    created_by: v.optional(v.id("users")),
    deleted_at: v.optional(v.float64()),
    id: v.id("tournaments"),
    tournament_alliance_team_limit: v.float64(),
    tournament_code: v.string(),
    tournament_description: v.optional(v.string()),
    tournament_name: v.string(),
    tournament_owner_id: v.id("users"),
    tournament_scoring_profile: v.optional(
      v.id("scoring_profiles")
    ),
    updated_at: v.float64(),
    updated_by: v.optional(v.id("users")),
  }).index("by_code", ["tournament_code"]),
  user: defineTable({
    avatarUrl: v.optional(v.string()),
    createdAt: v.float64(),
    dateOfBirth: v.optional(v.float64()),
    email: v.string(),
    emailVerified: v.boolean(),
    fullName: v.optional(v.string()),
    image: v.optional(v.union(v.null(), v.string())),
    isActive: v.optional(v.boolean()),
    lastLoginAt: v.optional(v.float64()),
    location: v.optional(v.string()),
    name: v.string(),
    phone: v.optional(v.string()),
    updatedAt: v.float64(),
    userId: v.optional(v.union(v.null(), v.string())),
    userType: v.optional(
      v.union(v.literal("REGULAR"), v.literal("ORG"))
    ),
  })
    .index("email_name", ["email", "name"])
    .index("name", ["name"])
    .index("userId", ["userId"]),
  user_roles: defineTable({
    created_at: v.float64(),
    id: v.id("user_roles"),
    role: v.union(
      v.literal("TEAM_MENTOR"),
      v.literal("TEAM_LEADER"),
      v.literal("TEAM_MEMBER"),
      v.literal("COMMON")
    ),
    user_id: v.id("users"),
  }).index("by_user", ["user_id"]),
  users: defineTable({
    authId: v.string(),
    avatarUrl: v.optional(v.string()),
    createdAt: v.float64(),
    dateOfBirth: v.optional(v.float64()),
    email: v.string(),
    fullName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    lastLoginAt: v.optional(v.float64()),
    location: v.optional(v.string()),
    phone: v.optional(v.string()),
    updatedAt: v.float64(),
    userType: v.optional(
      v.union(v.literal("REGULAR"), v.literal("ORG"))
    ),
  })
    .index("authId", ["authId"])
    .index("email", ["email"]),
  verification: defineTable({
    createdAt: v.float64(),
    expiresAt: v.float64(),
    identifier: v.string(),
    updatedAt: v.float64(),
    value: v.string(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("identifier", ["identifier"]),
});