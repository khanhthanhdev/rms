<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { CalendarDays, Clock3, FileText, MapPin, Trophy, UserPlus } from '@lucide/svelte';

	const { data }: { data: PageData } = $props();
	const { detail, viewer } = data;
	const { tournament, announcements, documents } = detail;

	let now = $state(Date.now());
	let interval: ReturnType<typeof setInterval> | null = null;

	const phaseLabel = tournament.phase
		.split('_')
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(' ');

	const phaseVariant = (() => {
		if (tournament.phase === 'REGISTRATION_OPEN') return 'default';
		if (tournament.phase === 'UPCOMING') return 'secondary';
		if (tournament.phase === 'IN_PROGRESS') return 'outline';
		if (tournament.phase === 'COMPLETED') return 'default';
		return 'destructive';
	})();

	const formatDateTime = (value?: number) => {
		if (!value) {
			return 'TBD';
		}
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};

	const formatRelative = (timestamp?: number) => {
		if (!timestamp) {
			return 'Not scheduled';
		}
		const diffMs = timestamp - now;
		const abs = Math.abs(diffMs);
		const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

		const minutes = Math.round(abs / 60000);
		if (minutes < 60) {
			return formatter.format(Math.round(diffMs / 60000), 'minute');
		}
		const hours = Math.round(abs / 3600000);
		if (hours < 48) {
			return formatter.format(Math.round(diffMs / 3600000), 'hour');
		}
		const days = Math.round(abs / 86400000);
		if (days < 60) {
			return formatter.format(Math.round(diffMs / 86400000), 'day');
		}
		const months = Math.round(abs / (86400000 * 30));
		return formatter.format(diffMs > 0 ? months : -months, 'month');
	};

	const countdownLabel = $derived(() => {
		if (!tournament.startDate) {
			return 'Start date not set';
		}
		const diff = tournament.startDate - now;
		if (diff > 0) {
			return `Starts ${formatRelative(tournament.startDate)}`;
		}
		return `Started ${formatRelative(tournament.startDate)} ago`;
	});

	const registerHref = resolve(`/tournaments/${tournament.id}/register`);
	const editHref = resolve(`/tournaments/${tournament.id}/edit`);

	onMount(() => {
		interval = setInterval(() => {
			now = Date.now();
		}, 1000 * 30);
	});

	onDestroy(() => {
		if (interval) {
			clearInterval(interval);
		}
	});

	const registeredSummary = (() => {
		if (tournament.teamCapacity && tournament.teamCapacity > 0) {
			return `${tournament.registeredTeams} / ${tournament.teamCapacity}`;
		}
		return `${tournament.registeredTeams}`;
	})();

	const registrationStatus = (() => {
		if (!tournament.registrationDeadline) {
			return 'Open';
		}
		return tournament.isRegistrationOpen
			? `Open until ${formatDateTime(tournament.registrationDeadline)}`
			: `Closed ${formatRelative(tournament.registrationDeadline)} ago`;
	})();
</script>

