<script lang="ts">
	import {
		KeyRound,
		Database,
		RefreshCw,
		CircleCheck,
		CircleX,
		Eye,
		Briefcase,
		ExternalLink,
		Settings2
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { config } from '$lib/stores/config.svelte';
	import { getAuthUser, TraewellingError } from '$lib/api/traewelling';
	import { syncStations, getLastSyncDate, getStationCount } from '$lib/db/stations';

	// --- Träwelling token ---
	let tokenInput = $state(config.traewellingToken);
	let tokenStatus = $state<'idle' | 'checking' | 'ok' | 'error'>('idle');
	let tokenUser = $state('');
	let tokenError = $state('');

	async function verifyToken() {
		if (!tokenInput.trim()) return;
		config.traewellingToken = tokenInput.trim();
		tokenStatus = 'checking';
		tokenError = '';
		try {
			const user = await getAuthUser(config.traewellingToken);
			tokenUser = user.displayName || user.username;
			tokenStatus = 'ok';
		} catch (e) {
			tokenStatus = 'error';
			tokenError = e instanceof TraewellingError ? `HTTP ${e.status}: ${e.message}` : String(e);
		}
	}

	function clearToken() {
		tokenInput = '';
		config.traewellingToken = '';
		tokenStatus = 'idle';
		tokenUser = '';
	}

	// --- Gemini key ---
	let geminiInput = $state(config.geminiApiKey);

	function saveGeminiKey() {
		config.geminiApiKey = geminiInput.trim();
	}

	function clearGemini() {
		geminiInput = '';
		config.geminiApiKey = '';
	}

	// --- Station sync ---
	let syncProgress = $state(0);
	let syncStatus = $state<'idle' | 'syncing' | 'done' | 'error'>('idle');
	let syncError = $state('');
	let lastSync = $state('');
	let stationCount = $state(0);

	async function loadSyncMeta() {
		lastSync = (await getLastSyncDate()) ?? '';
		stationCount = await getStationCount();
	}

	onMount(() => {
		loadSyncMeta();
	});

	async function runSync() {
		syncStatus = 'syncing';
		syncProgress = 0;
		syncError = '';
		try {
			const count = await syncStations((pct) => {
				syncProgress = pct;
			});
			stationCount = count;
			lastSync = new Date().toISOString();
			syncStatus = 'done';
		} catch (e) {
			syncStatus = 'error';
			syncError = e instanceof Error ? e.message : String(e);
		}
	}
</script>

<div class="mx-auto flex max-w-4xl flex-col gap-5 px-1">
	<!-- Träwelling Token -->
	<section class="card card-border bg-base-100 shadow-sm">
		<div class="card-body gap-5">
			<div class="flex items-start gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-box bg-primary/12 text-primary"
				>
					<KeyRound class="h-5 w-5" />
				</div>
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h2 class="card-title text-base">{m.settings_traewelling_token()}</h2>
						<div class="tooltip" data-tip={m.settings_open_traewelling_link()}>
							<a
								href="https://traewelling.de/settings/applications"
								target="_blank"
								rel="noopener noreferrer"
								aria-label={m.settings_open_traewelling_link()}
								class="btn btn-ghost btn-xs btn-square"
							>
								<ExternalLink class="h-3.5 w-3.5" />
							</a>
						</div>
					</div>
					<p class="text-sm text-base-content/60">{m.settings_token_placeholder()}</p>
				</div>
			</div>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">{m.settings_traewelling_token()}</legend>
				<input
					type="password"
					placeholder={m.settings_token_placeholder()}
					bind:value={tokenInput}
					class="input w-full"
				/>
			</fieldset>

			<div class="flex flex-col gap-2 sm:flex-row">
				<button
					onclick={verifyToken}
					disabled={tokenStatus === 'checking' || !tokenInput.trim()}
					class="btn btn-primary"
				>
					{#if tokenStatus === 'checking'}
						<span class="loading loading-spinner loading-sm"></span>
						{m.settings_checking()}
					{:else}
						<CircleCheck class="h-4 w-4" />
						{m.settings_verify_save()}
					{/if}
				</button>
				{#if config.traewellingToken}
					<button onclick={clearToken} class="btn btn-ghost">
						<CircleX class="h-4 w-4" />
						{m.settings_clear()}
					</button>
				{/if}
			</div>

			{#if tokenStatus === 'ok'}
				<div role="alert" class="alert alert-success alert-soft">
					<CircleCheck class="h-4 w-4" />
					<span>{m.settings_connected_as({ name: tokenUser })}</span>
				</div>
			{:else if tokenStatus === 'error'}
				<div role="alert" class="alert alert-error alert-soft">
					<CircleX class="h-4 w-4" />
					<span>{tokenError}</span>
				</div>
			{/if}
		</div>
	</section>

	<!-- Gemini Key -->
	<section class="card card-border bg-base-100 shadow-sm">
		<div class="card-body gap-5">
			<div class="flex items-start gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-box bg-secondary/14 text-secondary"
				>
					<KeyRound class="h-5 w-5" />
				</div>
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h2 class="card-title text-base">{m.settings_gemini_key()}</h2>
						<div class="tooltip" data-tip={m.settings_open_gemini_link()}>
							<a
								href="https://aistudio.google.com/api-keys"
								target="_blank"
								rel="noopener noreferrer"
								aria-label={m.settings_open_gemini_link()}
								class="btn btn-ghost btn-xs btn-square"
							>
								<ExternalLink class="h-3.5 w-3.5" />
							</a>
						</div>
					</div>
					<p class="text-sm text-base-content/60">{m.settings_gemini_description()}</p>
				</div>
			</div>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">{m.settings_gemini_key()}</legend>
				<input type="password" placeholder="AIza…" bind:value={geminiInput} class="input w-full" />
			</fieldset>

			<div class="flex flex-col gap-2 sm:flex-row">
				<button onclick={saveGeminiKey} disabled={!geminiInput.trim()} class="btn btn-primary">
					<CircleCheck class="h-4 w-4" />
					{m.settings_save_key()}
				</button>
				{#if config.geminiApiKey}
					<button onclick={clearGemini} class="btn btn-ghost">
						<CircleX class="h-4 w-4" />
						{m.settings_clear()}
					</button>
				{/if}
			</div>

			{#if config.geminiApiKey}
				<div role="alert" class="alert alert-success alert-soft">
					<CircleCheck class="h-4 w-4" />
					<span>{m.settings_gemini_saved()}</span>
				</div>
			{/if}
		</div>
	</section>

	<!-- Station Database Sync -->
	<section class="card card-border bg-base-100 shadow-sm">
		<div class="card-body gap-5">
			<div class="flex items-start gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-box bg-success/14 text-success"
				>
					<Database class="h-5 w-5" />
				</div>
				<div class="space-y-1">
					<h2 class="card-title text-base">{m.settings_station_db()}</h2>
					<p class="text-sm text-base-content/60">{m.settings_station_description()}</p>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				{#if stationCount > 0}
					<div class="badge badge-success badge-soft gap-2 px-3 py-3">
						{m.settings_stations_cached({ count: stationCount.toLocaleString() })}
					</div>
				{/if}
				{#if lastSync}
					<div class="badge badge-ghost gap-2 px-3 py-3">
						{m.settings_last_synced({ date: new Date(lastSync).toLocaleDateString() })}
					</div>
				{/if}
			</div>

			{#if syncStatus === 'syncing'}
				<div class="space-y-2">
					<div class="flex items-center justify-between text-sm text-base-content/60">
						<span>{m.settings_downloading()}</span>
						<span>{syncProgress}%</span>
					</div>
					<progress class="progress progress-primary w-full" value={syncProgress} max="100"
					></progress>
				</div>
			{/if}

			{#if syncStatus === 'error'}
				<div role="alert" class="alert alert-error alert-soft">
					<CircleX class="h-4 w-4" />
					<span>{syncError}</span>
				</div>
			{/if}

			<button
				onclick={runSync}
				disabled={syncStatus === 'syncing'}
				class="btn btn-primary sm:btn-wide"
			>
				{#if syncStatus === 'syncing'}
					<span class="loading loading-spinner loading-sm"></span>
					{m.settings_syncing()}
				{:else}
					<RefreshCw class="h-4 w-4" />
					{stationCount > 0 ? m.settings_resync() : m.settings_download()}
				{/if}
			</button>
		</div>
	</section>

	<!-- Check-in Defaults -->
	<section class="card card-border bg-base-100 shadow-sm">
		<div class="card-body gap-5">
			<div class="flex items-start gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-box bg-info/14 text-info">
					<Settings2 class="h-5 w-5" />
				</div>
				<div class="space-y-1">
					<h2 class="card-title text-base">{m.settings_checkin_defaults()}</h2>
					<p class="text-sm text-base-content/60">{m.settings_defaults_note()}</p>
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<fieldset class="fieldset">
					<legend class="fieldset-legend flex items-center gap-2">
						<Eye class="h-3.5 w-3.5" />
						{m.settings_default_visibility()}
					</legend>
					<select
						id="default-visibility"
						value={config.defaultVisibility}
						onchange={(e) =>
							(config.defaultVisibility = Number((e.target as HTMLSelectElement).value))}
						class="select w-full"
					>
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
					<select
						id="default-business"
						value={config.defaultBusiness}
						onchange={(e) =>
							(config.defaultBusiness = Number((e.target as HTMLSelectElement).value))}
						class="select w-full"
					>
						<option value={0}>{m.form_biz_private()}</option>
						<option value={1}>{m.form_biz_business()}</option>
						<option value={2}>{m.form_biz_commute()}</option>
					</select>
				</fieldset>
			</div>
		</div>
	</section>
	<div class="text-center text-sm font-mono text-base-content/50">
		v{__APP_VERSION__}
	</div>
</div>
