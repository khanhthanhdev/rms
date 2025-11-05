<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onMount } from 'svelte';

	// This should be `Component` after @lucide/svelte updates types
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { teams: propTeams }: { teams: { name: string; logo: any; plan: string }[] } = $props();
	const sidebar = useSidebar();

	interface Team {
		id: string;
		name: string;
		role: 'TEAM_MENTOR' | 'TEAM_LEADER' | 'TEAM_MEMBER' | 'COMMON';
		team_name: string;
		plan?: string;
	}

	let teams: Team[] = $state([]);
	let activeTeam: Team | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Fetch teams from the backend
	async function fetchTeams() {
		try {
			// Import the auth query function you'll need to create
			const response = await fetch('/api/teams/current');
			if (!response.ok) {
				throw new Error('Failed to fetch teams');
			}
			const data = await response.json();
			
			teams = data.map((team: Team) => ({
				...team,
				name: team.team_name || team.name,
				plan: team.plan || 'Active' // Default plan
			}));
			
			// Set first team as active if none selected
			if (teams.length > 0 && !activeTeam) {
				activeTeam = teams[0];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Error fetching teams:', err);
		} finally {
			loading = false;
		}
	}

	// Switch to a different team
	async function switchTeam(team: Team) {
		try {
			const response = await fetch('/api/teams/switch', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ teamId: team.id }),
			});

			if (!response.ok) {
				throw new Error('Failed to switch team');
			}

			activeTeam = team;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Error switching team:', err);
		}
	}

	onMount(() => {
		fetchTeams();
		
		// Fall back to propTeams if provided (for backward compatibility)
		if (propTeams && propTeams.length > 0) {
			teams = propTeams.map(team => ({
				...team,
				id: Math.random().toString(),
				role: 'TEAM_MEMBER' as const,
				team_name: team.name,
			}));
			activeTeam = teams[0];
			loading = false;
		}
	});
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						{...props}
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<div
							class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
						>
							{#if activeTeam}
								<div class="text-sm font-bold">
									{activeTeam.name.charAt(0).toUpperCase()}
								</div>
							{:else}
								<div class="loading-dots">
									<span>•</span>
									<span>•</span>
									<span>•</span>
								</div>
							{/if}
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							{#if loading}
								<span class="truncate font-medium">Loading...</span>
								<span class="truncate text-xs">Fetching teams</span>
							{:else if error}
								<span class="truncate font-medium text-red-500">Error</span>
								<span class="truncate text-xs">{error}</span>
							{:else if activeTeam}
								<span class="truncate font-medium">
									{activeTeam.name}
								</span>
								<span class="truncate text-xs">
									{activeTeam.role.replace('_', ' ').toLowerCase()} • {activeTeam.plan || 'Active'}
								</span>
							{:else}
								<span class="truncate font-medium">No Teams</span>
								<span class="truncate text-xs">Join or create a team</span>
							{/if}
						</div>
						<ChevronsUpDownIcon class="ml-auto" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
				<DropdownMenu.Content
					class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
					align="start"
					side={sidebar.isMobile ? 'bottom' : 'right'}
					sideOffset={4}
			>
				<DropdownMenu.Label class="text-xs text-muted-foreground">
					{loading ? 'Loading teams...' : `Teams (${teams.length})`}
				</DropdownMenu.Label>
				
				{#if loading}
					<DropdownMenu.Item disabled class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border">
							<div class="loading-dots">
								<span>•</span>
								<span>•</span>
								<span>•</span>
							</div>
						</div>
						Loading teams...
					</DropdownMenu.Item>
				{:else if error}
					<DropdownMenu.Item disabled class="gap-2 p-2 text-red-500">
						<div class="flex size-6 items-center justify-center rounded-md border">
							<PlusIcon class="size-3.5" />
						</div>
						{error}
					</DropdownMenu.Item>
				{:else if teams.length === 0}
					<DropdownMenu.Item disabled class="gap-2 p-2 text-muted-foreground">
						<div class="flex size-6 items-center justify-center rounded-md border">
							<PlusIcon class="size-3.5" />
						</div>
						No teams available
					</DropdownMenu.Item>
				{:else}
					{#each teams as team, index (team.id)}
						<DropdownMenu.Item
							onSelect={() => switchTeam(team)}
							class={`gap-2 p-2 ${activeTeam?.id === team.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
						>
							<div class="flex size-6 items-center justify-center rounded-md border">
								<div class="text-xs font-bold bg-primary text-primary-foreground rounded w-full h-full flex items-center justify-center">
									{team.name.charAt(0).toUpperCase()}
								</div>
				</div>
				<div class="flex flex-col">
					<span class="font-medium">{team.name}</span>
					<span class="text-xs text-muted-foreground">
						{team.role.replace('_', ' ').toLowerCase()}
					</span>
				</div>
				<DropdownMenu.Shortcut>⌘{index + 1}</DropdownMenu.Shortcut>
			</DropdownMenu.Item>
		{/each}
	{/if}
				
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="gap-2 p-2" hidden={!!loading}>
					<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
						<PlusIcon class="size-4" />
					</div>
					<div class="font-medium text-muted-foreground">Join/Create Team</div>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>

<style>
	.loading-dots span {
		display: inline-block;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: currentColor;
		animation: loading 1.4s infinite ease-in-out both;
	}
	
	.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
	.loading-dots span:nth-child(2) { animation-delay: -0.16s; }
	.loading-dots span:nth-child(3) { animation-delay: 0; }
	
	@keyframes loading {
		0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
		40% { transform: scale(1); opacity: 1; }
	}
</style>
