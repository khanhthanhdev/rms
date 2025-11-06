import type { PageServerLoad } from './$types';
import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

const TEAM_STATUS_VALUES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
const LIST_SORT_VALUES = ['recent', 'name_asc', 'name_desc'] as const;

type TeamStatus = (typeof TEAM_STATUS_VALUES)[number];
type ListSort = (typeof LIST_SORT_VALUES)[number];

const TEAM_STATUS_SET = new Set<TeamStatus>(TEAM_STATUS_VALUES);
const LIST_SORT_SET = new Set<ListSort>(LIST_SORT_VALUES);

const TEAM_PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url }) => {
	const client = createConvexHttpClient({});

	const parseStatus = (raw: string | null): TeamStatus | undefined => {
		if (!raw) {
			return undefined;
		}
		const normalized = raw.trim().toUpperCase();
		return TEAM_STATUS_SET.has(normalized as TeamStatus)
			? (normalized as TeamStatus)
			: undefined;
	};

	const parseSort = (raw: string | null): ListSort | undefined => {
		if (!raw) {
			return undefined;
		}
		const normalized = raw.trim().toLowerCase();
		return LIST_SORT_SET.has(normalized as ListSort) ? (normalized as ListSort) : undefined;
	};

	const pageParam = Number(url.searchParams.get('page') ?? '1');
	const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

	const searchParam = url.searchParams.get('search') ?? '';
	const locationParam = url.searchParams.get('location') ?? '';
	const status = parseStatus(url.searchParams.get('status'));
	const sort = parseSort(url.searchParams.get('sort')) ?? 'recent';

	const response = await client.query(api.teams.listTeams, {
		page,
		pageSize: TEAM_PAGE_SIZE,
		search: searchParam.trim() || undefined,
		location: locationParam.trim() || undefined,
		status,
		sort
	});

	return {
		teams: response.teams,
		pagination: {
			page: response.page,
			totalPages: response.totalPages,
			total: response.total,
			pageSize: response.pageSize,
			hasMore: response.hasMore
		},
		filters: {
			search: searchParam,
			location: locationParam,
			status: status ?? '',
			sort
		},
		canCreateTeam: response.canCreateTeam,
		statusOptions: TEAM_STATUS_VALUES,
		sortOptions: LIST_SORT_VALUES
	};
};
