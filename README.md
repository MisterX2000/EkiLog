# EkiLog

A PWA companion for logging Japanese railway journeys to [Träwelling](https://traewelling.de). Point your camera at a physical train ticket and EkiLog does the rest — it reads the ticket, finds the departure, and submits the check-in on your behalf.

## Features

- **Ticket scanning** — drag & drop a photo of a Japanese train ticket; Gemini AI extracts the route, date, and train details automatically
- **Station search** — searches a local offline database of ~7 000 Japanese stations (kanji, kana, romaji) and falls back to the Träwelling API
- **HAFAS departure lookup** — finds the matching scheduled departure for HAFAS-covered trains
- **Manual trip creation** — Shinkansen and other non-HAFAS trains are submitted as manual trips with category selection
- **Interactive map** — previews your departure → arrival route on a Leaflet map before check-in
- **Offline-ready** — service worker caches static assets; station data lives in IndexedDB
- **5 languages** — English, German, Spanish, French, Japanese

## Tech Stack

| Layer     | Choice                                      |
| --------- | ------------------------------------------- |
| Framework | SvelteKit 2 + Svelte 5 (runes)              |
| Styling   | daisyUI + Tailwind CSS v4                   |
| AI        | Google Gemini Flash Lite (`@google/genai`)  |
| i18n      | Paraglide JS                                |
| Map       | Leaflet (lazy-loaded)                       |
| Local DB  | IndexedDB via `idb`                         |
| Hosting   | GitHub Pages (static adapter, SPA fallback) |

> Both the Träwelling token and Gemini API key are entered by the user in Settings — there is no backend.

## Getting Started

```bash
npm install
npm run dev       # development server at http://localhost:5173
npm run build     # production build → build/
npm run preview   # preview the production build
```

Type-check and lint:

```bash
npm run check
npm run lint
```
