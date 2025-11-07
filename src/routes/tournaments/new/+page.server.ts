import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

const TOURNAMENT_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const VISIBILITY_VALUES = ['PUBLIC', 'PRIVATE'] as const;

const optionalTrimmed = (max: number) =>
	z
		.string()
		.transform((value) => value.trim())
		.pipe(z.string().max(max))
		.optional()
		.transform((value) => (value && value.length ? value : undefined));

const parseDateInput = z
	.preprocess((value) => {
		if (typeof value !== 'string') {
			return undefined;
		}
		const trimmed = value.trim();
		if (!trimmed) {
			return undefined;
		}
		const timestamp = Date.parse(trimmed);
		return Number.isFinite(timestamp) ? timestamp : Number.NaN;
	}, z.number({ invalid_type_error: 'Provide a valid date' }).optional());

const parseInteger = (min: number) =>
	z.preprocess((value) => {
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value !== 'string') {
			return undefined;
		}
		const trimmed = value.trim();
		if (!trimmed) {
			return undefined;
		}
		const parsed = Number.parseInt(trimmed, 10);
		return Number.isNaN(parsed) ? Number.NaN : parsed;
	}, z.number().int().min(min).optional());

const CreateSchema = z.object({
	name: z
		.string({ required_error: 'Name is required' })
		.trim()
		.min(3, 'Name must be at least 3 characters')
		.max(120, 'Name must be 120 characters or less'),
	code: z
		.string({ required_error: 'Code is required' })
		.trim()
		.min(2, 'Code must be at least 2 characters')
		.max(20, 'Code must be 20 characters or less'),
	description: optionalTrimmed(2000),
	location: optionalTrimmed(160),
	startDate: parseDateInput,
	endDate: parseDateInput,
	registrationDeadline: parseDateInput,
	teamCapacity: parseInteger(1),
	allianceTeamLimit: parseInteger(1).transform((value) => value ?? 1),
	status: z.enum(TOURNAMENT_STATUS_VALUES).optional().default('DRAFT'),
	visibility: z.enum(VISIBILITY_VALUES).optional().default('PUBLIC')
});

type CreateInput = z.infer<typeof CreateSchema>;

const redirectToSignIn = (pathname: string) => {
	throw redirect(302, `/auth/sign-in?redirectTo=${encodeURIComponent(pathname)}`);
};

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	if (typeof locals.token !== 'string' || !locals.token) {
		redirectToSignIn(url.pathname);
	}

	const client = createConvexHttpClient({ cookies, token: locals.token });

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});
		if (!currentUser) {
			redirectToSignIn(url.pathname);
		}
		const user = currentUser!;

		const appRole = typeof user.appRole === 'string' ? user.appRole.trim().toUpperCase() : null;
		if (appRole !== 'ADMIN') {
			throw error(403, 'Only administrators can create tournaments');
		}

		return {
			statusOptions: TOURNAMENT_STATUS_VALUES,
			visibilityOptions: VISIBILITY_VALUES
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		if (message.includes('Not authenticated')) {
			redirectToSignIn(url.pathname);
		}
		throw error(500, 'Failed to load tournament creation form');
	}
};

export const actions: Actions = {
	default: async ({ request,  locals, url }) => {
		if (typeof locals.token !== 'string' || !locals.token) {
			redirectToSignIn(url.pathname);
		}

		const client = createConvexHttpClient({ token: locals.token });

		const formData = await request.formData();
		const rawInput = {
			name: (formData.get('name') ?? '').toString(),
			code: (formData.get('code') ?? '').toString(),
			description: (formData.get('description') ?? '').toString(),
			location: (formData.get('location') ?? '').toString(),
			startDate: (formData.get('startDate') ?? '').toString(),
			endDate: (formData.get('endDate') ?? '').toString(),
			registrationDeadline: (formData.get('registrationDeadline') ?? '').toString(),
			teamCapacity: (formData.get('teamCapacity') ?? '').toString(),
			allianceTeamLimit: (formData.get('allianceTeamLimit') ?? '').toString(),
			status: (formData.get('status') ?? '').toString(),
			visibility: (formData.get('visibility') ?? '').toString()
		};

		const parsed = CreateSchema.safeParse(rawInput);
		if (!parsed.success) {
			const { fieldErrors, formErrors } = parsed.error.flatten();
			return fail(400, {
				errors: {
					name: fieldErrors.name?.[0],
					code: fieldErrors.code?.[0],
					description: fieldErrors.description?.[0],
					location: fieldErrors.location?.[0],
					startDate: fieldErrors.startDate?.[0],
					endDate: fieldErrors.endDate?.[0],
					registrationDeadline: fieldErrors.registrationDeadline?.[0],
					teamCapacity: fieldErrors.teamCapacity?.[0],
					allianceTeamLimit: fieldErrors.allianceTeamLimit?.[0],
					status: fieldErrors.status?.[0],
					visibility: fieldErrors.visibility?.[0],
					global: formErrors[0]
				},
				values: rawInput
			});
		}

		const input: CreateInput = parsed.data;

		try {
			const result = await client.mutation(api.tournaments.createTournament, {
				name: input.name,
				code: input.code,
				description: input.description,
				location: input.location,
				startDate: input.startDate,
				endDate: input.endDate,
				registrationDeadline: input.registrationDeadline,
				teamCapacity: input.teamCapacity,
				allianceTeamLimit: input.allianceTeamLimit ?? 1,
				status: input.status,
				visibility: input.visibility
			});

			throw redirect(303, `/tournaments/${result.tournamentId}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create tournament';
			return fail(500, {
				errors: { global: message },
				values: rawInput
			});
		}
	}
};
