/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope;

// Unique cache name per deployment version
const CACHE = `ekilog-${version}`;

// All static assets: the compiled app + files in /static
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (event) => {
	// Only handle GET requests
	if (event.request.method !== 'GET') return;

	// Skip cross-origin requests (e.g. Träwelling API, Gemini API)
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	async function respond() {
		const cache = await caches.open(CACHE);

		// Serve build/static assets directly from cache (cache-first)
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// For everything else: network-first, fall back to cache
		try {
			const response = await fetch(event.request);

			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200 && !response.headers.get('cache-control')?.includes('no-store')) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const cached = await cache.match(event.request);
			if (cached) return cached;
			throw new Error(`No cached response for ${url.pathname}`);
		}
	}

	event.respondWith(respond());
});
