<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import L, { Map as LeafletMap, Marker, Polyline } from 'leaflet';
	import 'leaflet/dist/leaflet.css';

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
	let leafletMap: LeafletMap | null = null;
	let depMarker: Marker | null = null;
	let arrMarker: Marker | null = null;
	let routeLine: Polyline | null = null;

	onMount(() => {
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
		if (!leafletMap) return;

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

<div bind:this={mapEl} class="h-full w-full rounded-2xl"></div>
