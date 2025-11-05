import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from './_generated/api';
import { type DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import { betterAuth } from 'better-auth';
import { admin, organization } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import authSchema from './betterAuth/schema';

const siteUrl = process.env.SITE_URL!;

type BetterAuthUseApi = Parameters<typeof createClient>[0];

const betterAuthComponent = (components as { betterAuth: BetterAuthUseApi }).betterAuth;

export const APP_ROLE_VALUES = [
	'ADMIN',
	'TSO',
	'HEAD_REFEREE',
	'SCORE_KEEPER',
	'QUEUER',
	'TEAM_MENTOR',
	'TEAM_LEADER',
	'TEAM_MEMBER',
	'COMMON'
] as const;

export type AppRole = (typeof APP_ROLE_VALUES)[number];

const APP_ROLE_SET = new Set<AppRole>(APP_ROLE_VALUES);

export const DEFAULT_APP_ROLE: AppRole = 'COMMON';

export const normalizeAppRole = (value: string | null | undefined): AppRole | null => {
	if (!value) {
		return null;
	}

	const normalized = value.trim().replace(/-/g, '_').toUpperCase();
	return APP_ROLE_SET.has(normalized as AppRole) ? (normalized as AppRole) : null;
};

export const resolveAppRole = (
	value: string | null | undefined,
	fallback: AppRole = DEFAULT_APP_ROLE
): AppRole => {
	return normalizeAppRole(value) ?? fallback;
};

export { betterAuthComponent };

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel, typeof authSchema>(betterAuthComponent, {
	local: {
		schema: authSchema,
	},
	verbose: true
});

// ==================== Access Control Configuration ====================

/**
 * Define resources and actions for RBAC
 * This is the single source of truth for all permissions in the application
 */
export const statement = {
	...defaultStatements,
	teams: ['create', 'update', 'delete', 'view_all'],
	team_members: ['invite', 'remove', 'manage_roles'],
	tournaments: [
		'view',
		'participate',
		'join',
		'manage_participation',
		'create',
		'update',
		'delete',
		'manage_all'
	],
	matches: ['view', 'create', 'update', 'delete', 'manage_all'],
	fields: ['manage'],
	stages: ['view', 'manage'],
	referees: ['assign'],
	scoring_profiles: ['manage'],
	alliances: ['manage'],
	queue: ['manage'],
	scores: ['edit_draft', 'finalize'],
	penalties: ['manage'],
	audience: ['control'],
	users: ['view_all', 'manage_roles']
} as const;

const cloneStatements = <S extends Record<string, readonly string[]>>(statements: S) =>
	Object.fromEntries(
		Object.entries(statements).map(([resource, actions]) => [resource, [...actions]])
	) as { [K in keyof S]: Array<S[K][number]> };

export const ac = createAccessControl(statement);

/**
 * Global admin role with full access to all resources
 * This replaces the org-level roles like TSO, HEAD_REFEREE, etc.
 */
export const ADMIN = ac.newRole(cloneStatements(statement));

export const TSO = ac.newRole({
	tournaments: [
		'view',
		'participate',
		'join',
		'manage_participation',
		'create',
		'update',
		'delete',
		'manage_all'
	],
	matches: ['view', 'create', 'update', 'delete', 'manage_all'],
	fields: ['manage'],
	stages: ['view', 'manage'],
	referees: ['assign'],
	scoring_profiles: ['manage'],
	queue: ['manage'],
	scores: ['edit_draft', 'finalize'],
	penalties: ['manage'],
	audience: ['control']
});

export const HEAD_REFEREE = ac.newRole({
	tournaments: ['view'],
	matches: ['view', 'create', 'update', 'manage_all'],
	referees: ['assign'],
	queue: ['manage'],
	scores: ['edit_draft', 'finalize'],
	penalties: ['manage']
});

export const SCORE_KEEPER = ac.newRole({
	tournaments: ['view'],
	matches: ['view'],
	scores: ['edit_draft', 'finalize'],
	penalties: ['manage']
});

export const QUEUER = ac.newRole({
	tournaments: ['view'],
	matches: ['view'],
	queue: ['manage']
});

/**
 * Team-scoped roles (mapped to Better Auth organization roles)
 * These define baseline permissions for team membership
 */
export const TEAM_MENTOR = ac.newRole({
	teams: ['update'],
	team_members: ['invite', 'remove', 'manage_roles'],
	tournaments: ['participate', 'join', 'manage_participation', 'create', 'update', 'delete'],
	matches: ['view', 'create', 'update'],
	stages: ['view', 'manage'],
	fields: ['manage'],
	referees: ['assign'],
	scoring_profiles: ['manage'],
	alliances: ['manage'],
	queue: ['manage'],
	scores: ['edit_draft', 'finalize'],
	penalties: ['manage'],
	audience: ['control']
});

export const TEAM_LEADER = ac.newRole({
	teams: ['update'],
	team_members: ['invite'],
	tournaments: ['participate', 'join', 'manage_participation'],
	matches: ['view'],
	stages: ['view']
});

export const TEAM_MEMBER = ac.newRole({
	tournaments: ['participate', 'view'],
	matches: ['view'],
	stages: ['view']
});

/**
 * Common role for basic users (non-team members)
 * Can view public tournament information
 */
export const COMMON = ac.newRole({
	tournaments: ['view'],
	matches: ['view'],
	stages: ['view']
});

export const createAuth = (
	ctx: GenericCtx<DataModel>,
	{ optionsOnly } = { optionsOnly: false }
) => {
	return betterAuth({
		// disable logging when createAuth is called just to generate options.
		// this is not required, but there's a lot of noise in logs without it.
		logger: {
			disabled: optionsOnly
		},
		databaseHooks: {
			user: {
				create: {
					before: async (data) => {
						const userType = data.userType || 'REGULAR';
						const appRole = resolveAppRole(
							(data as { appRole?: string | null | undefined }).appRole
						);

						return {
							data: {
								...data,
								userType,
								appRole
							}
						};
					}
				},
				update: {
					before: async (data) => {
						if ('appRole' in data) {
							return {
								data: {
									...data,
									appRole: resolveAppRole(
										(data as { appRole?: string | null | undefined }).appRole
									)
								}
							};
						}

						return { data };
					}
				}
			}
		},
		baseURL: siteUrl,
		database: authComponent.adapter(ctx),
		// User configuration
		user: {
			additionalFields: {
				userType: {
					type: 'string',
					required: false
				},
				appRole: {
					type: 'string',
					required: false
				}
			},
			changeEmail: {
				enabled: true,
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				sendChangeEmailVerification: async ({ user, newEmail, url, token }, _request) => {
					const resendApiKey = process.env.RESEND_API_KEY;
					const from = process.env.RESET_EMAIL_FROM || 'ModernStack SaaS <no-reply@yourdomain.com>';
					if (!resendApiKey) {
						console.error('RESEND_API_KEY not set. Unable to send email change verification.');
						return;
					}
					try {
						const res = await fetch('https://api.resend.com/emails', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${resendApiKey}`
							},
							body: JSON.stringify({
								from,
								to: user.email, // Send to current email to approve change
								subject: 'Approve email change',
								...(process.env.RESET_EMAIL_REPLY_TO
									? { reply_to: process.env.RESET_EMAIL_REPLY_TO }
									: {}),
								html: `<p>Hello ${user.name ?? 'there'},</p>
<p>We received a request to change your email address to <strong>${newEmail}</strong>.</p>
<p>Click the button below to approve this change:</p>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;border-radius:6px;text-decoration:none">Approve Email Change</a></p>
<p>If the button doesn't work, copy and paste this URL into your browser:</p>
<p><a href="${url}">${url}</a></p>
<p>If you didn't request this change, please ignore this email or contact support.</p>`
							})
						});
						if (!res.ok) {
							const text = await res.text();
							console.error(
								'Resend API error sending email change verification:',
								res.status,
								text
							);
						}
					} catch (e) {
						console.error('Failed to send email change verification:', e);
					}
				}
			}
		},
		// Configure simple, non-verified email/password to get started
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			// Send password reset emails via Resend
			// token and _request are available if you need custom templates or logging
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			sendResetPassword: async ({ user, url, token }, _request) => {
				const resendApiKey = process.env.RESEND_API_KEY;
				const from = process.env.RESET_EMAIL_FROM || 'ModernStack SaaS <no-reply@yourdomain.com>';
				if (!resendApiKey) {
					console.error('RESEND_API_KEY not set. Unable to send reset password email.');
					return;
				}
				const resetUrl = url; // Better Auth provides the full URL with token
				try {
					const res = await fetch('https://api.resend.com/emails', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${resendApiKey}`
						},
						body: JSON.stringify({
							from,
							to: user.email,
							subject: 'Reset your password',
							...(process.env.RESET_EMAIL_REPLY_TO
								? { reply_to: process.env.RESET_EMAIL_REPLY_TO }
								: {}),
							html: `<p>Hello ${user.name ?? 'there'},</p>
<p>We received a request to reset your password. Click the button below to set a new password:</p>
<p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;border-radius:6px;text-decoration:none">Reset Password</a></p>
<p>If the button doesn't work, copy and paste this URL into your browser:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`
						})
					});
					if (!res.ok) {
						const text = await res.text();
						console.error('Resend API error sending reset email:', res.status, text);
					}
				} catch (e) {
					console.error('Failed to send reset password email:', e);
				}
			}
		},
		socialProviders: {
			...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
				? {
						google: {
							clientId: process.env.GOOGLE_CLIENT_ID,
							clientSecret: process.env.GOOGLE_CLIENT_SECRET
						}
					}
				: {})
		},
		plugins: [
			// The Convex plugin is required for Convex compatibility
			convex(),
			// Admin plugin for roles/impersonation/banning APIs
			admin({
				ac,
				roles: {
					ADMIN
				}
			}),
			// Organization plugin for team management and RBAC
			organization({
				ac,
				roles: {
					TEAM_MENTOR,
					TEAM_LEADER,
					TEAM_MEMBER,
					COMMON
				},
				// Disable nested teams feature - teams are our top-level org
				teams: {
					enabled: false
				},
				// Map Better Auth organization tables to our team tables
				schema: {
					organization: {
						modelName: 'teams',
						fields: {
							name: 'team_name',
							slug: 'team_number',
							createdAt: 'created_at'
						}
					},
					member: {
						modelName: 'team_members',
						fields: {
							organizationId: 'team_id',
							userId: 'user_id',
							role: 'role',
							createdAt: 'joined_at'
						}
					},
					invitation: {
						modelName: 'team_invitations',
						fields: {
							organizationId: 'team_id',
							inviterId: 'invited_by_user_id',
							invitedUserId: 'invited_user_id',
							role: 'invited_role',
							status: 'status',
							expiresAt: 'expires_at'
						}
					}
				},
				// Auto-assign default role when user first signs up
				defaultRole: 'COMMON'
			})
		]
	});
};



// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		try {
			const authUser = await authComponent.getAuthUser(ctx);
			if (!authUser) {
				return null;
			}

			const authUserId = authUser.userId || authUser._id;

			const appUser = await ctx.db
				.query('users')
				.withIndex('authId', (q) => q.eq('authId', authUserId))
				.unique();

			const userRoleRecords = appUser
				? await ctx.db
						.query('user_roles')
						.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
						.collect()
				: [];
			const orgRoleRecords = appUser
				? await ctx.db
						.query('org_user_roles')
						.withIndex('by_user', (q) => q.eq('user_id', appUser._id))
						.collect()
				: [];

			const userRoles = userRoleRecords.length
				? userRoleRecords.map((record) => record.role)
				: ['COMMON'];
			const orgRoles = orgRoleRecords.map((record) => record.role);

			const resolvedAppRole =
				(appUser ? normalizeAppRole(appUser.appRole ?? null) : null) ??
				normalizeAppRole(
					(authUser as { appRole?: string | null | undefined }).appRole ?? undefined
				) ??
				normalizeAppRole(authUser.role as string | null | undefined) ??
				DEFAULT_APP_ROLE;

			return {
				...authUser,
				appRole: resolvedAppRole,
				userRoles,
				orgRoles,
				// Also expose role for Better Auth compatibility
				role: authUser.role
			};
		} catch {
			// Return null when unauthenticated
			return null;
		}
	}
});
