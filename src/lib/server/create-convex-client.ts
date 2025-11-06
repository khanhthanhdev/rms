import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import type { Cookies } from '@sveltejs/kit';
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
	cookies,
	token
}: {
	cookies: Cookies;
	token?: string | null;
}) => {
	const convexUrl = resolveConvexUrl();

	if (!convexUrl) {
		console.warn(
			'createServerConvexClient: PUBLIC_CONVEX_URL (or equivalent) is not configured. Falling back to default client configuration.'
		);
	}

	const client = createConvexHttpClient({ cookies, convexUrl });

	if (token && token.length) {
		client.setAuth(token);
	}

	return client;
};
