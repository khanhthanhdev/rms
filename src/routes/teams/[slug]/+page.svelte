<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Alert } from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		ArrowLeft,
		UserPlus,
		Users,
		Mail,
		CalendarClock,
		Bell,
		MapPin,
		Image as ImageIcon,
		ClipboardList
	} from '@lucide/svelte';

	interface ActionDetails<TValues extends Record<string, unknown>> {
		errors?: Record<string, string>;
		values?: TValues;
	}

	interface ActionData {
		update?: ActionDetails<{
			teamName?: string;
			location?: string;
			description?: string;
			imageUrl?: string;
		}>;
		invite?: ActionDetails<{
			email?: string;
			role?: string;
		}>;
	}

	interface Props {
		data: PageData;
		form: ActionData | null;
	}

	const { data, form }: Props = $props();
	const { management, flash } = data;

	const updateErrors = form?.update?.errors ?? {};
	const inviteErrors = form?.invite?.errors ?? {};

	const updateValues = {
		teamName: form?.update?.values?.teamName ?? management.team.teamName,
		location: form?.update?.values?.location ?? management.team.location,
		description: form?.update?.values?.description ?? management.team.description ?? '',
		imageUrl: form?.update?.values?.imageUrl ?? management.team.avatarUrl ?? ''
	};

	const inviteValues = {
		email: form?.invite?.values?.email ?? '',
		role: (form?.invite?.values?.role ?? 'TEAM_MEMBER') as 'TEAM_LEADER' | 'TEAM_MEMBER'
	};

	const rolesOptions = [
		{ value: 'TEAM_LEADER', label: 'Team Leader' },
		{ value: 'TEAM_MEMBER', label: 'Team Member' }
	] as const;

	const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});
	const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

	const formatDateTime = (value?: number) => {
		if (!value) {
			return 'Not scheduled';
		}
		return dateTimeFormatter.format(new Date(value));
	};

	const formatDate = (value?: number) => {
		if (!value) {
			return 'Unknown';
		}
		return dateFormatter.format(new Date(value));
	};

	const formatLabel = (value: string) =>
		value
			.toLowerCase()
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');

	const membershipRole = management.membership?.role ?? null;
	const isMentor = management.membership?.isMentor ?? false;
	const canUpdate = management.permissions.canUpdate;
	const canInvite = management.permissions.canInvite;

	const teamListHref = resolve('/teams');

	const statusVariant = (status: string) => {
		switch (status) {
			case 'ACTIVE':
				return 'default';
			case 'DRAFT':
				return 'outline';
			case 'COMPLETED':
				return 'secondary';
			case 'ARCHIVED':
				return 'destructive';
			default:
				return 'outline';
		}
	};
</script>

