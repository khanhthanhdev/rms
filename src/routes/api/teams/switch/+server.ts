import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convex } from '$lib/server/convex';
import { api } from '../../../../convex/_generated/api';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { teamId } = await request.json();
		
		if (!teamId) {
			return json(
				{ error: 'Team ID is required' },
				{ status: 400 }
			);
		}

		// Switch active team
		const result = await convex.mutation(api.authHelpers.switchActiveTeam, { teamId });
		
		return json(result);
	} catch (error) {
		console.error('Error switching team:', error);
		return json(
			{ error: 'Failed to switch team' },
			{ status: 500 }
		);
	}
};
