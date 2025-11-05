import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { SITE_URL } from '$env/static/private';
import { env } from '$env/dynamic/private';

if (SITE_URL && !process.env.SITE_URL) {
	process.env.SITE_URL = SITE_URL;
}

const normalizeRole = (value: unknown): string | null => {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const normalized = trimmed.replace(/-/g, '_').toUpperCase();

	switch (normalized) {
		case 'ADMIN':
		case 'ADMINISTRATOR':
		case 'SUPER_ADMIN':
		case 'SUPERADMIN':
			return 'ADMIN';
		default:
			return normalized;
	}
};

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	// Create Convex client with cookies (automatically extracts auth token)
	const convexUrl =
		env.PUBLIC_CONVEX_URL ??
		env.CONVEX_URL ??
		env.VITE_PUBLIC_CONVEX_URL ??
		process.env.PUBLIC_CONVEX_URL ??
		process.env.CONVEX_URL ??
		process.env.VITE_PUBLIC_CONVEX_URL ??
		undefined;

	if (!convexUrl) {
		console.warn(
			'Admin guard: PUBLIC_CONVEX_URL (or equivalent) is not configured. Falling back to default client configuration.'
		);
	}

	const client = createConvexHttpClient({ cookies, convexUrl });

	if (typeof locals.token === 'string' && locals.token.length > 0) {
		client.setAuth(locals.token);
	}

	try {
		// Fetch current user using Convex query
		const user = await client.query(api.auth.getCurrentUser, {});

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		const orgRolesRaw = Array.isArray((user as { orgRoles?: unknown }).orgRoles)
			? ((user as { orgRoles?: unknown[] }).orgRoles ?? [])
			: [];

		const orgRoles = orgRolesRaw
			.map((role) => normalizeRole(role))
			.filter((role): role is string => role !== null);

		const appRole = normalizeRole((user as { appRole?: unknown }).appRole);
		const betterAuthRole = normalizeRole((user as { role?: unknown }).role);

		const isAdmin = orgRoles.includes('ADMIN') || appRole === 'ADMIN' || betterAuthRole === 'ADMIN';

		if (!isAdmin) {
			throw error(403, 'Forbidden: Admin access required');
		}

		return {
			user: {
				...user,
				appRole: appRole ?? (user as { appRole?: unknown }).appRole ?? null,
				orgRoles,
				isAdmin: true
			}
		};
	} catch (err) {
		console.error('Admin guard failed', err);
		throw error(401, 'Unauthorized');
	}
};
