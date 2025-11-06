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

const TeamFormSchema = z.object({
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
	imageUrl: optionalImageUrlSchema,
	consent: z.literal(true, {
		errorMap: () => ({
			message: 'You must acknowledge the consent statement'
		})
	})
});

type TeamFormInput = z.infer<typeof TeamFormSchema>;

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const client = createConvexHttpClient({
		cookies,
		token: typeof locals.token === 'string' ? locals.token : undefined
	});

	try {
		const creationContext = await client.query(api.teams.getCreationContext, {});

		return {
			creationContext
		};
	} catch (err) {
		console.error('Failed to load team creation context', err);
		if ((err as { status?: number }).status === 401) {
			throw redirect(302, '/auth/sign-in');
		}
		throw error(500, 'Unable to load team creation context');
	}
};

const validateForm = (formData: FormData) => {
	const rawInput = {
		teamName: (formData.get('teamName') ?? '').toString(),
		location: (formData.get('location') ?? '').toString(),
		description: (formData.get('description') ?? '').toString(),
		imageUrl: (formData.get('imageUrl') ?? '').toString(),
		consent: formData.get('consent') === 'on'
	};

	return {
		rawInput,
		result: TeamFormSchema.safeParse(rawInput)
	};
};

const extractErrors = (result: z.SafeParseReturnType<TeamFormInput, TeamFormInput>) => {
	const fieldErrors: Record<string, string> = {};

	if (!result.success) {
		const { fieldErrors: zodFieldErrors, formErrors } = result.error.flatten();

		for (const [key, value] of Object.entries(zodFieldErrors)) {
			if (value && value.length > 0) {
				fieldErrors[key] = value[0] ?? '';
			}
		}

		if (formErrors.length > 0) {
			fieldErrors.global = formErrors[0] ?? 'Please review the form';
		}
	}

	return fieldErrors;
};

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const client = createConvexHttpClient({
			cookies,
			token: typeof locals.token === 'string' ? locals.token : undefined
		});

		const formData = await request.formData();
		const { rawInput, result } = validateForm(formData);

		if (!result.success) {
			const errors = extractErrors(result);
			if (Object.keys(errors).length === 0) {
				errors.teamName = 'Please review the form';
			}

			return fail(400, {
				errors,
				values: rawInput
			});
		}

		try {
			const creationContext = await client.query(api.teams.getCreationContext, {});
			if (!creationContext.canCreate) {
				return fail(403, {
					errors: {
						global: creationContext.reasons[0] ?? 'You are not allowed to create a team yet.'
					},
					values: rawInput
				});
			}
		} catch (err) {
			console.error('Failed to validate creation context', err);
			return fail(500, {
				errors: {
					global: 'We could not verify your permissions. Please try again.'
				},
				values: rawInput
			});
		}

		const parsedInput: TeamFormInput = result.data;

		try {
			const created = await client.mutation(api.teams.createTeam, {
				teamName: parsedInput.teamName,
				location: parsedInput.location,
				description: parsedInput.description,
				imageUrl: parsedInput.imageUrl
			});

			throw redirect(303, `/teams/${created.teamNumber}`);
		} catch (err) {
			console.error('Failed to create team', err);
			return fail(500, {
				errors: {
					global: err instanceof Error ? err.message : 'Failed to create team'
				},
				values: rawInput
			});
		}
	}
};
