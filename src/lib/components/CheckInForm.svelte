<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { m } from '$lib/paraglide/messages.js';
	import {
		TrainFront,
		CalendarClock,
		Armchair,
		CircleCheckBig,
		CircleAlert,
		Search,
		Eye,
		Briefcase,
		ChevronDown,
		Cuboid,
		PlaneLanding,
		PlaneTakeoff,
		TicketCheck,
		MapPlus,
		ExternalLink,
		Plus,
		Route,
		Settings2
	} from '@lucide/svelte';
	import { config } from '$lib/stores/config.svelte';
	import { journey } from '$lib/stores/journey.svelte';
	import {
		searchTraewellingStations,
		getDepartures,
		matchDeparture,
		createCheckin,
		createManualTrip,
		addStatusTag,
		TraewellingError,
		type Departure,
		type HafasTravelType
	} from '$lib/api/traewelling';
	import StationSearch from './StationSearch.svelte';

	interface CombinedResult {
		label: string;
		lat: number | null;
		lon: number | null;
		traewellingId?: number;
	}

	let submitStatus = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
	let submitError = $state('');
	let checkinUrl = $state('');

	// Trip lookup state
	let tripLookupStatus = $state<
		'idle' | 'loading' | 'found' | 'not_found' | 'no_departures' | 'error'
	>('idle');
	let foundDeparture = $state<Departure | null>(null);
	let availableDepartures = $state<Departure[]>([]);
	let showDepartureList = $state(false);

	// Manual trip fallback state
	let manualTripStatus = $state<'idle' | 'loading' | 'created' | 'error'>('idle');
	let manualTripError = $state('');
	let manualTripId = $state('');
	let manualLineNameInput = $state('');
	let manualLineNameTouched = $state(false);
	let manualCategory = $state<HafasTravelType>('nationalExpress');
	let manualJourneyNumber = $state('');

	// A trip is "ready" when we have a HAFAS departure OR a manually created trip
	let tripReady = $derived(foundDeparture !== null || manualTripStatus === 'created');

	// Per-journey overrides (default to config)
	let visibility = $state(config.defaultVisibility);
	let business = $state(config.defaultBusiness);

	let d = $derived(journey.data);

	// Default line name derived from train fields, overridable by user
	let defaultLineName = $derived([d.train_name, d.train_number].filter(Boolean).join(' '));
	let manualLineName = $derived(manualLineNameTouched ? manualLineNameInput : defaultLineName);

	// Arrival-before-departure validation
	let arrivalBeforeDeparture = $derived(
		!!d.departure_datetime && !!d.arrival_datetime && d.arrival_datetime <= d.departure_datetime
	);

	// Auto-trigger trip lookup with debounce when all required fields are filled
	let lookupDebounce: ReturnType<typeof setTimeout>;
	$effect(() => {
		const dep = d.departure_station;
		const depDatetime = d.departure_datetime;
		if (!dep || !depDatetime || !config.traewellingToken) return;
		// Only auto-lookup when in idle state (not after user has already done something)
		if (tripLookupStatus !== 'idle') return;
		clearTimeout(lookupDebounce);
		lookupDebounce = setTimeout(() => {
			lookupTrip();
		}, 500);
		return () => clearTimeout(lookupDebounce);
	});

	function onDepSelect(r: CombinedResult) {
		journey.update({
			departure_station: r.label,
			departure_lat: r.lat,
			departure_lon: r.lon,
			traewelling_origin_id: r.traewellingId ?? null
		});
		resetTripLookup();
	}

	function onArrSelect(r: CombinedResult) {
		journey.update({
			arrival_station: r.label,
			arrival_lat: r.lat,
			arrival_lon: r.lon,
			traewelling_destination_id: r.traewellingId ?? null
		});
	}

	function updateField(field: string, value: string) {
		journey.update({ [field]: value } as Parameters<typeof journey.update>[0]);
		if (field === 'departure_datetime') resetTripLookup();
	}

	function resetTripLookup() {
		tripLookupStatus = 'idle';
		foundDeparture = null;
		availableDepartures = [];
		showDepartureList = false;
		manualTripStatus = 'idle';
		manualTripId = '';
		manualLineNameInput = '';
		manualLineNameTouched = false;
		manualTripError = '';
		journey.update({ traewelling_origin_id: null });
	}

	function selectDeparture(dep: Departure) {
		foundDeparture = dep;
		tripLookupStatus = 'found';
		showDepartureList = false;
	}

	async function lookupTrip() {
		if (!config.traewellingToken) return;
		if (!d.departure_station || !d.departure_datetime) {
			submitError = m.error_fill_departure();
			submitStatus = 'error';
			return;
		}

		tripLookupStatus = 'loading';
		submitError = '';

		try {
			let originId = d.traewelling_origin_id;
			if (!originId) {
				const stations = await searchTraewellingStations(
					d.departure_station,
					config.traewellingToken
				);
				if (!stations.length) {
					throw new Error(m.error_station_not_found({ station: d.departure_station }));
				}
				originId = stations[0].id;
				journey.update({ traewelling_origin_id: originId });
			}

			if (!d.traewelling_destination_id && d.arrival_station) {
				const stations = await searchTraewellingStations(
					d.arrival_station,
					config.traewellingToken
				);
				if (stations.length) journey.update({ traewelling_destination_id: stations[0].id });
			}

			const departureISO = `${d.departure_datetime}:00`;
			const departures = await getDepartures(originId, departureISO, config.traewellingToken);

			if (!departures.length) {
				tripLookupStatus = 'no_departures';
				return;
			}

			availableDepartures = departures;
			const match = matchDeparture(departures, d.train_name, d.train_number);
			if (match) {
				foundDeparture = match;
				tripLookupStatus = 'found';
			} else {
				tripLookupStatus = 'not_found';
				showDepartureList = true;
			}
		} catch (e) {
			tripLookupStatus = 'error';
			submitError =
				e instanceof TraewellingError
					? `Träwelling error (${e.status}): ${e.message}`
					: e instanceof Error
						? e.message
						: String(e);
		}
	}

	async function submitCheckin() {
		if (!config.traewellingToken) {
			submitError = m.error_no_token();
			submitStatus = 'error';
			return;
		}
		if (!d.departure_station || !d.arrival_station) {
			submitError = m.error_no_stations();
			submitStatus = 'error';
			return;
		}
		if (!d.departure_datetime || !d.arrival_datetime) {
			submitError = m.error_no_datetime();
			submitStatus = 'error';
			return;
		}
		if (arrivalBeforeDeparture) {
			submitError = m.error_arrival_before_departure_msg();
			submitStatus = 'error';
			return;
		}
		if (!tripReady) {
			submitError = m.error_no_trip();
			submitStatus = 'error';
			return;
		}

		submitStatus = 'loading';
		submitError = '';

		try {
			let destinationId = d.traewelling_destination_id;
			if (!destinationId) {
				const stations = await searchTraewellingStations(
					d.arrival_station,
					config.traewellingToken
				);
				if (!stations.length)
					throw new Error(m.error_arrival_station_not_found({ station: d.arrival_station }));
				destinationId = stations[0].id;
				journey.update({ traewelling_destination_id: destinationId });
			}

			const originId = d.traewelling_origin_id!;
			const departureISO = `${d.departure_datetime}:00`;
			const arrivalISO = `${d.arrival_datetime}:00`;

			// Resolve tripId and lineName — from HAFAS departure or manual trip
			const usedTripId = foundDeparture ? foundDeparture.tripId : manualTripId;
			const usedLineName = foundDeparture ? foundDeparture.line.name : manualLineName;

			// Build status body from seat/car details only (train name is already in lineName)
			const bodyParts: string[] = [];
			if (d.car_number) bodyParts.push(m.body_car({ number: d.car_number }));
			if (d.seat_number) bodyParts.push(m.body_seat({ number: d.seat_number }));

			const result = await createCheckin(
				{
					tripId: usedTripId,
					lineName: usedLineName,
					start: originId,
					destination: destinationId,
					departure: departureISO,
					arrival: arrivalISO,
					body: bodyParts.length > 0 ? bodyParts.join(', ') : undefined,
					visibility,
					business
				},
				config.traewellingToken
			);

			const statusId = result?.status?.id;

			if (statusId) {
				// Seat/car tags (machine-readable) — visible to API consumers
				const tags: Array<{ key: string; value: string }> = [];
				if (d.car_number) tags.push({ key: 'trwl:wagon', value: d.car_number });
				if (d.seat_number) tags.push({ key: 'trwl:seat', value: d.seat_number });
				for (const tag of tags) {
					await addStatusTag(statusId, tag, config.traewellingToken).catch(() => {});
				}
				checkinUrl = `https://traewelling.de/status/${statusId}`;
			}

			submitStatus = 'success';
		} catch (e) {
			submitStatus = 'error';
			submitError =
				e instanceof TraewellingError
					? `Träwelling error (${e.status}): ${e.message}`
					: e instanceof Error
						? e.message
						: String(e);
		}
	}

	function resetForm() {
		journey.reset();
		submitStatus = 'idle';
		submitError = '';
		checkinUrl = '';
		tripLookupStatus = 'idle';
		foundDeparture = null;
		availableDepartures = [];
		manualTripStatus = 'idle';
		manualTripId = '';
		manualLineNameInput = '';
		manualLineNameTouched = false;
		manualTripError = '';
		visibility = config.defaultVisibility;
		business = config.defaultBusiness;
	}

	function formatTime(iso: string) {
		try {
			return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return iso;
		}
	}

	async function createManualTripFn() {
		if (!config.traewellingToken) return;
		if (
			!d.departure_station ||
			!d.arrival_station ||
			!d.departure_datetime ||
			!d.arrival_datetime
		) {
			manualTripError = m.error_fill_all_fields();
			return;
		}

		manualTripStatus = 'loading';
		manualTripError = '';

		try {
			// Resolve station IDs if not already set
			let originId = d.traewelling_origin_id;
			if (!originId) {
				const stations = await searchTraewellingStations(
					d.departure_station,
					config.traewellingToken
				);
				if (!stations.length)
					throw new Error(m.error_station_not_found_manual({ station: d.departure_station }));
				originId = stations[0].id;
				journey.update({ traewelling_origin_id: originId });
			}

			let destinationId = d.traewelling_destination_id;
			if (!destinationId) {
				const stations = await searchTraewellingStations(
					d.arrival_station,
					config.traewellingToken
				);
				if (!stations.length)
					throw new Error(m.error_station_not_found_manual({ station: d.arrival_station }));
				destinationId = stations[0].id;
				journey.update({ traewelling_destination_id: destinationId });
			}

			const journeyNum = manualJourneyNumber ? parseInt(manualJourneyNumber, 10) : null;
			const lineName = manualLineName.trim() || defaultLineName || 'Unknown';
			const effectiveCategory = (d.train_type as HafasTravelType) || manualCategory;

			const trip = await createManualTrip(
				{
					category: effectiveCategory,
					lineName,
					journeyNumber: journeyNum && !isNaN(journeyNum) ? journeyNum : null,
					originId,
					originDeparturePlanned: `${d.departure_datetime}:00`,
					destinationId,
					destinationArrivalPlanned: `${d.arrival_datetime}:00`
				},
				config.traewellingToken
			);

			manualTripId = trip.tripId;
			manualLineNameTouched = true;
			manualLineNameInput = trip.lineName ?? lineName;
			manualTripStatus = 'created';
		} catch (e) {
			manualTripStatus = 'error';
			manualTripError =
				e instanceof TraewellingError
					? `Träwelling error (${e.status}): ${e.message}`
					: e instanceof Error
						? e.message
						: String(e);
		}
	}
