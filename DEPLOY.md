# Deploying to Railway

This guide walks through hosting the Manufacturing Prospecting Tool on Railway.

## 1. Create a GitHub repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository (e.g. `ini-manufacturing-prospecting-tool`)
3. Do **not** initialize with README (the project already has one)

## 2. Push your code to GitHub

From the project root, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo name.

## 3. Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign in (GitHub login works)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway will detect the project and deploy automatically

### Root directory

Ensure Railway uses the **project root** (where `package.json`, `railway.json`, and `nixpacks.toml` live). If it defaults to a subdirectory, set **Root Directory** to `/` or leave blank.

## 4. Add environment variables

In the Railway dashboard:

1. Select your service
2. Go to **Variables**
3. Add:

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | Yes | Google Places API key (Places API New + Geocoding enabled) |
| `HUNTER_API_KEY` | For contacts | Hunter.io API key for contact discovery (domain search) |
| `OPENAI_API_KEY` | For pipeline | OpenAI key for GPT-4o manufacturing relevance |

`PORT` is set by Railway automatically — do not override it.

## 5. Add a public domain (optional)

1. Go to your service → **Settings** → **Networking**
2. Click **Generate Domain** to get a public URL (e.g. `your-app.railway.app`)

## 6. Database persistence (important)

SQLite stores data in `backend/data.db`. On Railway, the filesystem is **ephemeral** — the database is reset on each redeploy.

To persist data:

1. In Railway, add a **Volume** to your service
2. Mount path: `/data`
3. Add variable: `DATABASE_PATH=/data/data.db`
4. Add variable: `UPLOADS_PATH=/data/uploads` (for visit reports and project files to persist)

The app reads `DATABASE_PATH` and `UPLOADS_PATH` and will store the SQLite file and uploads on the volume.

## Build & start

- **Build**: `npm install` (root) → `npm run build` (builds backend + frontend)
- **Start**: `npm start` (runs `node backend/dist/index.js`)

The backend serves the built frontend at `/` and the API at `/api/*`, so a single service serves the whole app.

## Troubleshooting

- **Build fails**: Ensure Node 18+ is used (nixpacks.toml sets nodejs_20)
- **API not found**: The frontend uses relative `/api/*` URLs — they work when served from the same origin
- **Database reset**: Add a Volume for persistence (see above)
- **API keys**: Verify variables are set in Railway and have no typos