<svelte:head>
	<title>{tournament.name} | RMS Tournaments</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">{tournament.name}</h1>
			<p class="text-sm text-muted-foreground">Tournament code: {tournament.code}</p>
		</div>
		<div class="flex items-center gap-2">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={registerHref}>
				<Button variant="outline">Register a team</Button>
			</a>
			{#if viewer.canEdit}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={editHref}>
					<Button>Edit tournament</Button>
				</a>
			{/if}
		</div>
	</header>

	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card.Root>
			<Card.Content class="flex items-center gap-3 py-4">
				<Trophy class="size-10 rounded-lg bg-primary/10 p-2 text-primary" />
				<div>
					<p class="text-sm text-muted-foreground">Phase</p>
					<Badge variant={phaseVariant}>{phaseLabel}</Badge>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-3 py-4">
				<Clock3 class="size-10 rounded-lg bg-primary/10 p-2 text-primary" />
				<div>
					<p class="text-sm text-muted-foreground">Countdown</p>
					<p class="text-base font-medium">{countdownLabel}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-3 py-4">
				<UserPlus class="size-10 rounded-lg bg-primary/10 p-2 text-primary" />
				<div>
					<p class="text-sm text-muted-foreground">Teams registered</p>
					<p class="text-base font-medium">{registeredSummary}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-3 py-4">
				<CalendarDays class="size-10 rounded-lg bg-primary/10 p-2 text-primary" />
				<div>
					<p class="text-sm text-muted-foreground">Registration</p>
					<p class="text-base font-medium">{registrationStatus}</p>
				</div>
			</Card.Content>
		</Card.Root>
	</section>

	<Card.Root>
		<Card.Header>
			<Card.Title>Overview</Card.Title>
			<Card.Description>Key information about this tournament.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4 text-sm">
			{#if tournament.description}
				<p class="text-base leading-relaxed text-foreground/90">{tournament.description}</p>
			{/if}
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="flex items-start gap-3">
					<MapPin class="mt-1 size-4 text-muted-foreground" />
					<div>
						<p class="text-xs uppercase text-muted-foreground">Location</p>
						<p class="font-medium">{tournament.location ?? 'To be announced'}</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<CalendarDays class="mt-1 size-4 text-muted-foreground" />
					<div>
						<p class="text-xs uppercase text-muted-foreground">Start date</p>
						<p class="font-medium">{formatDateTime(tournament.startDate)}</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<CalendarDays class="mt-1 size-4 text-muted-foreground" />
					<div>
						<p class="text-xs uppercase text-muted-foreground">End date</p>
						<p class="font-medium">{formatDateTime(tournament.endDate)}</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<CalendarDays class="mt-1 size-4 text-muted-foreground" />
					<div>
						<p class="text-xs uppercase text-muted-foreground">Registration deadline</p>
						<p class="font-medium">{formatDateTime(tournament.registrationDeadline)}</p>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<section class="grid gap-6 lg:grid-cols-2">
		<Card.Root class="h-full">
			<Card.Header>
				<Card.Title>Announcements</Card.Title>
				<Card.Description>Updates and reminders from tournament administrators.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if announcements.length === 0}
					<p class="text-sm text-muted-foreground">No announcements yet.</p>
				{:else}
					{#each announcements as announcement}
						<Card.Root class="border-muted bg-muted/40">
							<Card.Header class="py-3">
								<Card.Title class="text-base">{announcement.title}</Card.Title>
								<Card.Description>
									Posted {formatDateTime(announcement.publishedAt ?? announcement.createdAt)}
								</Card.Description>
							</Card.Header>
							<Card.Content class="pb-4 text-sm leading-relaxed text-foreground/90">
								<p>{announcement.message}</p>
							</Card.Content>
						</Card.Root>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
		<Card.Root class="h-full">
			<Card.Header>
				<Card.Title>Documents & Resources</Card.Title>
				<Card.Description>
					Competition manuals, policies, and helpful links. External links open in a new tab.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if documents.length === 0}
					<p class="text-sm text-muted-foreground">No documents have been published yet.</p>
				{:else}
					{#each documents as document}
						<div class="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 p-4">
							<div class="flex flex-col gap-1">
								<div class="flex items-center gap-2">
									<FileText class="size-4 text-muted-foreground" />
									<span class="font-medium">{document.title}</span>
								</div>
								{#if document.description}
									<p class="text-sm text-muted-foreground">{document.description}</p>
								{/if}
								{#if document.category}
									<Badge variant="outline" class="w-fit text-xs uppercase tracking-wide">
										{document.category}
									</Badge>
								{/if}
							</div>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={document.url} target="_blank" rel="noreferrer" class="shrink-0">
								<Button variant="outline" size="sm">Open</Button>
							</a>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	</section>
</div>