</script>

<div class="space-y-5">
	{#if submitStatus === 'success'}
		<section
			transition:fade={{ duration: 200 }}
			class="card border border-success/30 bg-success/10 shadow-sm"
		>
			<div class="card-body items-center gap-4 text-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-success/18 text-success"
				>
					<CircleCheckBig class="h-9 w-9" />
				</div>
				<div class="space-y-1">
					<h3 class="text-lg font-semibold">{m.form_checked_in_title()}</h3>
					<p class="text-sm text-base-content/70">{d.departure_station} → {d.arrival_station}</p>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row">
					{#if checkinUrl}
						<button
							type="button"
							onclick={() => window.open(checkinUrl, '_blank', 'noopener,noreferrer')}
							class="btn btn-primary"
						>
							<ExternalLink class="h-4 w-4" />
							{m.form_view_on_traewelling()}
						</button>
					{/if}
					<button onclick={resetForm} class="btn btn-ghost">
						<Plus class="h-4 w-4" />
						{m.form_new_check_in()}
					</button>
				</div>
			</div>
		</section>
	{:else}
		<section class="card card-border bg-base-200/50 shadow-sm">
			<div class="card-body gap-5">
				<div class="flex items-start gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-box bg-primary/12 text-primary"
					>
						<Route class="h-5 w-5" />
					</div>
					<div class="space-y-1">
						<h3 class="card-title text-base">{m.form_section_route()}</h3>
						<p class="text-sm text-base-content/60">-TODO-</p>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<PlaneTakeoff class="h-3.5 w-3.5" />
							{m.form_departure_station()}
						</legend>
						<StationSearch
							bind:value={d.departure_station}
							bind:lat={d.departure_lat}
							bind:lon={d.departure_lon}
							placeholder="東京 / Tokyo"
							onselect={onDepSelect}
						/>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<PlaneLanding class="h-3.5 w-3.5" />
							{m.form_arrival_station()}
						</legend>
						<StationSearch
							bind:value={d.arrival_station}
							bind:lat={d.arrival_lat}
							bind:lon={d.arrival_lon}
							placeholder="新大阪 / Shin-Osaka"
							onselect={onArrSelect}
						/>
					</fieldset>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<CalendarClock class="h-3.5 w-3.5" />
							{m.form_departure()}
						</legend>
						<input
							id="dep-datetime"
							type="datetime-local"
							value={d.departure_datetime}
							oninput={(e) =>
								updateField('departure_datetime', (e.target as HTMLInputElement).value)}
							class="input w-full"
						/>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<CalendarClock class="h-3.5 w-3.5" />
							{m.form_arrival()}
						</legend>
						<input
							id="arr-datetime"
							type="datetime-local"
							value={d.arrival_datetime}
							min={d.departure_datetime || undefined}
							oninput={(e) => updateField('arrival_datetime', (e.target as HTMLInputElement).value)}
							class="input w-full {arrivalBeforeDeparture ? 'input-error' : ''}"
						/>
						{#if arrivalBeforeDeparture}
							<p transition:fly={{ y: -4, duration: 150 }} class="label text-error">
								<CircleAlert class="h-3.5 w-3.5" />
								{m.form_arrival_before_departure()}
							</p>
						{/if}
					</fieldset>
				</div>
			</div>
		</section>

		<section class="card card-border bg-base-100 shadow-sm">
			<div class="card-body gap-5">
				<div class="flex items-start gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-box bg-secondary/14 text-secondary"
					>
						<TrainFront class="h-5 w-5" />
					</div>
					<div class="space-y-1">
						<h3 class="card-title text-base">{m.form_section_train()}</h3>
						<p class="text-sm text-base-content/60">
							{d.car_number || d.seat_number
								? m.form_seat_comment_filled()
								: m.form_seat_comment_empty()}
						</p>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<TrainFront class="h-3.5 w-3.5" />
							{m.form_train_name()}
						</legend>
						<input
							id="train-name"
							type="text"
							placeholder="Nozomi"
							value={d.train_name}
							oninput={(e) => updateField('train_name', (e.target as HTMLInputElement).value)}
							class="input w-full"
						/>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<TrainFront class="h-3.5 w-3.5" />
							{m.form_train_number()}
						</legend>
						<input
							id="train-number"
							type="text"
							placeholder="23"
							value={d.train_number}
							oninput={(e) => updateField('train_number', (e.target as HTMLInputElement).value)}
							class="input w-full"
						/>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<Cuboid class="h-3.5 w-3.5" />
							{m.form_car_number()}
						</legend>
						<input
							id="car-number"
							type="text"
							placeholder="7"
							value={d.car_number}
							oninput={(e) => updateField('car_number', (e.target as HTMLInputElement).value)}
							class="input w-full"
						/>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<Armchair class="h-3.5 w-3.5" />
							{m.form_seat_number()}
						</legend>
						<input
							id="seat-number"
							type="text"
							placeholder="12A"
							value={d.seat_number}
							oninput={(e) => updateField('seat_number', (e.target as HTMLInputElement).value)}
							class="input w-full"
						/>
					</fieldset>
				</div>
			</div>
		</section>

		<section class="card card-border bg-base-100 shadow-sm">
			<div class="card-body gap-5">
				<div class="flex items-start gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-box bg-accent/18 text-base-content"
					>
						<Settings2 class="h-5 w-5" />
					</div>
					<div class="space-y-1">
						<h3 class="card-title text-base">{m.form_section_options()}</h3>
						<p class="text-sm text-base-content/60">-TODO-</p>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<Eye class="h-3.5 w-3.5" />
							{m.form_visibility()}
						</legend>
						<select id="visibility" bind:value={visibility} class="select w-full">
							<option value={0}>{m.form_vis_public()}</option>
							<option value={1}>{m.form_vis_unlisted()}</option>
							<option value={2}>{m.form_vis_followers_only()}</option>
							<option value={3}>{m.form_vis_private()}</option>
							<option value={4}>{m.form_vis_authenticated()}</option>
							<option value={5}>{m.form_vis_trusted()}</option>
						</select>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend flex items-center gap-2">
							<Briefcase class="h-3.5 w-3.5" />
							{m.form_journey_type()}
						</legend>
						<select id="business" bind:value={business} class="select w-full">
							<option value={0}>{m.form_biz_private()}</option>
							<option value={1}>{m.form_biz_business()}</option>
							<option value={2}>{m.form_biz_commute()}</option>
						</select>
					</fieldset>
				</div>
			</div>
		</section>

		<section class="card card-border bg-base-200/50 shadow-sm">
			<div class="card-body gap-5">
				<div class="flex items-start justify-between gap-4">
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-box bg-info/14 text-info"
						>
							<Search class="h-5 w-5" />
						</div>
						<div class="space-y-1">
							<h3 class="card-title text-base">{m.form_trip_lookup_title()}</h3>
							<p class="text-sm text-base-content/60">{m.form_lookup_hint()}</p>
						</div>
					</div>
					{#if tripLookupStatus === 'found' && foundDeparture}
						<span class="badge badge-success badge-soft">{m.form_trip_matched()}</span>
					{:else if manualTripStatus === 'created'}
						<span class="badge badge-info badge-soft">{m.form_manual_trip_created()}</span>
					{/if}
				</div>

				{#if tripLookupStatus === 'found' && foundDeparture}
					<div
						in:fly={{ y: 4, duration: 200 }}
						role="alert"
						class="alert alert-success alert-soft sm:alert-horizontal"
					>
						<div class="min-w-0">
							<span class="font-semibold">{foundDeparture.line.name}</span>
							{#if foundDeparture.direction}
								<span class="ml-1 text-base-content/70">→ {foundDeparture.direction}</span>
							{/if}
						</div>
						<span class="badge badge-ghost">{formatTime(foundDeparture.plannedWhen)}</span>
					</div>
					{#if availableDepartures.length > 1}
						<button
							type="button"
							onclick={() => (showDepartureList = !showDepartureList)}
							class="btn btn-ghost btn-sm w-fit"
						>
							<ChevronDown class="h-4 w-4" />
							{m.form_wrong_train()}
						</button>
					{/if}
				{:else if manualTripStatus === 'created'}
					<div
						in:fly={{ y: 4, duration: 200 }}
						role="alert"
						class="alert alert-info alert-soft sm:alert-horizontal"
					>
						<span class="font-semibold">{manualLineName}</span>
						<button
							type="button"
							onclick={() => {
								manualTripStatus = 'idle';
								manualTripId = '';
							}}
							class="btn btn-ghost btn-xs"
						>
							{m.form_reset()}
						</button>
					</div>
				{:else if tripLookupStatus === 'not_found'}
					<div role="alert" class="alert alert-warning alert-soft">
						<CircleAlert class="h-4 w-4" />
						<span>{m.form_not_found()}</span>
					</div>
				{:else if tripLookupStatus === 'no_departures'}
					<div role="alert" class="alert alert-warning alert-soft">
						<CircleAlert class="h-4 w-4" />
						<span>{m.form_no_departures()}</span>
					</div>
				{:else if tripLookupStatus === 'error'}
					<div role="alert" class="alert alert-error alert-soft">
						<CircleAlert class="h-4 w-4" />
						<span>{submitError}</span>
					</div>
				{/if}

				{#if showDepartureList && availableDepartures.length > 0}
					<ul
						transition:slide={{ duration: 200 }}
						class="menu rounded-box border border-base-300 bg-base-100"
					>
						{#each availableDepartures as dep (dep.tripId)}
							<li>
								<button
									type="button"
									class:menu-active={foundDeparture?.tripId === dep.tripId}
									onclick={() => selectDeparture(dep)}
								>
									<span>{dep.line.name}{dep.direction ? ` → ${dep.direction}` : ''}</span>
									<span class="badge badge-ghost badge-sm">{formatTime(dep.plannedWhen)}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if manualTripStatus !== 'created'}
					{#if tripLookupStatus === 'idle'}
						<p class="text-sm text-base-content/55">{m.form_autosearch_hint()}</p>
					{:else if tripLookupStatus === 'loading'}
						<div class="flex items-center gap-2 text-sm text-base-content/60">
							<span class="loading loading-spinner loading-sm text-primary"></span>
							<span>{m.form_searching()}</span>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => {
								resetTripLookup();
							}}
							disabled={!config.traewellingToken}
							class="btn btn-ghost btn-sm w-fit"
						>
							<Search class="h-4 w-4" />
							{m.form_retry_search()}
						</button>
					{/if}
				{/if}

				{#if (tripLookupStatus === 'no_departures' || tripLookupStatus === 'not_found' || tripLookupStatus === 'error') && manualTripStatus !== 'created'}
					<div
						transition:slide={{ duration: 250 }}
						class="rounded-box border border-base-300 bg-base-100 p-4"
					>
						<div class="mb-4 flex items-start gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-box bg-info/14 text-info"
							>
								<MapPlus class="h-5 w-5" />
							</div>
							<div class="space-y-1">
								<h4 class="font-semibold">{m.form_create_manual_trip_heading()}</h4>
								<p class="text-sm text-base-content/60">{m.form_create_manual_trip_btn()}</p>
							</div>
						</div>

						<div class="grid gap-3 sm:grid-cols-2">
							<fieldset class="fieldset">
								<legend class="fieldset-legend">{m.form_category()}</legend>
								<select
									id="manual-category"
									value={(d.train_type || manualCategory) as HafasTravelType}
									onchange={(e) =>
										(manualCategory = (e.target as HTMLSelectElement).value as HafasTravelType)}
									class="select w-full"
								>
									<option value="nationalExpress">{m.train_type_national_express()}</option>
									<option value="national">{m.train_type_national()}</option>
									<option value="regionalExp">{m.train_type_regional_exp()}</option>
									<option value="regional">{m.train_type_regional()}</option>
									<option value="suburban">{m.train_type_suburban()}</option>
									<option value="subway">{m.train_type_subway()}</option>
									<option value="tram">{m.train_type_tram()}</option>
									<option value="bus">{m.train_type_bus()}</option>
									<option value="ferry">{m.train_type_ferry()}</option>
								</select>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">{m.form_line_name()}</legend>
								<input
									id="manual-line"
									type="text"
									placeholder="Nozomi 23"
									value={manualLineName}
									oninput={(e) => {
										manualLineNameTouched = true;
										manualLineNameInput = (e.target as HTMLInputElement).value;
									}}
									class="input w-full"
								/>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">
									{m.form_journey_number()}
									<span class="text-base-content/45">{m.form_optional()}</span>
								</legend>
								<input
									id="manual-journey"
									type="number"
									placeholder="23"
									bind:value={manualJourneyNumber}
									class="input w-full"
								/>
							</fieldset>
						</div>

						{#if manualTripError}
							<div
								transition:fly={{ y: 4, duration: 150 }}
								role="alert"
								class="mt-3 alert alert-error alert-soft"
							>
								<CircleAlert class="h-4 w-4" />
								<span>{manualTripError}</span>
							</div>
						{/if}

						<button
							type="button"
							onclick={createManualTripFn}
							disabled={manualTripStatus === 'loading' ||
								!config.traewellingToken ||
								!d.departure_station ||
								!d.arrival_station ||
								!d.departure_datetime ||
								!d.arrival_datetime}
							class="btn btn-primary mt-4 w-full sm:w-fit"
						>
							{#if manualTripStatus === 'loading'}
								<span class="loading loading-spinner loading-sm"></span>
								{m.form_creating_trip()}
							{:else}
								<MapPlus class="h-4 w-4" />
								{m.form_create_manual_trip_btn()}
							{/if}
						</button>
					</div>
				{/if}
			</div>
		</section>

		{#if submitStatus === 'error'}
			<div
				transition:fly={{ y: 8, duration: 200 }}
				role="alert"
				class="alert alert-error alert-soft"
			>
				<CircleAlert class="h-4 w-4 shrink-0" />
				<span>{submitError}</span>
			</div>
		{/if}

		{#if !config.traewellingToken}
			<div role="alert" class="alert alert-warning alert-soft">
				<CircleAlert class="h-4 w-4 shrink-0" />
				<span>{m.form_no_token_warning()}</span>
			</div>
		{/if}

		<button
			onclick={submitCheckin}
			disabled={submitStatus === 'loading' || !config.traewellingToken || !tripReady}
			class="btn btn-primary btn-block btn-lg"
		>
			{#if submitStatus === 'loading'}
				<span class="loading loading-spinner loading-sm"></span>
				{m.form_checking_in()}
			{:else}
				<TicketCheck class="h-4 w-4" />
				{m.form_check_in_btn()}
			{/if}
		</button>
	{/if}
</div>
