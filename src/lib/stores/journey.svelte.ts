/**
 * Journey store — holds the current check-in data being built.
 */
export interface JourneyData {
	departure_station: string;
	arrival_station: string;
	/** Departure date and time in YYYY-MM-DDTHH:MM format (datetime-local) */
	departure_datetime: string;
	/** Arrival date and time in YYYY-MM-DDTHH:MM format (datetime-local). May be next day for overnight trips. */
	arrival_datetime: string;
	train_name: string;
	train_number: string;
	train_type: string;
	car_number: string;
	seat_number: string;
	// resolved coordinates
	departure_lat: number | null;
	departure_lon: number | null;
	arrival_lat: number | null;
	arrival_lon: number | null;
	// Träwelling station IDs (null = not found)
	traewelling_origin_id: number | null;
	traewelling_destination_id: number | null;
}

const EMPTY: JourneyData = {
	departure_station: '',
	arrival_station: '',
	departure_datetime: '',
	arrival_datetime: '',
	train_name: '',
	train_number: '',
	train_type: '',
	car_number: '',
	seat_number: '',
	departure_lat: null,
	departure_lon: null,
	arrival_lat: null,
	arrival_lon: null,
	traewelling_origin_id: null,
	traewelling_destination_id: null
};

function toLocalDatetimeString(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function createJourneyStore() {
	let data = $state<JourneyData>({
		...EMPTY,
		departure_datetime: toLocalDatetimeString(new Date())
	});

	return {
		get data() {
			return data;
		},
		update(partial: Partial<JourneyData>) {
			Object.assign(data, partial);
		},
		reset() {
			Object.assign(data, EMPTY);
		}
	};
}

export const journey = createJourneyStore();
