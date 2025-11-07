import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Id } from '$convex/_generated/dataModel';
import { z } from 'zod';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

const TOURNAMENT_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const VISIBILITY_VALUES = ['PUBLIC', 'PRIVATE'] as const;

type TournamentStatus = (typeof TOURNAMENT_STATUS_VALUES)[number];
type TournamentVisibility = (typeof VISIBILITY_VALUES)[number];

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

const parseInteger = (opts: { min?: number; max?: number }) =>
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
	}, z.number().int().optional().refine((value) => {
		if (value === undefined) {
			return true;
		}
		if (typeof opts.min === 'number' && value < opts.min) {
			return false;
		}
		if (typeof opts.max === 'number' && value > opts.max) {
			return false;
		}
		return true;
	}, { message: `Value must be between ${opts.min ?? '-∞'} and ${opts.max ?? '∞'}` }));

const UpdateSchema = z.object({
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
	teamCapacity: parseInteger({ min: 1 }),
	allianceTeamLimit: parseInteger({ min: 1 }).transform((value) => value ?? 1),
	status: z.enum(TOURNAMENT_STATUS_VALUES),
	visibility: z.enum(VISIBILITY_VALUES)
});

type UpdateInput = z.infer<typeof UpdateSchema>;

const AnnouncementSchema = z.object({
	title: z
		.string({ required_error: 'Title is required' })
		.trim()
		.min(3, 'Title must be at least 3 characters')
		.max(140, 'Title must be 140 characters or less'),
	message: z
		.string({ required_error: 'Message is required' })
		.trim()
		.min(10, 'Message must be at least 10 characters'),
	publish: z.boolean().optional()
});

const DocumentSchema = z.object({
	title: z
		.string({ required_error: 'Title is required' })
		.trim()
		.min(3, 'Title must be at least 3 characters')
		.max(140, 'Title must be 140 characters or less'),
	url: z
		.string({ required_error: 'URL is required' })
		.trim()
		.url('Provide a valid URL'),
	description: optionalTrimmed(500),
	category: optionalTrimmed(60),
	publish: z.boolean().optional()
});

const redirectToSignIn = (pathname: string) => {
	throw redirect(302, `/auth/sign-in?redirectTo=${encodeURIComponent(pathname)}`);
};

export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (typeof locals.token !== 'string' || !locals.token) {
		redirectToSignIn(url.pathname);
	}

	const client = createConvexHttpClient({ token: locals.token });
	const tournamentId = params.id as Id<'tournaments'>;

	try {
		const editorContext = await client.query(api.tournaments.getTournamentEditorContext, {
			tournamentId
		});

		return {
			editorContext,
			statusOptions: TOURNAMENT_STATUS_VALUES,
			visibilityOptions: VISIBILITY_VALUES
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		if (message.includes('Not authenticated')) {
			redirectToSignIn(url.pathname);
		}
		if (message.includes('not found')) {
			throw error(404, 'Tournament not found');
		}
		if (message.includes('permission')) {
			throw error(403, 'You do not have permission to edit this tournament');
		}
		throw error(500, 'Failed to load tournament editor');
	}
};

