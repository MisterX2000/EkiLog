<script lang="ts">
	import { MapPin, Navigation } from '@lucide/svelte';
	import { searchStations, findNearestStation, type StationEntry } from '$lib/db/stations';
	import { searchTraewellingStations, type TraewellingStation } from '$lib/api/traewelling';
	import { config } from '$lib/stores/config.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { SvelteSet } from 'svelte/reactivity';

	interface CombinedResult {
		label: string;
		sublabel?: string;
		source: 'local' | 'traewelling';
		lat: number | null;
		lon: number | null;
		traewellingId?: number;
		localEntry?: StationEntry;
	}

	interface Props {
		value: string;
		lat: number | null;
		lon: number | null;
		traewellingId?: number | null;
		placeholder?: string;
		onselect: (result: CombinedResult) => void;
	}

	let {
		value = $bindable(),
		lat = $bindable(),
		lon = $bindable(),
		traewellingId = $bindable(null),
		placeholder = 'Search station…',
		onselect
	}: Props = $props();

	let suggestions = $state<CombinedResult[]>([]);
	let showDropdown = $state(false);
	let geoLoading = $state(false);
	let searchLoading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	function clearResolvedStation() {
		lat = null;
		lon = null;
		traewellingId = null;
		void lat;
		void lon;
		void traewellingId;
	}

	function onInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		value = v;
		clearResolvedStation();

		clearTimeout(debounceTimer);
		if (v.trim().length < 1) {
			suggestions = [];
			showDropdown = false;
			return;
		}
		debounceTimer = setTimeout(() => runSearch(v), 250);
	}

	async function runSearch(q: string) {
		searchLoading = true;
		try {
			// Run both searches concurrently
			const [localResults, traeResults] = await Promise.allSettled([
				searchStations(q, 6),
				config.traewellingToken
					? searchTraewellingStations(q, config.traewellingToken)
					: Promise.resolve([] as TraewellingStation[])
			]);

			const combined: CombinedResult[] = [];
			const seenLabels = new SvelteSet<string>();

			// Local results first (Japanese names)
			if (localResults.status === 'fulfilled') {
				for (const s of localResults.value) {
					const label = s.name_kanji || s.name_romaji;
					if (!label || seenLabels.has(label)) continue;
					seenLabels.add(label);
					combined.push({
						label,
						sublabel: s.name_romaji && s.name_romaji !== label ? s.name_romaji : undefined,
						source: 'local',
						lat: s.lat,
						lon: s.lon,
						localEntry: s
					});
				}
			}

			// Träwelling results (may include romanised/English names)
			if (traeResults.status === 'fulfilled') {
				for (const s of traeResults.value) {
					const label = s.name;
					if (!label || seenLabels.has(label)) continue;
					seenLabels.add(label);
					combined.push({
						label,
						source: 'traewelling',
						lat: s.latitude,
						lon: s.longitude,
						traewellingId: s.id
					});
				}
			}

			suggestions = combined.slice(0, 10);
			showDropdown = suggestions.length > 0;
		} finally {
			searchLoading = false;
		}
	}

	function selectResult(r: CombinedResult) {
		value = r.label;
		lat = r.lat;
		lon = r.lon;
		traewellingId = r.traewellingId ?? null;
		suggestions = [];
		showDropdown = false;
		onselect(r);
	}

	async function geoLocate() {
		geoLoading = true;
		try {
			const pos = await new Promise<GeolocationPosition>((res, rej) =>
				navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10_000 })
			);
			const nearest = await findNearestStation(pos.coords.latitude, pos.coords.longitude);
			if (nearest) {
				const r: CombinedResult = {
					label: nearest.name_kanji || nearest.name_romaji,
					sublabel: nearest.name_romaji || undefined,
					source: 'local',
					lat: nearest.lat,
					lon: nearest.lon,
					localEntry: nearest
				};
				selectResult(r);
			}
		} catch {
			// silently ignore
		} finally {
			geoLoading = false;
		}
	}

	function onBlur() {
		setTimeout(() => {
			showDropdown = false;
		}, 150);
	}
</script>

<div class="relative">
	<div class="input w-full items-center gap-2">
		<MapPin class="h-4 w-4 shrink-0 text-base-content/45" />
		<input
			type="text"
			{placeholder}
			{value}
			oninput={onInput}
			onblur={onBlur}
			onfocus={() => value.trim() && (showDropdown = suggestions.length > 0)}
			class="grow text-sm"
		/>
		{#if searchLoading}
			<span class="loading loading-spinner loading-xs text-primary"></span>
		{:else}
			<button
				type="button"
				onclick={geoLocate}
				disabled={geoLoading}
				title={m.station_use_current_location()}
				class="btn btn-ghost btn-xs btn-square"
			>
				{#if geoLoading}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Navigation class="h-3.5 w-3.5" />
				{/if}
			</button>
		{/if}
	</div>

	{#if showDropdown && suggestions.length > 0}
		<div
			class="absolute z-50 mt-2 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
		>
			<div class="flex flex-col max-h-60 gap-1 overflow-y-auto rounded-box p-0">
				{#each suggestions as r (r.label + r.source)}
					<button
						type="button"
						class="btn btn-ghost flex w-full items-center gap-3 rounded-box px-3 py-2 text-left"
						onmousedown={() => selectResult(r)}
					>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{r.label}</span>
							{#if r.sublabel}
								<span class="block truncate text-xs text-base-content/50">{r.sublabel}</span>
							{/if}
						</span>
						<span
							class="badge badge-sm badge-soft ml-auto shrink-0 {r.source === 'local'
								? 'badge-success'
								: 'badge-info'}"
						>
							{r.source === 'local' ? 'JP DB' : 'Träwelling'}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
