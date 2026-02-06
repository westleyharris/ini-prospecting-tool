import OpenAI from "openai";

export interface PlaceForInterpretation {
  index: number;
  name: string;
  types: string[];
  primaryType: string | null;
  editorialSummary: string | null;
  generativeSummary: string | null;
  formattedAddress: string | null;
}

export interface InterpretationResult {
  index: number;
  relevance: "high" | "medium" | "low" | "none";
  reason: string;
}

const BATCH_SIZE = 20;
const MODEL = "gpt-4o";

function formatPlaceForPrompt(p: PlaceForInterpretation): string {
  const typesStr =
    p.types?.length > 0
      ? JSON.stringify(p.types)
      : p.primaryType ?? "(no type)";
  const summary =
    p.generativeSummary ?? p.editorialSummary ?? "(no summary)";
  return `${p.index} | ${p.name} | ${typesStr} | ${summary}`;
}

/**
 * Batch-interpret places as manufacturing prospects using GPT-4o.
 * Returns relevance per place: high, medium, low, or none.
 */
export async function interpretManufacturingRelevance(
  apiKey: string,
  places: PlaceForInterpretation[]
): Promise<InterpretationResult[]> {
  if (places.length === 0) return [];

  const openai = new OpenAI({ apiKey: apiKey.trim() });
  const lines = places.map(formatPlaceForPrompt).join("\n");

  const prompt = `You are classifying places as manufacturing/industrial prospects for B2B sales. For each place below, determine manufacturing relevance.

Return a JSON array with one object per place. Each object must have:
- index: the 0-based index from the list
- relevance: "high" | "medium" | "low" | "none"
- reason: brief explanation (1 short phrase)

Relevance guide:
- high: Clearly a manufacturing facility, factory, machine shop, fabrication, industrial plant
- medium: Likely manufacturing (e.g. general contractor, industrial supplier) or name/summary suggests it
- low: Unclear; could be related to manufacturing
- none: Clearly NOT manufacturing (retail, restaurant, office, etc.)

Places (index | name | types | summary):
${lines}

Return a JSON array. Example: [{"index":0,"relevance":"high","reason":"Metal fabrication"}]`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const choice = completion.choices[0];
  const content = choice?.message?.content;
  const finishReason = choice?.finish_reason;

  if (!content) {
    const detail =
      finishReason === "content_filter"
        ? " (content was filtered by safety system)"
        : finishReason
          ? ` (finish_reason: ${finishReason})`
          : completion.choices?.length === 0
            ? " (no choices in response)"
            : "";
    throw new Error(`No response from GPT-4o${detail}`);
  }

  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`Invalid JSON from GPT-4o: ${trimmed.slice(0, 100)}...`);
  }

  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    arr =
      (o.results as unknown[]) ??
      (o.places as unknown[]) ??
      (Array.isArray(o.data) ? o.data : []) ??
      Object.values(o).filter((v) => v && typeof v === "object" && "index" in v);
  }
  if (!Array.isArray(arr)) {
    throw new Error("GPT-4o did not return a valid results array");
  }

  const results: InterpretationResult[] = [];
  const indexSet = new Set(places.map((p) => p.index));

  for (const item of arr) {
    const idx = Number((item as { index?: number }).index);
    if (!indexSet.has(idx)) continue;
    const rel = (item as { relevance?: string }).relevance;
    const reason = String((item as { reason?: string }).reason ?? "").slice(0, 200);
    const validRel =
      rel === "high" || rel === "medium" || rel === "low" || rel === "none"
        ? rel
        : "low";
    results.push({ index: idx, relevance: validRel, reason });
  }

  return results;
}

/**
 * Interpret in batches of BATCH_SIZE to respect context limits.
 */
export async function interpretPlacesInBatches(
  apiKey: string,
  places: PlaceForInterpretation[]
): Promise<Map<number, InterpretationResult>> {
  const map = new Map<number, InterpretationResult>();

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const chunk = places.slice(i, i + BATCH_SIZE);
    const reindexed = chunk.map((p, j) => ({ ...p, index: i + j }));
    const batchResults = await interpretManufacturingRelevance(apiKey, reindexed);
    for (const r of batchResults) {
      map.set(r.index, r);
    }
    if (i + BATCH_SIZE < places.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return map;
}
