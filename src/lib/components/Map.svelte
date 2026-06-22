<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		depLat: number | null;
		depLon: number | null;
		arrLat: number | null;
		arrLon: number | null;
		depName?: string;
		arrName?: string;
	}

	let {
		depLat,
		depLon,
		arrLat,
		arrLon,
		depName = 'Departure',
		arrName = 'Arrival'
	}: Props = $props();

	let mapEl: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let leafletMap: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let L: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let depMarker: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let arrMarker: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let routeLine: any = null;

	onMount(async () => {
		// Dynamic import to prevent SSR issues
		const leaflet = await import('leaflet');
		L = leaflet.default ?? leaflet;

		// Fix default marker icon paths broken by bundlers
		delete L.Icon.Default.prototype._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
			iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
			shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
		});

		leafletMap = L.map(mapEl).setView([36.5, 138], 5);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19
		}).addTo(leafletMap);

		updateMarkers();
	});

	onDestroy(() => {
		leafletMap?.remove();
	});

	function updateMarkers() {
		if (!leafletMap || !L) return;

		// Clean up
		depMarker?.remove();
		arrMarker?.remove();
		routeLine?.remove();

		if (depLat !== null && depLon !== null) {
			depMarker = L.marker([depLat, depLon], {
				icon: L.divIcon({
					html: `<div class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shadow-lg border-2 border-white">D</div>`,
					iconSize: [28, 28],
					iconAnchor: [14, 14],
					className: ''
				})
			})
				.addTo(leafletMap)
				.bindPopup(`<b>${depName}</b><br>Departure`);
		}

		if (arrLat !== null && arrLon !== null) {
			arrMarker = L.marker([arrLat, arrLon], {
				icon: L.divIcon({
					html: `<div class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white text-xs font-bold shadow-lg border-2 border-white">A</div>`,
					iconSize: [28, 28],
					iconAnchor: [14, 14],
					className: ''
				})
			})
				.addTo(leafletMap)
				.bindPopup(`<b>${arrName}</b><br>Arrival`);
		}

		if (depLat !== null && depLon !== null && arrLat !== null && arrLon !== null) {
			routeLine = L.polyline(
				[
					[depLat, depLon],
					[arrLat, arrLon]
				],
				{ color: '#6366f1', weight: 3, opacity: 0.8, dashArray: '6 4' }
			).addTo(leafletMap);

			const bounds = L.latLngBounds([
				[depLat, depLon],
				[arrLat, arrLon]
			]);
			leafletMap.fitBounds(bounds, { padding: [40, 40] });
		} else if (depLat !== null && depLon !== null) {
			leafletMap.setView([depLat, depLon], 10);
		} else if (arrLat !== null && arrLon !== null) {
			leafletMap.setView([arrLat, arrLon], 10);
		}
	}

	$effect(() => {
		// Re-run whenever coordinates change
		depLat;
		depLon;
		arrLat;
		arrLon;
		if (leafletMap) updateMarkers();
	});
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
		integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
		crossorigin="anonymous"
	/>
</svelte:head>

<div bind:this={mapEl} class="h-full w-full rounded-2xl"></div>
