<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { MapPin, Users, Sparkles } from '@lucide/svelte';

	interface Filters {
		search: string;
		location: string;
		status: string;
		sort: string;
	}

	const { data }: { data: PageData } = $props();
	const { teams, pagination, filters, canCreateTeam, statusOptions, sortOptions } = data;

	let currentPage = $state(pagination.page);

	const formatLabel = (value: string) =>
		value
			.toLowerCase()
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');

	const formatRole = (role?: string | null) => (role ? formatLabel(role) : '');

	const buildQuery = (overrides: Record<string, string | number | undefined>) => {
		const params = new URLSearchParams();
		const applyFilters: Filters = {
			search: filters.search,
			location: filters.location,
			status: filters.status,
			sort: filters.sort
		};

		if (applyFilters.search.trim()) {
			params.set('search', applyFilters.search.trim());
		}

		if (applyFilters.location.trim()) {
			params.set('location', applyFilters.location.trim());
		}

		if (applyFilters.status.trim()) {
			params.set('status', applyFilters.status.trim());
		}

		if (applyFilters.sort && applyFilters.sort !== 'recent') {
			params.set('sort', applyFilters.sort);
		}

		for (const [key, value] of Object.entries(overrides)) {
			if (value === undefined || value === '' || value === null) {
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

const resetFilters = () => {
	if (typeof window !== 'undefined') {
		window.location.href = resolve('/teams');
	}
};

const newTeamHref = resolve('/teams/new');

const navigateToPage = (page: number) => {
	if (typeof window !== 'undefined') {
		const target = `${resolve('/teams')}${buildQuery({ page })}`;
		window.location.href = target;
	}
};

	$effect(() => {
		currentPage = pagination.page;
	});

	const startItem = Math.min(
		(pagination.page - 1) * pagination.pageSize + 1,
		Math.max(pagination.total, 0)
	);
	const endItem = Math.min(pagination.page * pagination.pageSize, pagination.total);
</script>

<svelte:head>
	<title>Teams | RMS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Teams</h1>
			<p class="text-sm text-muted-foreground">
				Browse competition teams, review membership, and jump into management quickly.
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if canCreateTeam}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={newTeamHref}>
					<Button>Create new team</Button>
				</a>
			{:else}
				<Button variant="outline" disabled title="Team mentors or eligible adults can create teams">
					Create new team
				</Button>
			{/if}
		</div>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Filter teams</Card.Title>
			<Card.Description>Refine the list by name, location, or competition status.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="GET" class="grid gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
				<input type="hidden" name="page" value="1" />
				<div class="flex flex-col gap-2 md:col-span-2">
					<Label for="team-search">Search</Label>
					<Input
						id="team-search"
						name="search"
						value={filters.search}
						placeholder="Team name or number"
					/>
				</div>
				<div class="flex flex-col gap-2 md:col-span-2 lg:col-span-2">
					<Label for="team-location">Location</Label>
					<Input
						id="team-location"
						name="location"
						value={filters.location}
						placeholder="City, region, or school"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="team-status">Status</Label>
					<select
						id="team-status"
						name="status"
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						value={filters.status}
					>
						<option value="">All statuses</option>
						{#each statusOptions as option}
							<option value={option}>{formatLabel(option)}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="team-sort">Sort</Label>
					<select
						id="team-sort"
						name="sort"
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						value={filters.sort}
					>
						{#each sortOptions as option}
							<option value={option}>{formatLabel(option)}</option>
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

	{#if teams.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center gap-3 py-10 text-center">
				<Sparkles class="size-10 text-muted-foreground" />
				<div class="space-y-1">
					<h2 class="text-lg font-medium">No teams match your filters</h2>
					<p class="text-sm text-muted-foreground">
						Try adjusting the filters or create a new team to get started.
					</p>
				</div>
				{#if canCreateTeam}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={newTeamHref}>
						<Button size="sm">Create your first team</Button>
					</a>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each teams as team (team.id)}
				<Card.Root
					class={`transition-colors ${team.isOwnTeam ? 'border-primary ring-1 ring-primary/20' : ''}`}
				>
					<Card.Header class="space-y-3">
						<div class="flex items-start justify-between gap-3">
							<div>
								<Card.Title class="text-lg">{team.teamName}</Card.Title>
								<p class="text-sm text-muted-foreground">#{team.teamNumber}</p>
							</div>
							<Badge variant="outline">{formatLabel(team.status)}</Badge>
						</div>
						{#if team.description}
							<Card.Description class="line-clamp-3 text-sm text-muted-foreground">
								{team.description}
							</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content class="flex flex-col gap-4 text-sm">
						<div class="flex flex-col gap-2 text-muted-foreground">
							<div class="flex items-center gap-2">
								<MapPin class="size-4" />
								<span>{team.location}</span>
							</div>
							<div class="flex items-center gap-2">
								<Users class="size-4" />
								<span>
									{team.memberCount} member{team.memberCount === 1 ? '' : 's'}
								</span>
							</div>
							{#if team.membershipRole}
								<div class="flex items-center gap-2 text-foreground">
									<Sparkles class="size-4 text-primary" />
									<span>You are {formatRole(team.membershipRole)}</span>
								</div>
							{/if}
						</div>
						<div class="mt-2 flex items-center justify-between">
							{#if team.isOwnTeam}
								<Badge variant="secondary">Your team</Badge>
							{:else}
								<span class="text-sm text-muted-foreground">Team #{team.teamNumber}</span>
							{/if}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={resolve(`/teams/${team.teamNumber}`)}>
								<Button size="sm" variant="outline">View</Button>
							</a>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</section>

		{#if pagination.total > pagination.pageSize}
			<footer class="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
				<p>
					Showing {startItem} to {endItem} of {pagination.total} teams
				</p>
				<Pagination.Root count={pagination.total} perPage={pagination.pageSize} bind:page={currentPage}>
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
			</footer>
		{/if}
	{/if}
</div>
