<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { Eye, PencilLine, UserPlus2 } from '@lucide/svelte';

	const { data }: { data: PageData } = $props();
	const { tournaments, pagination, filters, phaseOptions, sortOptions, isAdmin } = data;

	let currentPage = $state(pagination.page);

	const formatPhaseLabel = (phase: string) =>
		phase
			.split('_')
			.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
			.join(' ');

	const phaseVariant = (
		phase: string
	): 'default' | 'destructive' | 'outline' | 'secondary' => {
		if (phase === 'REGISTRATION_OPEN') return 'default';
		if (phase === 'UPCOMING') return 'secondary';
		if (phase === 'IN_PROGRESS') return 'outline';
		if (phase === 'COMPLETED') return 'default';
		return 'destructive';
	};

	const formatDate = (value?: number) => {
		if (!value) {
			return 'TBD';
		}
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium'
		}).format(new Date(value));
	};

	const formatCapacity = (registered: number, capacity?: number) => {
		if (typeof capacity === 'number' && capacity > 0) {
			return `${registered} / ${capacity}`;
		}
		return String(registered);
	};

	const buildQuery = (overrides: Record<string, string | number | undefined>) => {
		const params = new URLSearchParams();

		if (filters.search.trim()) {
			params.set('search', filters.search.trim());
		}

		if (filters.phase) {
			params.set('phase', filters.phase);
		}

		if (filters.sort && filters.sort !== 'recent') {
			params.set('sort', filters.sort);
		}

		for (const [key, value] of Object.entries(overrides)) {
			if (value === undefined || value === null || value === '') {
				params.delete(key);
			} else {
				params.set(key, String(value));
			}
		}

		if (params.get('page') === '1') {
			params.delete('page');
		}

		const query = params.toString();
		return query ? `?${query}` : '';
	};

	const navigateToPage = (page: number) => {
		if (typeof window !== 'undefined') {
			window.location.href = `${resolve('/tournaments')}${buildQuery({ page })}`;
		}
	};

	const resetFilters = () => {
		if (typeof window !== 'undefined') {
			window.location.href = resolve('/tournaments');
		}
	};

	const newTournamentHref = resolve('/tournaments/new');

	const startItem = Math.min(
		(pagination.page - 1) * pagination.pageSize + 1,
		Math.max(pagination.total, 0)
	);
	const endItem = Math.min(pagination.page * pagination.pageSize, pagination.total);

	const viewHref = (id: string) => resolve(`/tournaments/${id}`);
	const registerHref = (id: string) => resolve(`/tournaments/${id}/register`);
	const editHref = (id: string) => resolve(`/tournaments/${id}/edit`);

	$effect(() => {
		currentPage = pagination.page;
	});
</script>

