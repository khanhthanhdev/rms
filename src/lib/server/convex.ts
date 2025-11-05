import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

const convexUrl = PUBLIC_CONVEX_URL || process.env.PUBLIC_CONVEX_URL;

if (!convexUrl) {
	throw new Error('PUBLIC_CONVEX_URL environment variable is not set');
}

export const convex = new ConvexHttpClient(convexUrl);
