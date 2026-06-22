/**
 * Träwelling API client — all calls are client-side fetch with Bearer token.
 */

const BASE = 'https://traewelling.de/api/v1';

interface FetchOptions {
	token: string;
	method?: string;
	body?: unknown;
}

async function traewellingFetch<T>(path: string, opts: FetchOptions): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		method: opts.method ?? 'GET',
		headers: {
			Authorization: `Bearer ${opts.token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		...(opts.body ? { body: JSON.stringify(opts.body) } : {})
	});

	if (!res.ok) {
		const err = await res.text().catch(() => res.statusText);
		throw new TraewellingError(res.status, err);
	}

	return res.json() as Promise<T>;
}

export class TraewellingError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'TraewellingError';
	}
}

export interface TraewellingUser {
	id: number;
	username: string;
	displayName: string;
	profilePicture: string | null;
	trainDistance: number;
	trainDuration: number;
	points: number;
}

export async function getAuthUser(token: string): Promise<TraewellingUser> {
	const res = await traewellingFetch<{ data: TraewellingUser }>('/auth/user', { token });
	return res.data;
}

export interface TraewellingStation {
	id: number;
	name: string;
	latitude: number | null;
	longitude: number | null;
	ibnr: number | null;
	rilIdentifier: string | null;
}

export async function searchTraewellingStations(
	query: string,
	token: string
): Promise<TraewellingStation[]> {
	const encoded = encodeURIComponent(query.replace(/\//g, '%20'));
	const res = await traewellingFetch<{ data: TraewellingStation[] }>(
		`/stations?query=${encoded}&limit=5`,
		{ token }
	);
	return res.data ?? [];
}

export interface DepartureLine {
	name: string;
	fahrtNr: string;
	product: string | null;
	mode: string | null;
}

export interface Departure {
	tripId: string;
	direction: string | null;
	plannedWhen: string;
	when: string | null;
	line: DepartureLine;
}

export async function getDepartures(
	stationId: number,
	when: string,
	token: string
): Promise<Departure[]> {
	const params = new URLSearchParams({ when });
	const res = await traewellingFetch<{ data: Departure[] }>(
		`/station/${stationId}/departures?${params}`,
		{ token }
	);
	return res.data ?? [];
}

/** Find the best matching departure for a given train name/number and departure datetime. */
export function matchDeparture(
	departures: Departure[],
	trainName: string,
	trainNumber: string
): Departure | null {
	if (!departures.length) return null;
	const needle = `${trainName} ${trainNumber}`.trim().toLowerCase();
	if (!needle) return null;

	// Exact line name match first
	for (const d of departures) {
		if (d.line.name.toLowerCase() === needle) return d;
	}
	// Partial match on fahrtNr (journey number)
	if (trainNumber) {
		for (const d of departures) {
			if (d.line.fahrtNr === trainNumber) return d;
		}
	}
	// Partial match by train name prefix
	for (const d of departures) {
		if (d.line.name.toLowerCase().includes(trainName.toLowerCase()) && trainName) return d;
	}
	return null;
}

export interface CheckinRequestBody {
	tripId: string;
	lineName: string;
	start: number;
	destination: number;
	departure: string; // ISO 8601 datetime
	arrival: string; // ISO 8601 datetime
	body?: string;
	business?: number;
	visibility?: number;
	force?: boolean;
}

export interface CheckinResult {
	status: {
		id: number;
	};
	points: {
		points: number;
	};
}

export async function createCheckin(
	body: CheckinRequestBody,
	token: string
): Promise<CheckinResult> {
	// The API wraps the response in a `data` field (alongside a `disclaimer` field)
	const res = await traewellingFetch<{ data: CheckinResult }>('/trains/checkin', {
		token,
		method: 'POST',
		body
	});
	return res.data;
}

export interface StatusTagBody {
	key: string;
	value: string;
}

export async function addStatusTag(
	statusId: number,
	tag: StatusTagBody,
	token: string
): Promise<void> {
	await traewellingFetch(`/status/${statusId}/tags`, {
		token,
		method: 'POST',
		body: tag
	});
}

// Manual trip creation — for trains not in HAFAS (e.g. Japanese Shinkansen)
export type HafasTravelType =
	| 'nationalExpress'
	| 'national'
	| 'regionalExp'
	| 'regional'
	| 'suburban'
	| 'bus'
	| 'ferry'
	| 'subway'
	| 'tram'
	| 'taxi'
	| 'plane'
	| 'freightTrain';

export interface ManualTripRequest {
	category: HafasTravelType;
	lineName: string;
	journeyNumber?: number | null;
	originId: number;
	originDeparturePlanned: string; // ISO 8601
	destinationId: number;
	destinationArrivalPlanned: string; // ISO 8601
}

export interface ManualTripResult {
	tripId: string;
	lineName: string;
	id: number;
}

export async function createManualTrip(
	body: ManualTripRequest,
	token: string
): Promise<ManualTripResult> {
	const res = await traewellingFetch<{ data: { tripId: string; lineName: string; id: number } }>(
		'/trips',
		{ token, method: 'POST', body }
	);
	return res.data;
}
