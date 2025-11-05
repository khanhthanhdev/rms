import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../convex/_generated/api';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Get current user with team context
		const teams = await convex.query(api.authHelpers.userTeamsQuery);
		
		return json(teams);
	} catch (error) {
	console.error('Error fetching teams:', error);
		return json(
			{ error: 'Failed to fetch teams' },
			{ status: 500 }
		);
	}
};