<svelte:head>
	<title>Tournaments | RMS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Tournaments</h1>
			<p class="text-sm text-muted-foreground">
				Explore upcoming competitions, review key details, and register your team.
			</p>
		</div>
		{#if isAdmin}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={newTournamentHref} class="self-start md:self-auto">
				<Button>Create tournament</Button>
			</a>
		{/if}
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Filter tournaments</Card.Title>
			<Card.Description>Search and organise the list to find the right event.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="GET" class="grid gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
				<input type="hidden" name="page" value="1" />
				<div class="flex flex-col gap-2 md:col-span-2">
					<Label for="tournament-search">Search</Label>
					<Input
						id="tournament-search"
						name="search"
						placeholder="Name, code, or location"
						value={filters.search}
					/>
				</div>
				<div class="flex flex-col gap-2 md:col-span-2">
					<Label for="tournament-phase">Phase</Label>
					<select
						id="tournament-phase"
						name="phase"
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						value={filters.phase}
					>
						<option value="">All phases</option>
						{#each phaseOptions as option}
							<option value={option}>{formatPhaseLabel(option)}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="tournament-sort">Sort</Label>
					<select
						id="tournament-sort"
						name="sort"
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						value={filters.sort}
					>
						{#each sortOptions as option}
							<option value={option}>{formatPhaseLabel(option)}</option>
						{/each}
					</select>
				</div>
				<div class="flex items-end gap-2">
					<Button type="submit" class="w-full md:w-auto">Apply</Button>
					<Button type="button" variant="outline" class="w-full md:w-auto" onclick={resetFilters}>
						Reset
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	{#if tournaments.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center gap-3 py-10 text-center">
				<p class="text-lg font-medium">No tournaments match your filters.</p>
				<p class="text-sm text-muted-foreground">
					Adjust the filters or check back later for new events.
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Content class="px-0">
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-border text-sm">
						<thead class="bg-muted/50 text-muted-foreground">
							<tr class="text-left">
								<th class="px-6 py-3 font-medium">Name</th>
								<th class="px-6 py-3 font-medium">Description</th>
								<th class="px-6 py-3 font-medium">Register Deadline</th>
								<th class="px-6 py-3 font-medium">Start Date</th>
								<th class="px-6 py-3 font-medium">Teams Registered</th>
								<th class="px-6 py-3 font-medium">Phase</th>
								<th class="px-6 py-3 font-medium text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each tournaments as tournament}
								<tr class="hover:bg-muted/30">
									<td class="px-6 py-4 align-top">
										<div class="font-medium">{tournament.name}</div>
										<div class="text-xs text-muted-foreground">Code: {tournament.code}</div>
									</td>
									<td class="px-6 py-4 align-top text-sm text-muted-foreground">
										{tournament.description ?? '—'}
									</td>
									<td class="px-6 py-4 align-top">{formatDate(tournament.registrationDeadline)}</td>
									<td class="px-6 py-4 align-top">{formatDate(tournament.startDate)}</td>
									<td class="px-6 py-4 align-top">{formatCapacity(tournament.registeredTeams, tournament.teamCapacity)}</td>
									<td class="px-6 py-4 align-top">
										<Badge variant={phaseVariant(tournament.phase)}>{formatPhaseLabel(tournament.phase.toLowerCase())}</Badge>
									</td>
									<td class="px-6 py-4 align-top">
										<div class="flex justify-end gap-1">
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<a href={viewHref(tournament.id)} title="View details">
												<Button variant="ghost" size="icon">
													<Eye class="size-4" />
												</Button>
											</a>
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<a href={registerHref(tournament.id)} title="Register a team">
												<Button variant="ghost" size="icon">
													<UserPlus2 class="size-4" />
												</Button>
											</a>
											{#if tournament.canEdit}
												<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
												<a href={editHref(tournament.id)} title="Edit tournament">
													<Button variant="ghost" size="icon">
														<PencilLine class="size-4" />
													</Button>
												</a>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card.Content>
			<Card.Footer class="flex flex-col items-start gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
				<p class="text-sm text-muted-foreground">
					Showing {pagination.total === 0 ? 0 : startItem} to {endItem} of {pagination.total}{' '}
					tournaments
				</p>
				{#if pagination.totalPages > 1}
					<Pagination.Root count={pagination.total} perPage={pagination.pageSize} bind:page={currentPage} class="ml-auto">
						{#snippet children({ pages, currentPage: activePage })}
							<Pagination.Content>
								<Pagination.Item>
									<Pagination.PrevButton
										disabled={activePage === 1}
										onclick={(event) => {
											event.preventDefault();
											if (activePage > 1) {
												navigateToPage(activePage - 1);
											}
										}}
									/>
								</Pagination.Item>
								{#each pages as page (page.key)}
									{#if page.type === 'ellipsis'}
										<Pagination.Item>
											<Pagination.Ellipsis />
										</Pagination.Item>
									{:else}
										<Pagination.Item>
											<Pagination.Link
												{page}
												isActive={activePage === page.value}
												onclick={(event) => {
													event.preventDefault();
													if (page.value !== activePage) {
														navigateToPage(page.value);
													}
												}}
											>
												{page.value}
											</Pagination.Link>
										</Pagination.Item>
									{/if}
								{/each}
								<Pagination.Item>
									<Pagination.NextButton
										disabled={activePage === pagination.totalPages}
										onclick={(event) => {
											event.preventDefault();
											if (activePage < pagination.totalPages) {
												navigateToPage(activePage + 1);
											}
										}}
									/>
								</Pagination.Item>
							</Pagination.Content>
						{/snippet}
					</Pagination.Root>
				{/if}
			</Card.Footer>
		</Card.Root>
	{/if}
</div>
