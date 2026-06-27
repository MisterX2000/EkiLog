<script lang="ts">
	import {
		TrainFront,
		ScanLine,
		Trash2,
		Settings as SettingsIcon,
		Map as MapIcon,
		MapPinned
	} from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { locales, getLocale, setLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import Settings from '$lib/components/Settings.svelte';
	import Scanner from '$lib/components/Scanner.svelte';
	import CheckInForm from '$lib/components/CheckInForm.svelte';
	import { journey } from '$lib/stores/journey.svelte';

	import { browser } from '$app/environment';

	type Tab = 'checkin' | 'settings';

	// Persist active tab in URL hash so locale reloads restore the correct view
	let activeTab = $state<Tab>(
		browser && window.location.hash === '#settings' ? 'settings' : 'checkin'
	);

	function setTab(tab: Tab) {
		activeTab = tab;
		if (browser) history.replaceState(null, '', `#${tab}`);
	}

	let resetSignal = $state(0);

	let d = $derived(journey.data);
	let hasCoords = $derived(
		d.departure_lat !== null &&
			d.departure_lon !== null &&
			d.arrival_lat !== null &&
			d.arrival_lon !== null
	);
</script>

<div class="min-h-dvh bg-base-200">
	<div
		class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-3 pb-24 pt-3 sm:px-4 sm:pb-28 sm:pt-4"
	>
		<header
			class="navbar rounded-box border border-base-300 bg-base-100/90 px-4 shadow-sm backdrop-blur"
		>
			<div class="navbar-start gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-box bg-primary/12 text-primary"
				>
					<TrainFront class="h-6 w-6" />
				</div>
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/50">
						{m.nav_subtitle()}
					</p>
					<h1 class="text-lg font-semibold tracking-tight">EkiLog</h1>
				</div>
			</div>
			<div class="navbar-end gap-2">
				<a
					class="btn btn-ghost btn-circle"
					href="https://github.com/MisterX2000/EkiLog"
					target="_blank"
					rel="noopener"
					title="GitHub"
				>
					<svg
						class="h-5 w-5 fill-current"
						role="img"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
						><title>GitHub</title><path
							d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
						/></svg
					>
				</a>
				<select
					value={getLocale()}
					onchange={(e) =>
						setLocale((e.target as HTMLSelectElement).value as (typeof locales)[number])}
					class="select select-sm w-20"
					aria-label="Language"
				>
					{#each locales as locale (locale)}
						<option value={locale}>{locale.toUpperCase()}</option>
					{/each}
				</select>
			</div>
		</header>

		<main class="flex-1 py-4 sm:py-6">
			{#if activeTab === 'settings'}
				<div in:fade={{ duration: 150 }} class="mx-auto max-w-4xl">
					<Settings />
				</div>
			{:else if activeTab === 'checkin'}
				<div in:fade={{ duration: 150 }} class="mx-auto flex max-w-4xl flex-col gap-5">
					<section class="card card-border bg-base-100 shadow-sm">
						<div class="card-body gap-4">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-box bg-secondary/14 text-secondary"
								>
									<ScanLine class="h-5 w-5" />
								</div>
								<div>
									<h2 class="card-title text-base">{m.scanner_title()}</h2>
									<p class="text-sm text-base-content/60">{m.scanner_subtitle()}</p>
								</div>
							</div>
							<Scanner />
						</div>
					</section>

					<section class="card card-border bg-base-100 shadow-sm">
						<div class="card-body gap-4">
							<div class="flex items-start justify-between gap-4">
								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-box bg-primary/12 text-primary"
									>
										<MapIcon class="h-5 w-5" />
									</div>
									<div>
										<h2 class="card-title text-base">{m.form_journey_details()}</h2>
										<p class="text-sm text-base-content/60">{m.form_journey_details_subtitle()}</p>
									</div>
								</div>
								<button
									type="button"
									onclick={() => {
										journey.reset();
										resetSignal++;
									}}
									title={m.nav_clear_inputs()}
									class="btn btn-ghost btn-sm btn-square"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
							{#key resetSignal}
								<CheckInForm />
							{/key}
						</div>
					</section>

					{#if browser && hasCoords}
						{#await import('$lib/components/Map.svelte') then { default: MapComp }}
							<section
								in:fly={{ y: 16, duration: 300 }}
								class="card card-border relative z-0 overflow-hidden bg-base-100 shadow-sm"
							>
								<div class="card-body gap-4">
									<div class="flex items-center gap-3">
										<div
											class="flex h-10 w-10 items-center justify-center rounded-box bg-accent/18 text-base-content"
										>
											<MapPinned class="h-5 w-5" />
										</div>
										<div>
											<h2 class="card-title text-base">{m.nav_map_title()}</h2>
											<p class="text-sm text-base-content/60">{m.nav_map_subtitle()}</p>
										</div>
									</div>
								</div>
								<div class="h-72 border-t border-base-300">
									<MapComp
										depLat={d.departure_lat}
										depLon={d.departure_lon}
										arrLat={d.arrival_lat}
										arrLon={d.arrival_lon}
										depName={d.departure_station}
										arrName={d.arrival_station}
									/>
								</div>
							</section>
						{/await}
					{:else if !hasCoords && (d.departure_station || d.arrival_station)}
						<section in:fly={{ y: 16, duration: 300 }} class="card card-dash bg-base-100 shadow-sm">
							<div
								class="card-body items-center justify-center gap-3 py-10 text-center text-base-content/60"
							>
								<MapPinned class="h-6 w-6" />
								<p>{m.nav_map_placeholder()}</p>
							</div>
						</section>
					{/if}
				</div>
			{/if}
		</main>
	</div>

	<div
		class="dock dock-md fixed inset-x-0 bottom-0 z-50 border-t border-base-300 bg-base-100/95 backdrop-blur"
	>
		<button class:dock-active={activeTab === 'checkin'} onclick={() => setTab('checkin')}>
			<TrainFront class="h-5 w-5" />
			<span class="dock-label">{m.nav_check_in()}</span>
		</button>
		<button class:dock-active={activeTab === 'settings'} onclick={() => setTab('settings')}>
			<SettingsIcon class="h-5 w-5" />
			<span class="dock-label">{m.nav_settings()}</span>
		</button>
	</div>
</div>
