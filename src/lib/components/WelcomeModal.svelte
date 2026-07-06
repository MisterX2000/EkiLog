<script lang="ts">
	import { ScanLine, Search, TrainFront, Sparkles, Settings as SettingsIcon } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { locales, getLocale, setLocale } from '$lib/paraglide/runtime';
	import { config } from '$lib/stores/config.svelte';

	let { setTab }: { setTab: (tab: 'checkin' | 'settings') => void } = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (dialogEl) {
			const shouldShow =
				!config.geminiApiKey && !config.traewellingToken && !config.welcomeModalDismissed;
			if (shouldShow && !dialogEl.open) {
				dialogEl.showModal();
			} else if (!shouldShow && dialogEl.open) {
				dialogEl.close();
			}
		}
	});

	function handleClose() {
		config.welcomeModalDismissed = true;
	}

	function handleConfigure() {
		config.welcomeModalDismissed = true;
		if (dialogEl?.open) dialogEl.close();
		setTab('settings');
	}

	function handleDismiss() {
		config.welcomeModalDismissed = true;
		if (dialogEl?.open) dialogEl.close();
	}
</script>

<dialog
	id="welcome_modal"
	class="modal"
	bind:this={dialogEl}
	onclose={handleClose}
	aria-labelledby="welcome_title"
>
	<div class="modal-box max-w-lg border border-base-300 bg-base-100 p-6 shadow-2xl">
		<div class="flex items-start justify-between gap-4">
			<div class="flex items-center gap-3">
				<div class="avatar avatar-placeholder">
					<div
						class="w-12 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-2.5 text-primary shadow-inner"
					>
						<Sparkles class="h-6 w-6" />
					</div>
				</div>
				<div>
					<h2 id="welcome_title" class="text-xl font-bold tracking-tight text-base-content">
						{m.welcome_title()}
					</h2>
					<p class="text-xs font-medium text-base-content/60">{m.welcome_subtitle()}</p>
				</div>
			</div>
			<select
				value={getLocale()}
				onchange={(e) =>
					setLocale((e.target as HTMLSelectElement).value as (typeof locales)[number])}
				class="select select-sm w-20 shrink-0"
				aria-label="Language"
			>
				{#each locales as locale (locale)}
					<option value={locale}>{locale.toUpperCase()}</option>
				{/each}
			</select>
		</div>

		<div class="mt-6 flex flex-col gap-3">
			<div
				class="flex items-start gap-3.5 rounded-xl border border-base-200 bg-base-200/40 p-3.5 transition-colors hover:border-base-300 hover:bg-base-200/70"
			>
				<div class="mt-0.5 rounded-lg bg-secondary/14 p-2 text-secondary">
					<ScanLine class="h-5 w-5" />
				</div>
				<div class="flex-1">
					<h3 class="text-sm font-semibold text-base-content">{m.welcome_feat_ocr_title()}</h3>
					<p class="mt-0.5 text-xs leading-relaxed text-base-content/70">
						{m.welcome_feat_ocr_desc()}
					</p>
				</div>
			</div>

			<div
				class="flex items-start gap-3.5 rounded-xl border border-base-200 bg-base-200/40 p-3.5 transition-colors hover:border-base-300 hover:bg-base-200/70"
			>
				<div class="mt-0.5 rounded-lg bg-primary/14 p-2 text-primary">
					<Search class="h-5 w-5" />
				</div>
				<div class="flex-1">
					<h3 class="text-sm font-semibold text-base-content">{m.welcome_feat_search_title()}</h3>
					<p class="mt-0.5 text-xs leading-relaxed text-base-content/70">
						{m.welcome_feat_search_desc()}
					</p>
				</div>
			</div>

			<div
				class="flex items-start gap-3.5 rounded-xl border border-base-200 bg-base-200/40 p-3.5 transition-colors hover:border-base-300 hover:bg-base-200/70"
			>
				<div class="mt-0.5 rounded-lg bg-accent/14 p-2 text-accent">
					<TrainFront class="h-5 w-5" />
				</div>
				<div class="flex-1">
					<h3 class="text-sm font-semibold text-base-content">{m.welcome_feat_checkin_title()}</h3>
					<p class="mt-0.5 text-xs leading-relaxed text-base-content/70">
						{m.welcome_feat_checkin_desc()}
					</p>
				</div>
			</div>
		</div>

		<div class="modal-action mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<button
				type="button"
				class="btn btn-ghost w-full font-normal text-base-content/70 sm:w-auto"
				onclick={handleDismiss}
			>
				{m.welcome_btn_dismiss()}
			</button>
			<button
				type="button"
				class="btn btn-primary w-full gap-2 shadow-sm sm:w-auto"
				onclick={handleConfigure}
			>
				<SettingsIcon class="h-4 w-4" />
				{m.welcome_btn_configure()}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-base-300/40 backdrop-blur-xs">
		<button>close</button>
	</form>
</dialog>
