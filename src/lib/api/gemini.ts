/**
 * Gemini API client — uses the official @google/genai SDK with structured outputs.
 */

import { GoogleGenAI, Type } from '@google/genai';

const MODEL = 'gemini-flash-lite-latest';

export interface TicketData {
	departure_station: string;
	arrival_station: string;
	/** Departure date and time in YYYY-MM-DDTHH:MM format. Empty string if not found. */
	departure_datetime: string;
	/** Arrival date and time in YYYY-MM-DDTHH:MM format. Increment the date for overnight trips. Empty string if not found. */
	arrival_datetime: string;
	train_name: string;
	train_number: string;
	car_number: string;
	seat_number: string;
	train_type: string;
}

const TICKET_SCHEMA = {
	type: Type.OBJECT,
	properties: {
		departure_station: {
			type: Type.STRING,
			description:
				'Departure station name in Japanese (preferred) or English. Empty string if not found.'
		},
		arrival_station: {
			type: Type.STRING,
			description:
				'Arrival station name in Japanese (preferred) or English. Empty string if not found.'
		},
		departure_datetime: {
			type: Type.STRING,
			description:
				'Departure date and time in YYYY-MM-DDTHH:MM format (e.g. 2024-03-15T09:30). Empty string if not found.'
		},
		arrival_datetime: {
			type: Type.STRING,
			description:
				'Arrival date and time in YYYY-MM-DDTHH:MM format. If the arrival is after midnight (overnight trip), increment the date by one day (e.g. departure 2024-03-15T23:45, arrival 2024-03-16T06:10). Empty string if not found.'
		},
		train_name: {
			type: Type.STRING,
			description: 'Train series name in English, e.g. Nozomi, Hayabusa. Empty string if not found.'
		},
		train_number: {
			type: Type.STRING,
			description: 'Train number e.g. 23, 23A. Empty string if not found.'
		},
		car_number: {
			type: Type.STRING,
			description: 'Car or carriage number. Empty string if not found.'
		},
		seat_number: {
			type: Type.STRING,
			description: 'Seat number e.g. 12A, 5B. Empty string if not found.'
		},
		train_type: {
			type: Type.STRING,
			description:
				'Category of the train. Return one of the listed values. Use "regional" as default if unclear.',
			enum: ['nationalExpress', 'national', 'regionalExp', 'regional', 'suburban', 'subway']
		}
	},
	required: [
		'departure_station',
		'arrival_station',
		'departure_datetime',
		'arrival_datetime',
		'train_name',
		'train_number',
		'car_number',
		'seat_number',
		'train_type'
	]
};

const PROMPT =
	'You are an expert at parsing Japanese physical train tickets including Shinkansen (bullet train) and conventional railway tickets. ' +
	'Extract all journey information from the ticket image. ' +
	'Return departure_datetime and arrival_datetime as full YYYY-MM-DDTHH:MM strings. ' +
	'For overnight trips where the arrival time is the next calendar day, increment the arrival date accordingly. ' +
	'For any field that cannot be determined from the ticket, use an empty string.';

export class GeminiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'GeminiError';
	}
}

export async function parseTicketImage(
	base64Data: string,
	mimeType: string,
	apiKey: string
): Promise<TicketData> {
	const ai = new GoogleGenAI({ apiKey });

	let response;
	try {
		response = await ai.models.generateContent({
			model: MODEL,
			contents: [
				{
					parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64Data } }]
				}
			],
			config: {
				temperature: 0.1,
				responseMimeType: 'application/json',
				responseSchema: TICKET_SCHEMA
			}
		});
	} catch (err: unknown) {
		// Map SDK errors to GeminiError
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
			throw new GeminiError(429, 'Gemini API quota exhausted. Try again later.');
		}
		if (msg.includes('403') || msg.toLowerCase().includes('api key')) {
			throw new GeminiError(403, 'Invalid or unauthorized Gemini API key.');
		}
		throw new GeminiError(0, msg);
	}

	const text = response.text ?? '';

	try {
		return JSON.parse(text) as TicketData;
	} catch {
		throw new Error(`Gemini returned unparseable response: ${text.slice(0, 200)}`);
	}
}
