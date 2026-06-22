/**
 * IndexedDB station cache.
 * Stores the piuccio/open-data-jp-railway-stations dataset.
 */
import { openDB, type IDBPDatabase } from 'idb';

export interface StationEntry {
	name_kanji: string;
	name_kana: string;
	name_romaji: string;
	alternative_names: string[];
	lat: number;
	lon: number;
	prefecture: string;
	group_code: string;
}

const DB_NAME = 'ekilog';
const STORE_NAME = 'stations';
const META_STORE = 'meta';
const DB_VERSION = 1;

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
	if (_db) return _db;
	_db = await openDB(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(META_STORE)) {
				db.createObjectStore(META_STORE);
			}
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'group_code' });
				store.createIndex('name_kanji', 'name_kanji', { unique: false });
				store.createIndex('name_romaji', 'name_romaji', { unique: false });
			}
		}
	});
	return _db;
}

/** Returns ISO date string of last sync, or null */
export async function getLastSyncDate(): Promise<string | null> {
	const db = await getDb();
	return (await db.get(META_STORE, 'lastSync')) ?? null;
}

/** Fetches the stations.json from GitHub and stores it in IndexedDB */
export async function syncStations(onProgress?: (pct: number) => void): Promise<number> {
	const STATIONS_URL =
		'https://raw.githubusercontent.com/piuccio/open-data-jp-railway-stations/master/stations.json';

	onProgress?.(5);
	const resp = await fetch(STATIONS_URL);
	if (!resp.ok) throw new Error(`Failed to fetch stations: ${resp.status} ${resp.statusText}`);

	const raw: Array<{
		name_kanji: string;
		name_kana?: string;
		name_romaji?: string;
		alternative_names?: string[];
		group_code: string;
		prefecture: string;
		stations: Array<{ lat: number; lon: number; [key: string]: unknown }>;
	}> = await resp.json();

	onProgress?.(40);

	const db = await getDb();
	const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
	const store = tx.objectStore(STORE_NAME);

	// Clear existing data
	await store.clear();

	let count = 0;
	for (const group of raw) {
		// Use first station's coordinates for the group
		const firstStation = group.stations?.[0];
		if (!firstStation || firstStation.lat === 0) continue;

		const entry: StationEntry = {
			name_kanji: group.name_kanji ?? '',
			name_kana: group.name_kana ?? '',
			name_romaji: group.name_romaji ?? '',
			alternative_names: group.alternative_names ?? [],
			lat: firstStation.lat,
			lon: firstStation.lon,
			prefecture: group.prefecture ?? '',
			group_code: group.group_code
		};
		await store.put(entry);
		count++;
	}

	await tx.objectStore(META_STORE).put(new Date().toISOString(), 'lastSync');
	await tx.done;

	onProgress?.(100);
	return count;
}

/** Returns the total number of cached stations */
export async function getStationCount(): Promise<number> {
	const db = await getDb();
	return db.count(STORE_NAME);
}

/** Fuzzy-ish search: find stations whose name contains the query string */
export async function searchStations(query: string, limit = 10): Promise<StationEntry[]> {
	if (!query.trim()) return [];
	const db = await getDb();
	const all = await db.getAll(STORE_NAME);
	const q = query.toLowerCase().trim();

	const results: Array<{ station: StationEntry; score: number }> = [];

	for (const s of all) {
		const kanji = s.name_kanji.toLowerCase();
		const romaji = (s.name_romaji ?? '').toLowerCase();
		const kana = (s.name_kana ?? '').toLowerCase();
		const alts = (s.alternative_names ?? []).map((n: string) => n.toLowerCase());

		let score = 0;
		if (kanji === q || romaji === q) score = 100;
		else if (kanji.startsWith(q) || romaji.startsWith(q)) score = 80;
		else if (kanji.includes(q) || romaji.includes(q) || kana.includes(q)) score = 60;
		else if (alts.some((a: string) => a.includes(q))) score = 40;

		if (score > 0) results.push({ station: s, score });
	}

	return results
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((r) => r.station);
}

/** Find the nearest station to given coordinates */
export async function findNearestStation(lat: number, lon: number): Promise<StationEntry | null> {
	const db = await getDb();
	const all = await db.getAll(STORE_NAME);
	if (all.length === 0) return null;

	let best: StationEntry | null = null;
	let bestDist = Infinity;

	for (const s of all) {
		const d = haversineKm(lat, lon, s.lat, s.lon);
		if (d < bestDist) {
			bestDist = d;
			best = s;
		}
	}
	return best;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