<svelte:head>
	<title>{management.team.teamName} | Teams</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<section class="flex flex-col gap-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div class="space-y-1">
				<h1 class="text-2xl font-semibold tracking-tight">{management.team.teamName}</h1>
				<div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
					<span class="flex items-center gap-1">
						<ClipboardList class="size-4" />
						Team #{management.team.teamNumber}
					</span>
					<span class="flex items-center gap-1">
						<MapPin class="size-4" />
						{management.team.location}
					</span>
					<Badge variant={statusVariant(management.team.status)}>
						{formatLabel(management.team.status)}
					</Badge>
					{#if membershipRole}
						<Badge variant={isMentor ? 'default' : 'outline'}>
							{formatLabel(membershipRole)}
						</Badge>
					{/if}
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				{#if management.team.avatarUrl}
					<img
						src={management.team.avatarUrl}
						alt="{management.team.teamName} avatar"
						class="size-12 rounded-full border"
					/>
				{:else}
					<span class="flex size-12 items-center justify-center rounded-full border bg-muted text-sm font-medium text-muted-foreground">
						<ImageIcon class="size-5" />
					</span>
				{/if}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={teamListHref}>
					<Button variant="outline" size="sm">
						<ArrowLeft class="mr-2 size-4" />
						Back to teams
					</Button>
				</a>
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Content class="flex flex-col gap-1 py-3">
					<span class="text-sm text-muted-foreground">Created</span>
					<span class="text-base font-medium">{formatDate(management.team.createdAt)}</span>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="flex flex-col gap-1 py-3">
					<span class="text-sm text-muted-foreground">Last updated</span>
					<span class="text-base font-medium">{formatDateTime(management.team.updatedAt)}</span>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="flex flex-col gap-1 py-3">
					<span class="text-sm text-muted-foreground">Active members</span>
					<span class="text-base font-medium">{management.members.length}</span>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="flex flex-col gap-1 py-3">
					<span class="text-sm text-muted-foreground">Invitations pending</span>
					<span class="text-base font-medium">
						{management.invitations.filter((invite) => invite.status === 'PENDING').length}
					</span>
				</Card.Content>
			</Card.Root>
		</div>

		{#if flash.updated}
			<Alert>
				<Users class="text-primary" />
				<div data-slot="alert-content" class="space-y-1">
					<p data-slot="alert-title" class="font-medium">Team details updated</p>
					<p data-slot="alert-description" class="text-sm text-muted-foreground">
						Your changes were saved successfully.
					</p>
				</div>
			</Alert>
		{/if}

		{#if flash.invited}
			<Alert>
				<Mail class="text-primary" />
				<div data-slot="alert-content" class="space-y-1">
					<p data-slot="alert-title" class="font-medium">Invitation sent</p>
					<p data-slot="alert-description" class="text-sm text-muted-foreground">
						The invite was sent and will appear in the pending list below.
					</p>
				</div>
			</Alert>
		{/if}
	</section>

	<div class="grid gap-6 xl:grid-cols-[2fr_1fr]">
		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Team profile</Card.Title>
					<Card.Description>Update visible information for mentors, members, and officials.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					{#if updateErrors.global}
						<Alert variant="destructive">
							<Mail class="text-destructive" />
							<div data-slot="alert-content" class="space-y-1">
								<p data-slot="alert-title" class="font-medium">Update failed</p>
								<p data-slot="alert-description" class="text-sm text-destructive/90">
									{updateErrors.global}
								</p>
							</div>
						</Alert>
					{/if}

					{#if canUpdate}
						<form method="POST" action="?/update" class="space-y-5">
							<div class="grid gap-4 md:grid-cols-2">
								<div class="flex flex-col gap-2">
									<Label for="update-team-name">Team name</Label>
									<Input
										id="update-team-name"
										name="teamName"
										value={updateValues.teamName}
										aria-invalid={updateErrors.teamName ? 'true' : undefined}
									/>
									{#if updateErrors.teamName}
										<p class="text-xs text-destructive">{updateErrors.teamName}</p>
									{/if}
								</div>
								<div class="flex flex-col gap-2">
									<Label for="update-team-location">Location</Label>
									<Input
										id="update-team-location"
										name="location"
										value={updateValues.location}
										aria-invalid={updateErrors.location ? 'true' : undefined}
									/>
									{#if updateErrors.location}
										<p class="text-xs text-destructive">{updateErrors.location}</p>
									{/if}
								</div>
							</div>

							<div class="flex flex-col gap-2">
								<Label for="update-team-description">
									Description <span class="text-muted-foreground">(optional)</span>
								</Label>
								<textarea
									id="update-team-description"
									name="description"
									rows="4"
									class="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/40"
									aria-invalid={updateErrors.description ? 'true' : undefined}
								>{updateValues.description}</textarea>
								{#if updateErrors.description}
									<p class="text-xs text-destructive">{updateErrors.description}</p>
								{/if}
							</div>

							<div class="flex flex-col gap-2">
								<Label for="update-team-image">
									Avatar URL <span class="text-muted-foreground">(optional)</span>
								</Label>
								<Input
									id="update-team-image"
									name="imageUrl"
									type="url"
									value={updateValues.imageUrl}
									placeholder="https://example.com/team-logo.png"
									aria-invalid={updateErrors.imageUrl ? 'true' : undefined}
								/>
								{#if updateErrors.imageUrl}
									<p class="text-xs text-destructive">{updateErrors.imageUrl}</p>
								{/if}
							</div>

							<div class="flex items-center justify-end gap-2">
								<Button type="submit">Save changes</Button>
							</div>
						</form>
					{:else}
						<p class="text-sm text-muted-foreground">
							You have read-only access to this team. Contact a mentor to update the profile.
						</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<Card.Title>Members</Card.Title>
						<Card.Description>Active participants with their current roles.</Card.Description>
					</div>
					<Badge variant="outline">{management.members.length} active</Badge>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if management.members.length === 0}
						<p class="text-sm text-muted-foreground">No active members yet.</p>
					{:else}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Name</Table.Head>
									<Table.Head>Role</Table.Head>
									<Table.Head>Joined</Table.Head>
									<Table.Head class="text-right">Status</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each management.members as member (member.id)}
									<Table.Row class={member.userId === management.currentUserId ? 'bg-muted/40' : ''}>
										<Table.Cell>
											<div class="flex flex-col">
												<span class="font-medium">{member.fullName ?? member.email}</span>
												<span class="text-xs text-muted-foreground">{member.email}</span>
											</div>
										</Table.Cell>
										<Table.Cell>{formatLabel(member.role)}</Table.Cell>
										<Table.Cell>{formatDate(member.joinedAt)}</Table.Cell>
										<Table.Cell class="text-right">
											<Badge variant={member.role === 'TEAM_MENTOR' ? 'default' : 'outline'}>
												{member.userId === management.currentUserId ? 'You' : 'Active'}
											</Badge>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Invite members</Card.Title>
					<Card.Description>Mentors can invite leaders or members via email.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-5">
					{#if inviteErrors.global}
						<Alert variant="destructive">
							<Mail class="text-destructive" />
							<div data-slot="alert-content" class="space-y-1">
								<p data-slot="alert-title" class="font-medium">Invitation failed</p>
								<p data-slot="alert-description" class="text-sm text-destructive/90">
									{inviteErrors.global}
								</p>
							</div>
						</Alert>
					{/if}

					{#if canInvite}
						<form method="POST" action="?/invite" class="space-y-4">
							<div class="flex flex-col gap-2">
								<Label for="invite-email">Email</Label>
								<Input
									id="invite-email"
									name="email"
									type="email"
									value={inviteValues.email}
									placeholder="mentor@example.com"
									aria-invalid={inviteErrors.email ? 'true' : undefined}
								/>
								{#if inviteErrors.email}
									<p class="text-xs text-destructive">{inviteErrors.email}</p>
								{/if}
							</div>
							<div class="flex flex-col gap-2">
								<Label for="invite-role">Role</Label>
								<select
									id="invite-role"
									name="role"
									class="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									{#each rolesOptions as option}
										<option value={option.value} selected={inviteValues.role === option.value}>
											{option.label}
										</option>
									{/each}
								</select>
								{#if inviteErrors.role}
									<p class="text-xs text-destructive">{inviteErrors.role}</p>
								{/if}
							</div>
							<div class="flex items-center justify-end">
								<Button type="submit">
									<UserPlus class="mr-2 size-4" />
									Send invite
								</Button>
							</div>
						</form>
					{:else}
						<p class="text-sm text-muted-foreground">
							Only mentors can invite new team members.
						</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<Card.Title>Pending invitations</Card.Title>
						<Card.Description>Status of recent invites.</Card.Description>
					</div>
					<Badge variant="outline">{management.invitations.length}</Badge>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if management.invitations.length === 0}
						<p class="text-sm text-muted-foreground">No invitations have been sent.</p>
					{:else}
						<ul class="space-y-3 text-sm">
							{#each management.invitations as invitation (invitation.id)}
								<li class="flex items-start justify-between rounded-md border px-3 py-2">
									<div class="space-y-1">
										<p class="font-medium">{invitation.invitedEmail}</p>
										<p class="text-xs text-muted-foreground">
											{formatLabel(invitation.role)} • Expires {formatDate(invitation.expiresAt)}
										</p>
									</div>
									<Badge variant={invitation.status === 'PENDING' ? 'outline' : 'secondary'}>
										{formatLabel(invitation.status)}
									</Badge>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Upcoming matches</Card.Title>
					<Card.Description>Matches scheduled for this team.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if management.upcomingMatches.length === 0}
						<p class="text-sm text-muted-foreground">No matches scheduled yet.</p>
					{:else}
						<ul class="space-y-3 text-sm">
							{#each management.upcomingMatches as match (match.matchId)}
								<li class="flex items-start justify-between rounded-md border px-3 py-2">
									<div class="space-y-1">
										<p class="font-medium">Match {match.matchCode}</p>
										<p class="text-xs text-muted-foreground">
											<CalendarClock class="mr-1 inline size-3.5" />
											{formatDateTime(match.startTime)}
										</p>
									</div>
									<Badge variant={match.status === 'IN_PROGRESS' ? 'default' : 'outline'}>
										{formatLabel(match.status)}
									</Badge>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Notifications</Card.Title>
					<Card.Description>Latest items relevant to the team.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if management.notifications.length === 0}
						<p class="text-sm text-muted-foreground">No notifications at this time.</p>
					{:else}
						<ul class="space-y-2 text-sm">
							{#each management.notifications as notification (notification.id)}
								<li class="flex items-start gap-2 rounded-md border px-3 py-2">
									<Bell class="mt-0.5 size-4 text-muted-foreground" />
									<div class="space-y-1">
										<p class="font-medium">{notification.message}</p>
										<p class="text-xs text-muted-foreground">
											{formatDateTime(notification.createdAt)}
										</p>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
