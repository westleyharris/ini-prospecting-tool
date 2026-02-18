# INI Manufacturing Prospecting Tool

A data pipeline and UI for discovering manufacturing plants in the DFW area via Google Places API. Tracks follow-ups, contact status, and visualizes plants on a map.

## Features

- **Data Pipeline**: Fetches manufacturing plants from Google Places API (DFW area)
- **Deduplication**: Uses `place_id` to prevent duplicates
- **Dashboard**: Metrics (total, contacted, pending follow-ups, new this week), plant table with inline edit
- **Map**: US map with plant markers, clustering, filter by contacted status
- **Run Pipeline**: Manual trigger to ingest new plants
- **Contact Discovery**: Find contacts at plants via Hunter.io — Plant Manager, Maintenance Manager, Purchasing Manager, etc. (emails included)

## Data from Google Places

The pipeline fetches these fields from the Places API (New):

| Field | Description |
|-------|-------------|
| Name, Address | Display name and formatted address |
| Phone, Website | Contact info (national/international phone, website URI) |
| Location | Lat/lng coordinates |
| Business Status | OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY |
| Type | Primary type (e.g. factory) and human-readable display name |
| Rating | User rating and review count |
| Google Maps URI | Direct link to open in Google Maps |
| Plus Code | Precise location identifier |
| Price Level | FREE, INEXPENSIVE, MODERATE, EXPENSIVE |
| Opening Hours | Regular hours (weekday descriptions) |
| Generative Summary | AI-powered place overview (Summarized with Gemini) |
| Address Components | City, state, postal code (parsed from address) |
| Viewport | Bounding box for map display |
| Manufacturing Relevance | GPT-4o interpretation: high/medium/low (none excluded) |

Places without a type or summary get a Place Details call to fetch Gemini's generative summary. All places are then batch-analyzed by GPT-4o for manufacturing relevance. Requires `OPENAI_API_KEY` in `.env`.

## Deploy to Railway

See [DEPLOY.md](DEPLOY.md) for full instructions on hosting on Railway.

## Prerequisites

- Node.js 18+
- Google Places API key with Places API (New) enabled and billing configured
- Hunter.io API key (for contact discovery)

## Setup

1. **Clone and install dependencies**

   ```bash
   cd "INI Data Pipeline"
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` in the project root:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```
   GOOGLE_PLACES_API_KEY=your_api_key_here
   HUNTER_API_KEY=your_hunter_api_key_here
   PORT=3001
   ```

   **Important**: Never commit `.env` or your API key. Rotate the key if it was ever exposed.

3. **Enable Google APIs**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable "Places API (New)" and "Geocoding API" (for zip/city search)
   - Ensure billing is configured

## Running

1. **Start the backend** (from project root or backend dir):

   ```bash
   cd backend
   npm run dev
   ```

   Server runs at `http://localhost:3001`.

2. **Start the frontend** (in a new terminal):

   ```bash
   cd frontend
   npm run dev
   ```

   App runs at `http://localhost:5173`. The Vite dev server proxies `/api` to the backend.

3. **Run the pipeline**

   - Open the Dashboard
   - Optionally enter a zip code (e.g. `75001`) or city (e.g. `Dallas, TX`) to search a specific area
   - Leave blank to use the default DFW area
   - Click "Run pipeline" to fetch manufacturing plants
   - Data is stored in `backend/data.db` (SQLite)

## Project Structure

```
INI Data Pipeline/
├── backend/           # Express API + data pipeline
│   ├── src/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── routes/
│   │   └── services/
│   └── package.json
├── frontend/          # React + Vite + Leaflet
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│   └── package.json
├── .env.example
└── README.md
```

## API Endpoints

- `GET /api/plants` - List plants (query: `contacted`, `limit`, `offset`)
- `GET /api/plants/metrics` - Dashboard metrics
- `GET /api/plants/:id` - Get single plant
- `PATCH /api/plants/:id` - Update contacted, follow_up_date, notes
- `DELETE /api/plants/:id` - Remove plant from database
- `DELETE /api/plants/bulk` - Remove multiple plants (body: `{ "ids": ["id1", "id2", ...] }`)
- `POST /api/pipeline/run` - Trigger ingestion from Google Places (body: `{ "location": "75001" }` optional zip/city)
- `GET /api/plants/:id/contacts` - List contacts for a plant
- `POST /api/plants/:id/find-contacts` - Find contacts via Hunter.io (uses plant website domain, returns emails)
- `POST /api/contacts/:id/enrich` - Enrich legacy Apollo contact to get email/phone (for contacts without Hunter)
- `DELETE /api/contacts/:id` - Remove contact

## Contact Discovery

1. Click **Contacts** on a plant row in the Dashboard
2. Click **Find contacts (Hunter)** — searches Hunter.io for people at the plant's company domain (Plant Manager, Maintenance Manager, etc.). Emails and phones are included in the results.
3. Plants must have a website to find contacts.

## Future Extensibility

- Add more data sources (LinkedIn, industry databases)
- Expand geographic regions
- Scheduled pipeline runs
