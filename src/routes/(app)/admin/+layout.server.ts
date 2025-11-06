import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	const client = createConvexHttpClient({ cookies });

	if (typeof locals.token === 'string' && locals.token) {
		client.setAuth(locals.token);
	}

	const user = await client.query(api.auth.getCurrentUser, {});
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const raw = (user as { appRole?: unknown }).appRole;
	const appRole = typeof raw === 'string' ? raw.trim().toUpperCase() : null;

	if (appRole !== 'ADMIN') {
		throw error(403, 'Forbidden: Admin access required');
	}

	return {
		user: {
			...user,
			appRole,
			isAdmin: true
		}
	};
};
