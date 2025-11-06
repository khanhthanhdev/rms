import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Id } from '$convex/_generated/dataModel';
import { z } from 'zod';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

const optionalTrimmed = z
	.string()
	.transform((value) => value.trim())
	.pipe(z.string().max(200))
	.optional()
	.transform((value) => (value && value.length ? value : undefined));

const RegisterSchema = z.object({
	teamId: z.string({ required_error: 'Select a team to register' }).min(1, 'Select a team to register'),
	robotName: optionalTrimmed,
	robotDescription: z
		.string()
		.transform((value) => value.trim())
		.pipe(z.string().max(500, 'Keep the description under 500 characters'))
		.optional()
		.transform((value) => (value && value.length ? value : undefined))
});

type RegisterInput = z.infer<typeof RegisterSchema>;

const redirectToSignIn = (pathname: string) => {
	throw redirect(302, `/auth/sign-in?redirectTo=${encodeURIComponent(pathname)}`);
};

export const load: PageServerLoad = async ({ params, cookies, locals, url }) => {
	if (typeof locals.token !== 'string' || !locals.token) {
		redirectToSignIn(url.pathname);
	}

	const client = createConvexHttpClient({ cookies, token: locals.token });

	try {
		const context = await client.query(api.tournaments.getTournamentRegistrationContext, {
			tournamentId: params.id as Id<'tournaments'>
		});

		const eligibleTeams = context.teams.filter((team) => !team.alreadyRegistered);

		return {
			context,
			eligibleTeams
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		if (message.includes('Not authenticated')) {
			redirectToSignIn(url.pathname);
		}
		if (message.includes('not found')) {
			throw error(404, 'Tournament not found');
		}
		throw error(500, 'Failed to load registration form');
	}
};

export const actions: Actions = {
	default: async ({ request, params, cookies, locals, url }) => {
		if (typeof locals.token !== 'string' || !locals.token) {
			redirectToSignIn(url.pathname);
		}

		const client = createConvexHttpClient({ cookies, token: locals.token });

		const formData = await request.formData();
		const rawInput = {
			teamId: (formData.get('teamId') ?? '').toString(),
			robotName: (formData.get('robotName') ?? '').toString(),
			robotDescription: (formData.get('robotDescription') ?? '').toString()
		};

		const parsed = RegisterSchema.safeParse(rawInput);
		if (!parsed.success) {
			const { fieldErrors, formErrors } = parsed.error.flatten();
			return fail(400, {
				errors: {
					teamId: fieldErrors.teamId?.[0],
					robotName: fieldErrors.robotName?.[0],
					robotDescription: fieldErrors.robotDescription?.[0],
					global: formErrors[0]
				},
				values: rawInput
			});
		}

		const input: RegisterInput = parsed.data;

		try {
			await client.mutation(api.tournaments.registerTeam, {
				tournamentId: params.id as Id<'tournaments'>,
				teamId: input.teamId as Id<'teams'>,
				robotName: input.robotName,
				robotDescription: input.robotDescription
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Registration failed';
			return fail(400, {
				errors: {
					global: message
				},
				values: rawInput
			});
		}

		throw redirect(303, `/tournaments/${params.id}`);
	}
};
