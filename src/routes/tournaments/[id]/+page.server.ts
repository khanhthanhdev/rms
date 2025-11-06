import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Id } from '$convex/_generated/dataModel';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export const load: PageServerLoad = async ({ params, cookies, locals }) => {
	const client = createConvexHttpClient({
		cookies,
		token: typeof locals.token === 'string' ? locals.token : null
	});

	const tournamentId = params.id as Id<'tournaments'>;

	try {
		const [detail, currentUser] = await Promise.all([
			client.query(api.tournaments.getPublicTournament, {
				tournamentId
			}),
			client
				.query(api.auth.getCurrentUser, {})
				.catch(() => null)
		]);

		const isAuthenticated = Boolean(currentUser);
		const isAdmin = Boolean(
			currentUser &&
			typeof currentUser.appRole === 'string' &&
			currentUser.appRole.trim().toUpperCase() === 'ADMIN'
		);

		return {
			detail,
			viewer: {
				isAuthenticated,
				isAdmin,
				canEdit: detail.tournament.canEdit
			}
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		if (message.includes('not found') || message.includes('not available')) {
			throw error(404, 'Tournament not found');
		}
		throw error(500, 'Failed to load tournament');
	}
};
