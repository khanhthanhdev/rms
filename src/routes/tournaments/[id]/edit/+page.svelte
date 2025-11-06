<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Trash2 } from '@lucide/svelte';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();
	const { editorContext, statusOptions, visibilityOptions } = data;

	const tournament = editorContext.tournament;

	const toDatetimeLocal = (value?: number) => {
		if (!value) {
			return '';
		}
		const date = new Date(value);
		const offsetMs = date.getTimezoneOffset() * 60000;
		return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
	};

	const backHref = resolve(`/tournaments/${tournament.id}`);

	const currentFormType = form?.formType ?? null;
	const updateResult = currentFormType === 'update' ? form : null;
	const announcementResult = currentFormType === 'announcement' ? form : null;
	const documentResult = currentFormType === 'document' ? form : null;

	type FormValues = Record<string, string | undefined>;
	type FormErrors = Record<string, string | undefined>;

	const updateValues = (updateResult?.values ?? {}) as FormValues;
	const announcementValues = (announcementResult?.values ?? {}) as FormValues;
	const documentValues = (documentResult?.values ?? {}) as FormValues;

	const updateErrors = (updateResult?.errors ?? {}) as FormErrors;
	const announcementErrors = (announcementResult?.errors ?? {}) as FormErrors;
	const documentErrors = (documentResult?.errors ?? {}) as FormErrors;
</script>

