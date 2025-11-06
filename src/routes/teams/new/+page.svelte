<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Alert } from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { AlertTriangle, CheckCircle2 } from '@lucide/svelte';

	interface ActionData {
		errors?: Record<string, string>;
		values?: {
			teamName?: string;
			location?: string;
			description?: string;
			imageUrl?: string;
			consent?: boolean;
		};
	}

	interface Props {
		data: PageData;
		form: ActionData | null;
	}

	const { data, form }: Props = $props();

	const creationContext = data.creationContext;
	const fieldErrors = form?.errors ?? {};
	const formValues = form?.values ?? {};

	const disableForm = !creationContext.canCreate;
	const consentChecked = formValues.consent ?? false;
	const newTeamHref = resolve('/teams');
</script>

<svelte:head>
	<title>Create Team | RMS</title>
</svelte:head>

<div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
	<Card.Root class="self-start">
		<Card.Header>
			<Card.Title>Create a new team</Card.Title>
			<Card.Description>
				Set up a team profile to manage members, registrations, and upcoming matches.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			{#if fieldErrors.global}
				<Alert variant="destructive">
					<AlertTriangle class="text-destructive" />
					<div data-slot="alert-content" class="space-y-1">
						<p data-slot="alert-title" class="font-medium">Unable to create team</p>
						<p data-slot="alert-description" class="text-sm text-destructive/90">
							{fieldErrors.global}
						</p>
					</div>
				</Alert>
			{/if}

			{#if disableForm && creationContext.reasons.length > 0}
				<Alert variant="destructive">
					<AlertTriangle class="text-destructive" />
					<div data-slot="alert-content" class="space-y-2">
						<p data-slot="alert-title" class="font-medium">Action required</p>
						<ul class="list-disc pl-5 text-sm text-destructive/90">
							{#each creationContext.reasons as reason}
								<li>{reason}</li>
							{/each}
						</ul>
					</div>
				</Alert>
			{/if}

			<form method="POST" class="space-y-6">
				<fieldset class="space-y-5" disabled={disableForm}>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="flex flex-col gap-2">
							<Label for="team-name">Team name</Label>
							<Input
								id="team-name"
								name="teamName"
								value={formValues.teamName ?? ''}
								placeholder="Robo Innovators"
								aria-invalid={fieldErrors.teamName ? 'true' : undefined}
							/>
							{#if fieldErrors.teamName}
								<p class="text-xs text-destructive">{fieldErrors.teamName}</p>
							{/if}
						</div>
						<div class="flex flex-col gap-2">
							<Label for="team-location">Location</Label>
							<Input
								id="team-location"
								name="location"
								value={formValues.location ?? ''}
								placeholder="Hanoi, Vietnam"
								aria-invalid={fieldErrors.location ? 'true' : undefined}
							/>
							{#if fieldErrors.location}
								<p class="text-xs text-destructive">{fieldErrors.location}</p>
							{/if}
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="team-description">
							Team description <span class="text-muted-foreground">(optional)</span>
						</Label>
						<textarea
							id="team-description"
							name="description"
							rows="4"
							class="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/30"
							aria-invalid={fieldErrors.description ? 'true' : undefined}
						>{formValues.description ?? ''}</textarea>
						{#if fieldErrors.description}
							<p class="text-xs text-destructive">{fieldErrors.description}</p>
						{/if}
					</div>

					<div class="flex flex-col gap-2">
						<Label for="team-image">
							Team avatar URL <span class="text-muted-foreground">(optional)</span>
						</Label>
						<Input
							id="team-image"
							name="imageUrl"
							type="url"
							value={formValues.imageUrl ?? ''}
							placeholder="https://example.com/team-logo.png"
							aria-invalid={fieldErrors.imageUrl ? 'true' : undefined}
						/>
						{#if fieldErrors.imageUrl}
							<p class="text-xs text-destructive">{fieldErrors.imageUrl}</p>
						{/if}
					</div>

					<div class="flex items-start gap-3 rounded-md border border-dashed border-border/70 px-4 py-3">
						<input
							type="checkbox"
							name="consent"
							id="team-consent"
							value="on"
							class="mt-1 size-4 rounded border-input shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							checked={consentChecked}
							aria-invalid={fieldErrors.consent ? 'true' : undefined}
						/>
						<div class="space-y-1">
							<Label for="team-consent" class="font-medium">
								I confirm the team consent requirements
							</Label>
							<p class="text-sm text-muted-foreground">
								By creating a team you confirm that mentors are 18+ and that parental/guardian consent
								has been obtained for all youth members.
							</p>
							{#if fieldErrors.consent}
								<p class="text-xs text-destructive">{fieldErrors.consent}</p>
							{/if}
						</div>
					</div>
				</fieldset>

				<div class="flex items-center justify-end gap-2">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={newTeamHref}>
						<Button type="button" variant="outline">Cancel</Button>
					</a>
					<Button type="submit" disabled={disableForm}>Create team</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<section class="space-y-4">
		<Card.Root class="self-start">
			<Card.Header>
				<Card.Title>Eligibility overview</Card.Title>
				<Card.Description>Quick view of the requirements to create a new team.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4 text-sm">
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Age requirement</span>
					<Badge variant={creationContext.age && creationContext.age >= 18 ? 'secondary' : 'outline'}>
						{creationContext.age !== undefined ? `${creationContext.age} years` : 'Unknown'}
					</Badge>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Active team memberships</span>
					<Badge variant="outline">{creationContext.activeMembershipCount}</Badge>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Teams mentored</span>
					<Badge variant="outline">{creationContext.mentorTeamCount}</Badge>
				</div>
				{#if creationContext.restrictedRoles.length > 0}
					<div class="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
						<strong>Heads up:</strong> current roles {creationContext.restrictedRoles.join(', ').toLowerCase()} allow participation in only one active team.
					</div>
				{/if}
				{#if creationContext.canCreate}
					<div class="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
						<CheckCircle2 class="size-4" />
						<span>You meet the requirements to create a new team.</span>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="self-start">
			<Card.Header>
				<Card.Title>What happens next?</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3 text-sm text-muted-foreground">
				<ul class="list-disc space-y-2 pl-5">
					<li>Invite mentors, leaders, and members from the team page after creation.</li>
					<li>Upload a team avatar to help officials recognise your team quickly.</li>
					<li>Keep team details up to date for tournament communication.</li>
				</ul>
			</Card.Content>
		</Card.Root>
	</section>
</div>
