/**
 * Reactive config store — persists to localStorage.
 * Uses Svelte 5 runes.
 */
import { browser } from '$app/environment';

function loadFromStorage<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw !== null ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function persist<T>(key: string, value: T): void {
	if (!browser) return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// storage full / private browsing
	}
}

function createConfigStore() {
	let traewellingToken = $state<string>(loadFromStorage('ekilog.traewellingToken', ''));
	let traewellingUser = $state<string>(loadFromStorage('ekilog.traewellingUser', ''));
	let geminiApiKey = $state<string>(loadFromStorage('ekilog.geminiApiKey', ''));
	let geminiModelInfo = $state<string>(loadFromStorage('ekilog.geminiModelInfo', ''));
	let defaultVisibility = $state<number>(loadFromStorage('ekilog.defaultVisibility', 0));
	let defaultBusiness = $state<number>(loadFromStorage('ekilog.defaultBusiness', 0));

	return {
		get traewellingToken() {
			return traewellingToken;
		},
		set traewellingToken(v: string) {
			traewellingToken = v;
			persist('ekilog.traewellingToken', v);
		},
		get traewellingUser() {
			return traewellingUser;
		},
		set traewellingUser(v: string) {
			traewellingUser = v;
			persist('ekilog.traewellingUser', v);
		},
		get geminiApiKey() {
			return geminiApiKey;
		},
		set geminiApiKey(v: string) {
			geminiApiKey = v;
			persist('ekilog.geminiApiKey', v);
		},
		get geminiModelInfo() {
			return geminiModelInfo;
		},
		set geminiModelInfo(v: string) {
			geminiModelInfo = v;
			persist('ekilog.geminiModelInfo', v);
		},
		get defaultVisibility() {
			return defaultVisibility;
		},
		set defaultVisibility(v: number) {
			defaultVisibility = v;
			persist('ekilog.defaultVisibility', v);
		},
		get defaultBusiness() {
			return defaultBusiness;
		},
		set defaultBusiness(v: number) {
			defaultBusiness = v;
			persist('ekilog.defaultBusiness', v);
		}
	};
}

export const config = createConfigStore();
