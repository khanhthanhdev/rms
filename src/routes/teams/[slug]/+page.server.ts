import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { z } from 'zod';

const optionalDescriptionSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') {
			return undefined;
		}
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	},
	z.string().max(500, 'Description must be 500 characters or less').optional()
);

const optionalImageUrlSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') {
			return undefined;
		}
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	},
	z.string().url('Provide a valid image URL').optional()
);

const updateTeamSchema = z.object({
	teamName: z
		.string({ required_error: 'Team name is required' })
		.trim()
		.min(2, 'Team name must be at least 2 characters')
		.max(100, 'Team name must be 100 characters or less'),
	location: z
		.string({ required_error: 'Location is required' })
		.trim()
		.min(2, 'Location must be at least 2 characters')
		.max(100, 'Location must be 100 characters or less'),
	description: optionalDescriptionSchema,
	imageUrl: optionalImageUrlSchema
});

const inviteMemberSchema = z.object({
	email: z
		.string({ required_error: 'Email is required' })
		.trim()
		.toLowerCase()
		.email('Enter a valid email address'),
	role: z.enum(['TEAM_LEADER', 'TEAM_MEMBER'])
});

type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

const extractErrors = <T>(result: z.SafeParseReturnType<T, T>) => {
	const fieldErrors: Record<string, string> = {};

	if (!result.success) {
		const { fieldErrors: zodFieldErrors, formErrors } = result.error.flatten() as {
			fieldErrors: Record<string, string[]>;
			formErrors: string[];
		};

		for (const [key, value] of Object.entries(zodFieldErrors)) {
			const messages = value;
			if (messages && messages.length > 0) {
				fieldErrors[key] = messages[0] ?? '';
			}
		}

		if (formErrors.length > 0) {
			fieldErrors.global = formErrors[0] ?? 'Please review the form';
		}
	}

	return fieldErrors;
};

export const load: PageServerLoad = async ({ params, cookies, locals, url }) => {
	const client = createConvexHttpClient({
		cookies,
		token: typeof locals.token === 'string' ? locals.token : null
	});

	try {
		const management = await client.query(api.teams.getTeamManagement, {
			teamNumber: params.slug
		});

		if (!management) {
			throw error(404, 'Team not found');
		}

		return {
			management,
			flash: {
				updated: url.searchParams.get('updated') === '1',
				invited: url.searchParams.get('invited') === '1'
			}
		};
	} catch (err) {
		console.error('Failed to load team management data', err);
		if ((err as { status?: number }).status === 401) {
			throw redirect(302, '/auth/sign-in');
		}
		throw error(500, 'Unable to load team management data');
	}
};

export const actions: Actions = {
	update: async ({ request, params, cookies, locals, url }) => {
		const client = createServerConvexClient({
			cookies,
			token: typeof locals.token === 'string' ? locals.token : null
		});

		const formData = await request.formData();
		const rawInput = {
			teamName: (formData.get('teamName') ?? '').toString(),
			location: (formData.get('location') ?? '').toString(),
			description: (formData.get('description') ?? '').toString(),
			imageUrl: (formData.get('imageUrl') ?? '').toString()
		};

		const result = updateTeamSchema.safeParse(rawInput);
		if (!result.success) {
			return fail(400, {
				update: {
					errors: extractErrors(result),
					values: rawInput
				}
			});
		}

		let management;
		try {
			management = await client.query(api.teams.getTeamManagement, {
				teamNumber: params.slug
			});
		} catch (err) {
			console.error('Failed to reload team context before update', err);
			return fail(500, {
				update: {
					errors: {
						global: 'We could not verify the team. Please try again.'
					},
					values: rawInput
				}
			});
		}

		if (!management) {
			return fail(404, {
				update: {
					errors: {
						global: 'Team not found'
					},
					values: rawInput
				}
			});
		}

		if (!management.permissions.canUpdate) {
			return fail(403, {
				update: {
					errors: {
						global: 'You do not have permission to update this team.'
					},
					values: rawInput
				}
			});
		}

		try {
			await client.mutation(api.teams.updateTeam, {
				teamId: management.team.id,
				teamName: result.data.teamName,
				location: result.data.location,
				description: result.data.description,
				imageUrl: result.data.imageUrl
			});
		} catch (err) {
			console.error('Failed to update team', err);
			return fail(500, {
				update: {
					errors: {
						global: err instanceof Error ? err.message : 'Unable to update team details'
					},
					values: rawInput
				}
			});
		}

		throw redirect(303, `${url.pathname}?updated=1`);
	},

	invite: async ({ request, params, cookies, locals, url }) => {
		const client = createServerConvexClient({
			cookies,
			token: typeof locals.token === 'string' ? locals.token : null
		});

		const formData = await request.formData();
		const rawInput = {
			email: (formData.get('email') ?? '').toString(),
			role: (formData.get('role') ?? '').toString()
		};

		const result = inviteMemberSchema.safeParse(rawInput);
		if (!result.success) {
			return fail(400, {
				invite: {
					errors: extractErrors(result),
					values: rawInput
				}
			});
		}

		let management;
		try {
			management = await client.query(api.teams.getTeamManagement, {
				teamNumber: params.slug
			});
		} catch (err) {
			console.error('Failed to reload team context before invite', err);
			return fail(500, {
				invite: {
					errors: {
						global: 'We could not verify the team. Please try again.'
					},
					values: rawInput
				}
			});
		}

		if (!management) {
			return fail(404, {
				invite: {
					errors: {
						global: 'Team not found'
					},
					values: rawInput
				}
			});
		}

		if (!management.permissions.canInvite) {
			return fail(403, {
				invite: {
					errors: {
						global: 'You do not have permission to send invites.'
					},
					values: rawInput
				}
			});
		}

		try {
			await client.mutation(api.teams.inviteTeamMember, {
				teamId: management.team.id,
				inviteeEmail: result.data.email,
				role: result.data.role
			});
		} catch (err) {
			console.error('Failed to send team invitation', err);
			return fail(500, {
				invite: {
					errors: {
						global: err instanceof Error ? err.message : 'Unable to send invite'
					},
					values: rawInput
				}
			});
		}

		throw redirect(303, `${url.pathname}?invited=1`);
	}
};