<svelte:head>
	<title>Edit {tournament.name} | RMS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-2">
		<p class="text-sm text-muted-foreground">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={backHref} class="text-primary hover:underline">← Back to tournament</a>
		</p>
		<h1 class="text-2xl font-semibold tracking-tight">Edit tournament</h1>
		<p class="text-sm text-muted-foreground">
			Update key details, publish announcements, and attach supporting documents.
		</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Tournament details</Card.Title>
			<Card.Description>Make sure the basics stay accurate — the public page reflects these values.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if updateErrors.global}
				<p class="mb-4 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{updateErrors.global}
				</p>
			{/if}
			{#if updateResult?.success}
				<p class="mb-4 rounded border border-emerald-400/70 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
					Tournament updated successfully.
				</p>
			{/if}
			<form method="POST" action="?/update" class="grid gap-4 md:grid-cols-2">
				<div class="flex flex-col gap-2 md:col-span-2">
					<Label for="name">Tournament name</Label>
					<Input
						id="name"
						name="name"
						required
						value={updateValues.name ?? tournament.name}
						maxlength={120}
					/>
					{#if updateErrors.name}
						<p class="text-xs text-destructive">{updateErrors.name}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="code">Code</Label>
					<Input id="code" name="code" required value={updateValues.code ?? tournament.code} maxlength={20} />
					{#if updateErrors.code}
						<p class="text-xs text-destructive">{updateErrors.code}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="location">Location</Label>
					<Input
						id="location"
						name="location"
						value={updateValues.location ?? tournament.location ?? ''}
						maxlength={160}
					/>
					{#if updateErrors.location}
						<p class="text-xs text-destructive">{updateErrors.location}</p>
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
					>{updateValues.description ?? tournament.description ?? ''}</textarea>
					{#if updateErrors.description}
						<p class="text-xs text-destructive">{updateErrors.description}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="startDate">Start date</Label>
					<Input
						id="startDate"
						name="startDate"
						type="datetime-local"
						value={updateValues.startDate ?? toDatetimeLocal(tournament.startDate)}
					/>
					{#if updateErrors.startDate}
						<p class="text-xs text-destructive">{updateErrors.startDate}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="endDate">End date</Label>
					<Input
						id="endDate"
						name="endDate"
						type="datetime-local"
						value={updateValues.endDate ?? toDatetimeLocal(tournament.endDate)}
					/>
					{#if updateErrors.endDate}
						<p class="text-xs text-destructive">{updateErrors.endDate}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="registrationDeadline">Registration deadline</Label>
					<Input
						id="registrationDeadline"
						name="registrationDeadline"
						type="datetime-local"
						value={updateValues.registrationDeadline ?? toDatetimeLocal(tournament.registrationDeadline)}
					/>
					{#if updateErrors.registrationDeadline}
						<p class="text-xs text-destructive">{updateErrors.registrationDeadline}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="teamCapacity">Team capacity</Label>
					<Input
						id="teamCapacity"
						name="teamCapacity"
						type="number"
						min="1"
						value={updateValues.teamCapacity ?? (tournament.teamCapacity ?? '')}
					/>
					{#if updateErrors.teamCapacity}
						<p class="text-xs text-destructive">{updateErrors.teamCapacity}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="allianceTeamLimit">Alliance team limit</Label>
					<Input
						id="allianceTeamLimit"
						name="allianceTeamLimit"
						type="number"
						min="1"
						value={updateValues.allianceTeamLimit ?? tournament.allianceTeamLimit}
					/>
					{#if updateErrors.allianceTeamLimit}
						<p class="text-xs text-destructive">{updateErrors.allianceTeamLimit}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="status">Status</Label>
					<select
						id="status"
						name="status"
						required
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{#each statusOptions as option}
							<option value={option} selected={(updateValues.status ?? tournament.status ?? 'DRAFT') === option}>
								{option.replaceAll('_', ' ')}
							</option>
						{/each}
					</select>
					{#if updateErrors.status}
						<p class="text-xs text-destructive">{updateErrors.status}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="visibility">Visibility</Label>
					<select
						id="visibility"
						name="visibility"
						required
						class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{#each visibilityOptions as option}
							<option value={option} selected={(updateValues.visibility ?? tournament.visibility ?? 'PUBLIC') === option}>
								{option}
							</option>
						{/each}
					</select>
					{#if updateErrors.visibility}
						<p class="text-xs text-destructive">{updateErrors.visibility}</p>
					{/if}
				</div>
				<div class="md:col-span-2 flex items-center justify-end gap-2">
					<Button type="submit">Save changes</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<section class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Announcements</Card.Title>
				<Card.Description>Share updates or reminders with teams. Publishing makes them visible immediately.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if announcementErrors.global}
					<p class="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{announcementErrors.global}
					</p>
				{/if}
				{#if announcementResult?.success}
					<p class="rounded border border-emerald-400/70 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
						Announcement saved.
					</p>
				{/if}
				<form method="POST" action="?/addAnnouncement" class="space-y-3">
					<div class="flex flex-col gap-2">
						<Label for="announcement-title">Title</Label>
						<Input
							id="announcement-title"
							name="title"
							required
							maxlength={140}
							value={announcementValues.title ?? ''}
						/>
						{#if announcementErrors.title}
							<p class="text-xs text-destructive">{announcementErrors.title}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<Label for="announcement-message">Message</Label>
						<textarea
							id="announcement-message"
							name="message"
							rows={4}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>{announcementValues.message ?? ''}</textarea>
						{#if announcementErrors.message}
							<p class="text-xs text-destructive">{announcementErrors.message}</p>
						{/if}
					</div>
					<div class="flex items-center justify-between gap-2">
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="publish" />
							<span>Publish immediately</span>
						</label>
						<Button type="submit">Add announcement</Button>
					</div>
				</form>
				{#if editorContext.announcements.length > 0}
					<div class="space-y-3">
						{#each editorContext.announcements as announcement}
							<Card.Root class="border-muted bg-muted/40">
								<Card.Header class="py-2">
									<Card.Title class="text-base">{announcement.title}</Card.Title>
									<Card.Description>
										Published: {new Date(announcement.createdAt).toLocaleString()}
									</Card.Description>
								</Card.Header>
								<Card.Content class="flex items-center justify-between gap-2 pb-3 text-sm">
									<p class="text-muted-foreground">{announcement.message}</p>
									<form method="POST" action="?/deleteAnnouncement">
										<input type="hidden" name="announcementId" value={announcement.id} />
										<Button variant="ghost" size="icon" aria-label="Delete announcement">
											<Trash2 class="size-4" />
										</Button>
									</form>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Documents</Card.Title>
				<Card.Description>Attach manuals, policies, or helpful links. Provide descriptive titles for clarity.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if documentErrors.global}
					<p class="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{documentErrors.global}
					</p>
				{/if}
				{#if documentResult?.success}
					<p class="rounded border border-emerald-400/70 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
						Document saved.
					</p>
				{/if}
				<form method="POST" action="?/addDocument" class="space-y-3">
					<div class="flex flex-col gap-2">
						<Label for="document-title">Title</Label>
						<Input
							id="document-title"
							name="title"
							required
							maxlength={140}
							value={documentValues.title ?? ''}
						/>
						{#if documentErrors.title}
							<p class="text-xs text-destructive">{documentErrors.title}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<Label for="document-url">URL</Label>
						<Input id="document-url" name="url" type="url" required value={documentValues.url ?? ''} />
						{#if documentErrors.url}
							<p class="text-xs text-destructive">{documentErrors.url}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<Label for="document-description">Description</Label>
						<textarea
							id="document-description"
							name="description"
							rows={3}
							maxlength={500}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>{documentValues.description ?? ''}</textarea>
						{#if documentErrors.description}
							<p class="text-xs text-destructive">{documentErrors.description}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<Label for="document-category">Category</Label>
						<Input id="document-category" name="category" maxlength={60} value={documentValues.category ?? ''} />
						{#if documentErrors.category}
							<p class="text-xs text-destructive">{documentErrors.category}</p>
						{/if}
					</div>
					<div class="flex items-center justify-between gap-2">
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="publish" checked />
							<span>Publish immediately</span>
						</label>
						<Button type="submit">Add document</Button>
					</div>
				</form>
				{#if editorContext.documents.length > 0}
					<div class="space-y-3">
						{#each editorContext.documents as document}
							<Card.Root class="border-muted bg-muted/40">
								<Card.Header class="py-2">
									<Card.Title class="text-base">{document.title}</Card.Title>
									<Card.Description>{document.url}</Card.Description>
								</Card.Header>
								<Card.Content class="flex items-center justify-between gap-2 pb-3 text-sm">
									<div class="flex flex-col gap-1">
										{#if document.description}
											<p class="text-muted-foreground">{document.description}</p>
										{/if}
										{#if document.category}
											<p class="text-xs uppercase text-muted-foreground">{document.category}</p>
										{/if}
									</div>
									<form method="POST" action="?/deleteDocument">
										<input type="hidden" name="documentId" value={document.id} />
										<Button variant="ghost" size="icon" aria-label="Delete document">
											<Trash2 class="size-4" />
										</Button>
									</form>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</section>
</div>
