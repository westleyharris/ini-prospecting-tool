import { config } from "dotenv";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { existsSync } from "fs";

// Load .env - try multiple locations
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const backendDir = join(__dirname, "..");

const envPaths = [
  join(projectRoot, ".env"),
  join(backendDir, ".env"),
  join(process.cwd(), ".env"),
];

let loaded = false;
for (const p of envPaths) {
  if (existsSync(p)) {
    const result = config({ path: p });
    if (result.parsed) {
      loaded = true;
      break;
    }
  }
}
if (!loaded) config(); // Fallback to default .env in cwd

import express from "express";
import cors from "cors";
import { plantsRouter } from "./routes/plants.js";
import { pipelineRouter } from "./routes/pipeline.js";
import { contactsRouter } from "./routes/contacts.js";
import { visitsRouter } from "./routes/visits.js";
import { projectsRouter } from "./routes/projects.js";
import { commissioningsRouter } from "./routes/commissionings.js";
import "./db.js";
import "./services/uploads.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/plants", plantsRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/visits", visitsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/commissionings", commissioningsRouter);

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.get("/api/debug-env", (_, res) => {
  const hunterKey = (process.env.HUNTER_API_KEY || "").trim();
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  res.json({
    hasGoogleKey: !!process.env.GOOGLE_PLACES_API_KEY,
    hasHunterKey: !!hunterKey,
    hunterKeyLength: hunterKey.length,
    hunterKeyPreview: hunterKey ? `${hunterKey.slice(0, 4)}...${hunterKey.slice(-4)}` : null,
    hasOpenAIKey: !!openaiKey,
    openaiKeyLength: openaiKey.length,
    envPathsChecked: envPaths,
    cwd: process.cwd(),
  });
});

// Serve frontend static files in production (Railway, etc.)
const frontendDist = join(__dirname, "..", "..", "frontend", "dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_, res) => {
    res.sendFile(join(frontendDist, "index.html"));
  });
}

// Pipeline runs can take many minutes (geocoding + Places API + LLM). Use 15 min to match Railway's max.
const SERVER_TIMEOUT_MS = 15 * 60 * 1000;

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.warn("WARNING: GOOGLE_PLACES_API_KEY not set. Checked:", envPaths.join(", "));
  }
  if (!process.env.HUNTER_API_KEY) {
    console.warn("WARNING: HUNTER_API_KEY not set. Contact discovery will not work.");
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY not set. LLM manufacturing interpretation will be skipped.");
  }
});

server.timeout = SERVER_TIMEOUT_MS;
server.keepAliveTimeout = 65;
server.headersTimeout = Math.max(SERVER_TIMEOUT_MS + 1000, 66000);
