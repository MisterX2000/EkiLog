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
	import { verifyGeminiKey, GeminiError } from '$lib/api/gemini';
	import { syncStations, getLastSyncDate, getStationCount } from '$lib/db/stations';

	// --- Träwelling token ---
	let tokenInput = $state(config.traewellingToken);
	let tokenStatus = $state<'idle' | 'checking' | 'ok' | 'error'>(
		config.traewellingToken && config.traewellingUser ? 'ok' : 'idle'
	);
	let tokenUser = $state(config.traewellingUser);
	let tokenError = $state('');

	async function verifyToken() {
		if (!tokenInput.trim()) return;
		tokenStatus = 'checking';
		tokenError = '';
		try {
			const user = await getAuthUser(tokenInput.trim());
			tokenUser = user.displayName || user.username;
			config.traewellingToken = tokenInput.trim();
			config.traewellingUser = tokenUser;
			tokenStatus = 'ok';
		} catch (e) {
			tokenStatus = 'error';
			tokenError = e instanceof TraewellingError ? `HTTP ${e.status}: ${e.message}` : String(e);
		}
	}

	function clearToken() {
		tokenInput = '';
		config.traewellingToken = '';
		config.traewellingUser = '';
		tokenStatus = 'idle';
		tokenUser = '';
		tokenError = '';
	}

	// --- Gemini key ---
	let geminiInput = $state(config.geminiApiKey);
	let geminiStatus = $state<'idle' | 'checking' | 'ok' | 'error'>(
		config.geminiApiKey && config.geminiModelInfo ? 'ok' : 'idle'
	);
	let geminiModel = $state(config.geminiModelInfo);
	let geminiError = $state('');

	async function verifyGemini() {
		if (!geminiInput.trim()) return;
		geminiStatus = 'checking';
		geminiError = '';
		try {
			const modelInfo = await verifyGeminiKey(geminiInput.trim());
			geminiModel = modelInfo;
			config.geminiApiKey = geminiInput.trim();
			config.geminiModelInfo = geminiModel;
			geminiStatus = 'ok';
		} catch (e) {
			geminiStatus = 'error';
			geminiError =
				e instanceof GeminiError
					? `HTTP ${e.status}: ${e.message}`
					: e instanceof Error
						? e.message
						: String(e);
		}
	}

	function clearGemini() {
		geminiInput = '';
		config.geminiApiKey = '';
		config.geminiModelInfo = '';
		geminiStatus = 'idle';
		geminiModel = '';
		geminiError = '';
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
				<div class="avatar avatar-placeholder">
					<div class="w-10 rounded-full bg-primary/14 text-primary">
						<KeyRound class="h-5 w-5" />
					</div>
				</div>
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h2 class="card-title text-base">{m.settings_traewelling_token()}</h2>
						<div class="tooltip tooltip-right" data-tip={m.settings_open_traewelling_link()}>
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

			<div class="flex flex-wrap items-center gap-3">
				<div class="flex flex-wrap gap-2">
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
					<div role="alert" class="alert alert-success alert-soft my-0 min-w-90 flex-1 py-2.5">
						<CircleCheck class="h-4 w-4 shrink-0" />
						<span>{m.settings_connected_as({ name: tokenUser })}</span>
					</div>
				{:else if tokenStatus === 'error'}
					<div role="alert" class="alert alert-error alert-soft my-0 min-w-90 flex-1 py-2.5">
						<CircleX class="h-4 w-4 shrink-0" />
						<span>{tokenError}</span>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Gemini Key -->
	<section class="card card-border bg-base-100 shadow-sm">
		<div class="card-body gap-5">
			<div class="flex items-start gap-3">
				<div class="avatar avatar-placeholder">
					<div class="w-10 rounded-full bg-secondary/14 text-secondary">
						<KeyRound class="h-5 w-5" />
					</div>
				</div>
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h2 class="card-title text-base">{m.settings_gemini_key()}</h2>
						<div class="tooltip tooltip-right" data-tip={m.settings_open_gemini_link()}>
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

			<div class="flex flex-wrap items-center gap-3">
				<div class="flex flex-wrap gap-2">
					<button
						onclick={verifyGemini}
						disabled={geminiStatus === 'checking' || !geminiInput.trim()}
						class="btn btn-primary"
					>
						{#if geminiStatus === 'checking'}
							<span class="loading loading-spinner loading-sm"></span>
							{m.settings_checking()}
						{:else}
							<CircleCheck class="h-4 w-4" />
							{m.settings_verify_save()}
						{/if}
					</button>
					{#if config.geminiApiKey}
						<button onclick={clearGemini} class="btn btn-ghost">
							<CircleX class="h-4 w-4" />
							{m.settings_clear()}
						</button>
					{/if}
				</div>

				{#if geminiStatus === 'ok'}
					<div role="alert" class="alert alert-success alert-soft my-0 min-w-90 flex-1 py-2.5">
						<CircleCheck class="h-4 w-4 shrink-0" />
						<span>{m.settings_gemini_connected({ model: geminiModel })}</span>
					</div>
				{:else if geminiStatus === 'error'}
					<div role="alert" class="alert alert-error alert-soft my-0 min-w-90 flex-1 py-2.5">
						<CircleX class="h-4 w-4 shrink-0" />
						<span>{geminiError}</span>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Station Database Sync -->
	<section class="card card-border bg-base-100 shadow-sm">
		<div class="card-body gap-5">
			<div class="flex items-start gap-3">
				<div class="avatar avatar-placeholder">
					<div class="w-10 rounded-full bg-success/14 text-success">
						<Database class="h-5 w-5" />
					</div>
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
				<div class="avatar avatar-placeholder">
					<div class="w-10 rounded-full bg-info/14 text-info">
						<Settings2 class="h-5 w-5" />
					</div>
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
