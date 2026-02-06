import { Router } from "express";
import { runIngestion } from "../services/ingestion.js";

export const pipelineRouter = Router();

pipelineRouter.post("/run", async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GOOGLE_PLACES_API_KEY is not configured. Add it to .env",
    });
  }

  const location = req.body?.location as string | undefined;

  try {
    const result = await runIngestion(apiKey, { location });
    res.json(result);
  } catch (err) {
    console.error("Pipeline run failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Pipeline run failed",
    });
  }
});
