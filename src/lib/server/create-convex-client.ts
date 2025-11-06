import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import type { Cookies } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const resolveConvexUrl = () =>
	env.PUBLIC_CONVEX_URL ??
	env.CONVEX_URL ??
	env.VITE_PUBLIC_CONVEX_URL ??
	process.env.PUBLIC_CONVEX_URL ??
	process.env.CONVEX_URL ??
	process.env.VITE_PUBLIC_CONVEX_URL ??
	undefined;

export const createServerConvexClient = ({
	cookies: _cookies,
	token
}: {
	cookies: Cookies;
	token?: string | null;
}) => {
	const convexUrl = resolveConvexUrl();

	if (!convexUrl) {
		throw error(500, 'Convex URL is not configured');
	}

	const client = createConvexHttpClient({
		convexUrl,
		token: token ?? undefined
	});

	return client;
};
