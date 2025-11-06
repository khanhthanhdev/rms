import type { PageServerLoad } from './$types';
import { api } from '$convex/_generated/api.js';
import { createServerConvexClient } from '$lib/server/create-convex-client';

const PHASE_FILTER_VALUES = ['registration_open', 'upcoming', 'in_progress', 'completed'] as const;
const SORT_VALUES = ['recent', 'start_asc', 'start_desc', 'name_asc', 'name_desc'] as const;

type PhaseFilter = (typeof PHASE_FILTER_VALUES)[number];
type SortValue = (typeof SORT_VALUES)[number];

const PHASE_SET = new Set(PHASE_FILTER_VALUES);
const SORT_SET = new Set(SORT_VALUES);

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	const client = createServerConvexClient({
		cookies,
		token: typeof locals.token === 'string' ? locals.token : null
	});

	const rawSearch = (url.searchParams.get('search') ?? '').trim();
	const phaseParam = url.searchParams.get('phase');
	const sortParam = url.searchParams.get('sort');
	const pageParam = Number(url.searchParams.get('page') ?? '1');

	const phase = phaseParam && PHASE_SET.has(phaseParam as PhaseFilter) ? (phaseParam as PhaseFilter) : '';
	const sort = sortParam && SORT_SET.has(sortParam as SortValue) ? (sortParam as SortValue) : 'recent';
	const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

	const [listResponse, currentUser] = await Promise.all([
		client.query(api.tournaments.listPublicTournaments, {
			page,
			pageSize: PAGE_SIZE,
			search: rawSearch ? rawSearch : undefined,
			phase: phase ? (phase as PhaseFilter) : undefined,
			sort
		}),
		client
			.query(api.auth.getCurrentUser, {})
			.catch(() => null)
	]);

	const isAdmin = Boolean(
		currentUser &&
		typeof currentUser.appRole === 'string' &&
		currentUser.appRole.trim().toUpperCase() === 'ADMIN'
	);

	return {
		tournaments: listResponse.tournaments,
		pagination: {
			page: listResponse.page,
			pageSize: listResponse.pageSize,
			total: listResponse.total,
			totalPages: listResponse.totalPages,
			hasMore: listResponse.hasMore
		},
		filters: {
			search: rawSearch,
			phase,
			sort
		},
		phaseOptions: PHASE_FILTER_VALUES,
		sortOptions: SORT_VALUES,
		isAdmin
	};
};
