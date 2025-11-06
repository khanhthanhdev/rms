<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import {
		Rocket,
		Shield,
		ChartColumn,
		Settings,
		Users,
		BookOpen,
		GitBranch,
		Cloud,
		Mail,
		PiggyBank
	} from '@lucide/svelte';

	const to = {
		signUp: resolve('/auth/sign-up'),
		signIn: resolve('/auth/sign-in'),
		dashboard: resolve('/dashboard'),
		tournaments: resolve('/tournaments')
	};
</script>

<section class="relative overflow-hidden">
	<div
		class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-background/60"
	></div>

	<div class="mx-auto max-w-6xl px-4 py-24 sm:py-36">
		<div class="mx-auto flex min-h-[40vh] items-center justify-center">
			<div class="max-w-3xl text-center">
				<h1 class="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
					National Robotics Competition
					<span class="bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
						STEAM for Vietnam</span
					>
				</h1>
				<p class="mt-4 text-pretty text-muted-foreground sm:text-lg">
					Join the premier robotics competition in Vietnam, fostering innovation, creativity, and
					STEM education. Compete with teams from across the nation and showcase your engineering
					skills in exciting challenges.
				</p>
			<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={to.signUp}><Button size="lg">Register Now</Button></a>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={to.tournaments}>
					<Button size="lg" variant="outline">Browse tournaments</Button>
				</a>
			</div>
			</div>
		</div>
	</div>
</section>

<footer class="border-t py-10 text-sm text-muted-foreground">
	<div
		class="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left"
	>
		<p>Organized by STEAM for Vietnam to promote robotics and STEM education nationwide.</p>
	</div>
</footer>
