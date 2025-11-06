<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();
	const { context, eligibleTeams } = data;

	const formatDate = (value?: number) => {
		if (!value) {
			return 'Not specified';
		}
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};

	const backHref = resolve(`/tournaments/${context.tournament.id}`);

	type FormState = Record<string, string | undefined>;

	const fieldErrors = (form?.errors ?? {}) as FormState;
	const values = (form?.values ?? {}) as FormState;
</script>

<svelte:head>
	<title>Register Team | {context.tournament.name}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-2">
		<p class="text-sm text-muted-foreground">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={backHref} class="text-primary hover:underline">← Back to tournament</a>
		</p>
		<h1 class="text-2xl font-semibold tracking-tight">Register your team</h1>
		<p class="text-sm text-muted-foreground">
			Provide a few details to reserve a spot for your team in {context.tournament.name}.
		</p>
	</header>

	<section class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Tournament summary</Card.Title>
				<Card.Description>Review the schedule before submitting your registration.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3 text-sm">
				<div>
					<p class="text-xs uppercase text-muted-foreground">Registration deadline</p>
					<p class="font-medium">{formatDate(context.tournament.registrationDeadline)}</p>
				</div>
				<div>
					<p class="text-xs uppercase text-muted-foreground">Start date</p>
					<p class="font-medium">{formatDate(context.tournament.startDate)}</p>
				</div>
				<div>
					<p class="text-xs uppercase text-muted-foreground">Teams registered</p>
					<p class="font-medium">{context.tournament.registeredTeams}</p>
				</div>
			</Card.Content>
		</Card.Root>
	</section>

	{#if eligibleTeams.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col gap-3 py-10 text-center text-sm text-muted-foreground">
				<p>All of your teams are already registered or you do not have permission to register a team.</p>
				<p>Contact an administrator if you believe this is an error.</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Team details</Card.Title>
				<Card.Description>Only teams that are not yet registered are listed below.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if fieldErrors.global}
					<p class="mb-4 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{fieldErrors.global}
					</p>
				{/if}
				<form method="POST" class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<Label for="teamId">Team</Label>
						<select
							id="teamId"
							name="teamId"
							required
							class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<option value="">Select a team</option>
							{#each eligibleTeams as team}
								<option value={team.id} selected={values.teamId === team.id}>{team.name}</option>
							{/each}
						</select>
						{#if fieldErrors.teamId}
							<p class="text-xs text-destructive">{fieldErrors.teamId}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<Label for="robotName">Robot name (optional)</Label>
						<Input id="robotName" name="robotName" value={values.robotName ?? ''} maxlength={200} />
						{#if fieldErrors.robotName}
							<p class="text-xs text-destructive">{fieldErrors.robotName}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<Label for="robotDescription">Robot description (optional)</Label>
						<textarea
							id="robotDescription"
							name="robotDescription"
							maxlength={500}
							rows={4}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>{values.robotDescription ?? ''}</textarea>
						{#if fieldErrors.robotDescription}
							<p class="text-xs text-destructive">{fieldErrors.robotDescription}</p>
						{/if}
					</div>
					<div class="flex items-center justify-end gap-2">
						<Button type="submit">Submit registration</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
