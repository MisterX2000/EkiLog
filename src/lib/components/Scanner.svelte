<script lang="ts">
	import { Upload, ImagePlus, CircleAlert, CircleCheckBig } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { m } from '$lib/paraglide/messages.js';
	import { config } from '$lib/stores/config.svelte';
	import { journey } from '$lib/stores/journey.svelte';
	import { parseTicketImage, GeminiError } from '$lib/api/gemini';
	import { searchStations } from '$lib/db/stations';

	let dragging = $state(false);
	let scanning = $state(false);
	let error = $state('');
	let success = $state(false);
	let previewUrl = $state('');

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragging = true;
	}

	function onDragLeave() {
		dragging = false;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) processFile(file);
	}

	function onFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) processFile(file);
	}

	async function processFile(file: File) {
		if (!file.type.startsWith('image/')) {
			error = m.scanner_error_not_image();
			return;
		}
		if (!config.geminiApiKey) {
			error = m.scanner_error_no_key();
			return;
		}

		error = '';
		success = false;
		scanning = true;

		// Show preview
		previewUrl = URL.createObjectURL(file);

		try {
			const base64 = await fileToBase64(file);
			const ticket = await parseTicketImage(base64, file.type, config.geminiApiKey);

			// Attempt coordinate resolution for both stations
			let depLat: number | null = null;
			let depLon: number | null = null;
			let arrLat: number | null = null;
			let arrLon: number | null = null;

			if (ticket.departure_station) {
				const matches = await searchStations(ticket.departure_station, 1);
				if (matches[0]) {
					depLat = matches[0].lat;
					depLon = matches[0].lon;
				}
			}
			if (ticket.arrival_station) {
				const matches = await searchStations(ticket.arrival_station, 1);
				if (matches[0]) {
					arrLat = matches[0].lat;
					arrLon = matches[0].lon;
				}
			}

			journey.update({
				...ticket,
				departure_lat: depLat,
				departure_lon: depLon,
				arrival_lat: arrLat,
				arrival_lon: arrLon,
				traewelling_origin_id: null,
				traewelling_destination_id: null
			});

			success = true;
		} catch (e) {
			if (e instanceof GeminiError) {
				if (e.status === 429) error = 'Gemini API quota exhausted. Please try again later.';
				else if (e.status === 403) error = 'Gemini API key is invalid or expired.';
				else error = `Gemini error (${e.status}): ${e.message}`;
			} else {
				error = e instanceof Error ? e.message : 'Failed to scan ticket.';
			}
		} finally {
			scanning = false;
		}
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				// Strip data URL prefix to get raw base64
				resolve(result.split(',')[1]);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}
</script>

<div class="flex flex-col gap-4">
	<div
		role="button"
		tabindex="0"
		class:border-primary={dragging}
		class:bg-base-200={dragging}
		class="card card-dash cursor-pointer border-2 border-base-300 bg-base-200/50 transition-colors hover:border-primary/40 hover:bg-base-200"
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		onclick={() => (document.getElementById('ticket-upload') as HTMLInputElement | null)?.click()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				(document.getElementById('ticket-upload') as HTMLInputElement | null)?.click();
			}
		}}
	>
		<div class="card-body items-center gap-4 px-5 py-8 text-center sm:px-8">
			{#if scanning}
				<span class="loading loading-spinner loading-lg text-primary"></span>
				<div class="space-y-1">
					<p class="font-medium">{m.scanner_scanning()}</p>
					<p class="text-sm text-base-content/60">{m.scanner_formats()}</p>
				</div>
			{:else if previewUrl && success}
				<div class="space-y-4">
					<img
						src={previewUrl}
						alt="Ticket preview"
						class="mx-auto max-h-44 rounded-box object-contain shadow"
					/>
					<div class="flex items-center justify-center gap-2">
						<span class="badge badge-success badge-soft gap-1 px-3 py-3">
							<CircleCheckBig class="h-4 w-4" />
							{m.scanner_success()}
						</span>
					</div>
				</div>
			{:else}
				<div
					class="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/14 text-secondary"
				>
					<ImagePlus class="h-7 w-7" />
				</div>
				<div class="space-y-2">
					<p class="text-sm text-base-content/70">
						<span class="font-semibold text-base-content">{m.scanner_click_upload()}</span>
						{m.scanner_drag_drop()}
					</p>
					<p class="text-xs text-base-content/50">{m.scanner_formats()}</p>
				</div>
			{/if}

			<div class="flex flex-col items-center gap-3 sm:flex-row">
				<span class="btn btn-primary btn-sm">
					<Upload class="h-4 w-4" />
					{m.scanner_click_upload()}
				</span>
				{#if previewUrl}
					<span class="badge badge-ghost">{m.scanner_formats()}</span>
				{/if}
			</div>
		</div>
	</div>

	<input
		id="ticket-upload"
		type="file"
		accept="image/*"
		capture="environment"
		class="hidden"
		aria-hidden="true"
		tabindex="-1"
		onchange={onFileChange}
	/>

	{#if error}
		<div transition:fly={{ y: 6, duration: 200 }} role="alert" class="alert alert-error alert-soft">
			<CircleAlert class="h-4 w-4 shrink-0" />
			<span>{error}</span>
		</div>
	{/if}

	{#if !config.geminiApiKey}
		<div
			transition:fly={{ y: 6, duration: 200 }}
			role="alert"
			class="alert alert-warning alert-soft"
		>
			<CircleAlert class="h-4 w-4 shrink-0" />
			<span>{m.scanner_no_api_key()}</span>
		</div>
	{/if}
</div>
