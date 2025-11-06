import type { PageServerLoad } from './$types.js';
import { api } from '$convex/_generated/api.js';
import { createServerConvexClient } from '$lib/server/create-convex-client';

export const load: PageServerLoad = async ({ cookies }) => {
	const client = createServerConvexClient({ cookies, token: null });

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});
		return { currentUser };
	} catch {
		return { currentUser: null };
	}
};