const handleUpdate = async ({
	request,
	client,
	tournamentId
}: {
	request: Request;
	client: ReturnType<typeof createConvexHttpClient>;
	tournamentId: Id<'tournaments'>;
}) => {
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

	const parsed = UpdateSchema.safeParse(rawInput);
	if (!parsed.success) {
		const { fieldErrors, formErrors } = parsed.error.flatten();
		return fail(400, {
			formType: 'update',
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

	const input: UpdateInput = parsed.data;

	try {
		await client.mutation(api.tournaments.updateTournament, {
			tournamentId,
			name: input.name,
			code: input.code,
			description: input.description,
			location: input.location,
			startDate: input.startDate,
			endDate: input.endDate,
			registrationDeadline: input.registrationDeadline,
			teamCapacity: input.teamCapacity,
			allianceTeamLimit: input.allianceTeamLimit ?? 1,
			status: input.status as TournamentStatus,
			visibility: input.visibility as TournamentVisibility
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to update tournament';
		return fail(500, {
			formType: 'update',
			errors: { global: message },
			values: rawInput
		});
	}

	return {
		formType: 'update',
		success: true
	};
};

const handleAnnouncementCreate = async ({
	request,
	client,
	tournamentId
}: {
	request: Request;
	client: ReturnType<typeof createConvexHttpClient>;
	tournamentId: Id<'tournaments'>;
}) => {
	const formData = await request.formData();
	const rawInput = {
		title: (formData.get('title') ?? '').toString(),
		message: (formData.get('message') ?? '').toString(),
		publish: formData.get('publish') === 'on'
	};

	const parsed = AnnouncementSchema.safeParse(rawInput);
	if (!parsed.success) {
		const { fieldErrors, formErrors } = parsed.error.flatten();
		return fail(400, {
			formType: 'announcement',
			errors: {
				title: fieldErrors.title?.[0],
				message: fieldErrors.message?.[0],
				global: formErrors[0]
			},
			values: rawInput
		});
	}

	try {
		await client.mutation(api.tournaments.createTournamentAnnouncement, {
			tournamentId,
			title: parsed.data.title,
			message: parsed.data.message,
			publish: parsed.data.publish ?? false
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to publish announcement';
		return fail(500, {
			formType: 'announcement',
			errors: { global: message },
			values: rawInput
		});
	}

	return {
		formType: 'announcement',
		success: true
	};
};

const handleAnnouncementDelete = async ({
	request,
	client
}: {
	request: Request;
	client: ReturnType<typeof createConvexHttpClient>;
}) => {
	const formData = await request.formData();
	const announcementId = (formData.get('announcementId') ?? '').toString();
	if (!announcementId) {
		return fail(400, {
			formType: 'announcement',
			errors: { global: 'Announcement id is required' }
		});
	}

	const targetId = announcementId as Id<'tournament_announcements'>;

	try {
		await client.mutation(api.tournaments.deleteTournamentAnnouncement, {
			announcementId: targetId
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete announcement';
		return fail(500, {
			formType: 'announcement',
			errors: { global: message }
		});
	}

	return {
		formType: 'announcement',
		success: true
	};
};

const handleDocumentCreate = async ({
	request,
	client,
	tournamentId
}: {
	request: Request;
	client: ReturnType<typeof createConvexHttpClient>;
	tournamentId: Id<'tournaments'>;
}) => {
	const formData = await request.formData();
	const rawInput = {
		title: (formData.get('title') ?? '').toString(),
		url: (formData.get('url') ?? '').toString(),
		description: (formData.get('description') ?? '').toString(),
		category: (formData.get('category') ?? '').toString(),
		publish: formData.get('publish') === 'on'
	};

	const parsed = DocumentSchema.safeParse(rawInput);
	if (!parsed.success) {
		const { fieldErrors, formErrors } = parsed.error.flatten();
		return fail(400, {
			formType: 'document',
			errors: {
				title: fieldErrors.title?.[0],
				url: fieldErrors.url?.[0],
				description: fieldErrors.description?.[0],
				category: fieldErrors.category?.[0],
				global: formErrors[0]
			},
			values: rawInput
		});
	}

	try {
		await client.mutation(api.tournaments.createTournamentDocument, {
			tournamentId,
			title: parsed.data.title,
			url: parsed.data.url,
			description: parsed.data.description,
			category: parsed.data.category,
			publish: parsed.data.publish ?? true
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to add document';
		return fail(500, {
			formType: 'document',
			errors: { global: message },
			values: rawInput
		});
	}

	return {
		formType: 'document',
		success: true
	};
};

const handleDocumentDelete = async ({
	request,
	client
}: {
	request: Request;
	client: ReturnType<typeof createConvexHttpClient>;
}) => {
	const formData = await request.formData();
	const documentId = (formData.get('documentId') ?? '').toString();
	if (!documentId) {
		return fail(400, {
			formType: 'document',
			errors: { global: 'Document id is required' }
		});
	}

	const targetId = documentId as Id<'tournament_documents'>;

	try {
		await client.mutation(api.tournaments.deleteTournamentDocument, {
			documentId: targetId
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete document';
		return fail(500, {
			formType: 'document',
			errors: { global: message }
		});
	}

	return {
		formType: 'document',
		success: true
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals, url }) => {
		if (typeof locals.token !== 'string' || !locals.token) {
			redirectToSignIn(url.pathname);
		}

		const client = createConvexHttpClient({ token: locals.token });
		return await handleUpdate({ request, client, tournamentId: params.id as Id<'tournaments'> });
	},
	addAnnouncement: async ({ request, params,  locals, url }) => {
		if (typeof locals.token !== 'string' || !locals.token) {
			redirectToSignIn(url.pathname);
		}

		const client = createConvexHttpClient({  token: locals.token });
		return await handleAnnouncementCreate({ request, client, tournamentId: params.id as Id<'tournaments'> });
	},
	deleteAnnouncement: async ({ request,  locals, url }) => {
		if (typeof locals.token !== 'string' || !locals.token) {
			redirectToSignIn(url.pathname);
		}

		const client = createConvexHttpClient({  token: locals.token });
		return await handleAnnouncementDelete({ request, client });
	},
	addDocument: async ({ request, params,  locals, url }) => {
		if (typeof locals.token !== 'string' || !locals.token) {
			redirectToSignIn(url.pathname);
		}

		const client = createConvexHttpClient({  token: locals.token });
		return await handleDocumentCreate({ request, client, tournamentId: params.id as Id<'tournaments'> });
	},
	deleteDocument: async ({ request,  locals, url }) => {
		if (typeof locals.token !== 'string' || !locals.token) {
			redirectToSignIn(url.pathname);
		}

		const client = createConvexHttpClient({ token: locals.token });
		return await handleDocumentDelete({ request, client });
	}
};
