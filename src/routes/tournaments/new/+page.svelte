<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();
	const { statusOptions, visibilityOptions } = data;

	type FormState = Record<string, string | undefined>;

	const values = (form?.values ?? {}) as FormState;
	const errors = (form?.errors ?? {}) as FormState;

	const backHref = resolve('/tournaments');
</script>

<svelte:head>
	<title>Create tournament | RMS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-2">
		<p class="text-sm text-muted-foreground">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={backHref} class="text-primary hover:underline">← Back to tournaments</a>
		</p>
		<h1 class="text-2xl font-semibold tracking-tight">Create a new tournament</h1>
		<p class="text-sm text-muted-foreground">
			Set up the core information now — you can refine announcements and documents after publishing.
		</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Tournament details</Card.Title>
			<Card.Description>These fields power the public view and registration windows.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if errors.global}
				<p class="mb-4 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{errors.global}
				</p>
			{/if}
			<form method="POST" class="grid gap-4 md:grid-cols-2">
				<div class="flex flex-col gap-2 md:col-span-2">
					<Label for="name">Tournament name</Label>
					<Input id="name" name="name" required maxlength={120} value={values.name ?? ''} />
					{#if errors.name}
						<p class="text-xs text-destructive">{errors.name}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="code">Code</Label>
					<Input id="code" name="code" required maxlength={20} value={values.code ?? ''} />
					{#if errors.code}
						<p class="text-xs text-destructive">{errors.code}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="location">Location</Label>
					<Input id="location" name="location" maxlength={160} value={values.location ?? ''} />
					{#if errors.location}
						<p class="text-xs text-destructive">{errors.location}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2 md:col-span-2">
					<Label for="description">Description</Label>
					<textarea
						id="description"
						name="description"
						rows={4}
						maxlength={2000}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>{values.description ?? ''}</textarea>
					{#if errors.description}
						<p class="text-xs text-destructive">{errors.description}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="startDate">Start date</Label>
					<Input id="startDate" name="startDate" type="datetime-local" value={values.startDate ?? ''} />
					{#if errors.startDate}
						<p class="text-xs text-destructive">{errors.startDate}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="endDate">End date</Label>
					<Input id="endDate" name="endDate" type="datetime-local" value={values.endDate ?? ''} />
					{#if errors.endDate}
						<p class="text-xs text-destructive">{errors.endDate}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="registrationDeadline">Registration deadline</Label>
					<Input id="registrationDeadline" name="registrationDeadline" type="datetime-local" value={values.registrationDeadline ?? ''} />
					{#if errors.registrationDeadline}
						<p class="text-xs text-destructive">{errors.registrationDeadline}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="teamCapacity">Team capacity</Label>
					<Input id="teamCapacity" name="teamCapacity" type="number" min="1" value={values.teamCapacity ?? ''} />
					{#if errors.teamCapacity}
						<p class="text-xs text-destructive">{errors.teamCapacity}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="allianceTeamLimit">Alliance team limit</Label>
					<Input id="allianceTeamLimit" name="allianceTeamLimit" type="number" min="1" value={values.allianceTeamLimit ?? '1'} />
					{#if errors.allianceTeamLimit}
						<p class="text-xs text-destructive">{errors.allianceTeamLimit}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="status">Status</Label>
					<select
						id="status"
						name="status"
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{#each statusOptions as option}
							<option value={option} selected={(values.status ?? 'DRAFT') === option}>
								{option.replaceAll('_', ' ')}
							</option>
						{/each}
					</select>
					{#if errors.status}
						<p class="text-xs text-destructive">{errors.status}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="visibility">Visibility</Label>
					<select
						id="visibility"
						name="visibility"
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{#each visibilityOptions as option}
							<option value={option} selected={(values.visibility ?? 'PUBLIC') === option}>
								{option}
							</option>
						{/each}
					</select>
					{#if errors.visibility}
						<p class="text-xs text-destructive">{errors.visibility}</p>
					{/if}
				</div>
				<div class="md:col-span-2 flex items-center justify-end gap-2">
					<Button type="submit">Create tournament</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
