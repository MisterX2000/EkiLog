<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import L, { Map as LeafletMap, Marker, Polyline } from 'leaflet';
	import 'leaflet/dist/leaflet.css';
	import { m } from '$lib/paraglide/messages.js';
	import { TrainFront, MapPin } from '@lucide/svelte';

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
	let depTemplate: HTMLDivElement;
	let arrTemplate: HTMLDivElement;
	let leafletMap: LeafletMap | null = null;
	let depMarker: Marker | null = null;
	let arrMarker: Marker | null = null;
	let routeLine: Polyline | null = null;
	let arrowMarker: Marker | null = null;

	function getCurvedRoute(p1: [number, number], p2: [number, number]): [number, number][] {
		const [lat1, lon1] = p1;
		const [lat2, lon2] = p2;
		const dx = lon2 - lon1;
		const dy = lat2 - lat1;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < 0.001) {
			return [p1, p2];
		}

		const mx = (lon1 + lon2) / 2;
		const my = (lat1 + lat2) / 2;
		const k = 0.2;
		const cx = mx - dy * k;
		const cy = my + dx * k;

		const points: [number, number][] = [];
		const steps = 50;
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cy + t * t * lat2;
			const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * cx + t * t * lon2;
			points.push([lat, lon]);
		}
		return points;
	}

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
		arrowMarker?.remove();

		if (depLat !== null && depLon !== null) {
			const el = depTemplate?.cloneNode(true) as HTMLElement;
			if (el) el.classList.remove('hidden');
			depMarker = L.marker([depLat, depLon], {
				icon: L.divIcon({
					html:
						el ||
						`<div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border-2 border-white"></div>`,
					iconSize: [32, 32],
					iconAnchor: [16, 16],
					className: ''
				})
			})
				.addTo(leafletMap)
				.bindPopup(
					`<b>${depName}</b><br><span style="font-size: 0.85em; color: #666;">${m.form_departure()}</span>`
				);
		}

		if (arrLat !== null && arrLon !== null) {
			const el = arrTemplate?.cloneNode(true) as HTMLElement;
			if (el) el.classList.remove('hidden');
			arrMarker = L.marker([arrLat, arrLon], {
				icon: L.divIcon({
					html:
						el ||
						`<div class="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-500/30 border-2 border-white"></div>`,
					iconSize: [32, 32],
					iconAnchor: [16, 16],
					className: ''
				})
			})
				.addTo(leafletMap)
				.bindPopup(
					`<b>${arrName}</b><br><span style="font-size: 0.85em; color: #666;">${m.form_arrival()}</span>`
				);
		}

		if (depLat !== null && depLon !== null && arrLat !== null && arrLon !== null) {
			const curvePoints = getCurvedRoute([depLat, depLon], [arrLat, arrLon]);
			routeLine = L.polyline(curvePoints, {
				color: '#6366f1',
				weight: 4,
				opacity: 0.85,
				dashArray: '12 12',
				className: 'flowing-route-line'
			}).addTo(leafletMap);

			const midIdx = Math.floor(curvePoints.length / 2);
			const pPrev = curvePoints[midIdx - 1];
			const pNext = curvePoints[midIdx + 1];

			const mercY1 = Math.log(Math.tan(Math.PI / 4 + (pPrev[0] * Math.PI) / 180 / 2));
			const mercY2 = Math.log(Math.tan(Math.PI / 4 + (pNext[0] * Math.PI) / 180 / 2));
			const mercX1 = (pPrev[1] * Math.PI) / 180;
			const mercX2 = (pNext[1] * Math.PI) / 180;

			const dyScreen = -(mercY2 - mercY1);
			const dxScreen = mercX2 - mercX1;
			const angleDeg = Math.atan2(dyScreen, dxScreen) * (180 / Math.PI);

			arrowMarker = L.marker(curvePoints[midIdx], {
				icon: L.divIcon({
					html: `<div style="transform: rotate(${angleDeg}deg); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#6366f1" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 1px 2px rgba(255, 255, 255, 0.9)) drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.3));"><path d="M9 18l6-6-6-6"/></svg></div>`,
					iconSize: [36, 36],
					iconAnchor: [18, 18],
					className: 'bg-transparent border-0'
				}),
				interactive: false
			}).addTo(leafletMap);

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

<div class="hidden">
	<div
		bind:this={depTemplate}
		class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
	>
		<TrainFront class="h-4.5 w-4.5" />
	</div>
	<div
		bind:this={arrTemplate}
		class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-rose-600 text-white shadow-lg shadow-rose-500/30"
	>
		<MapPin class="h-4.5 w-4.5" />
	</div>
</div>

<style>
	:global(.flowing-route-line) {
		animation: flow-route 2.5s linear infinite;
	}

	@keyframes flow-route {
		to {
			stroke-dashoffset: -24;
		}
	}
</style>
