import { readFileSync } from "fs";
import { extname } from "path";

/**
 * Category-specific prompts tell GPT what to look for in each photo type.
 */
const CATEGORY_PROMPTS: Record<string, string> = {
  plc: `This is a photo of an industrial PLC (Programmable Logic Controller).
Extract the following from any visible labels, nameplates, or screens:
- Make / Manufacturer (e.g. Allen-Bradley, Siemens, Mitsubishi, Omron, Beckhoff, Schneider, GE)
- Model name/number (e.g. CompactLogix L33ER, S7-1200)
- Series (if visible, e.g. 1769, 1756, ControlLogix)
- Part number / catalog number (e.g. 1769-L33ER/B)

Respond in this exact JSON format (no markdown, no explanation):
{"make":"","model":"","series":"","part_no":""}
If a field is not visible, leave it as empty string.`,

  hmi: `This is a photo of an industrial HMI (Human Machine Interface / operator panel / touchscreen).
Extract the following from any visible labels, nameplates, or screens:
- Make / Manufacturer (e.g. Allen-Bradley, Siemens, Weintek, Proface, Maple Systems, Omron)
- Model name/number (e.g. PanelView Plus 7, KTP700 Basic)
- Part number / catalog number (e.g. 2711P-T7C22D9P)

Respond in this exact JSON format (no markdown, no explanation):
{"make":"","model":"","part_no":""}
If a field is not visible, leave it as empty string.`,

  vfd: `This is a photo of an industrial VFD (Variable Frequency Drive / variable speed drive / inverter).
Extract the following from any visible labels, nameplates, or plates:
- Make / Manufacturer (e.g. Allen-Bradley, ABB, Danfoss, Yaskawa, Siemens, Schneider, Emerson)
- Model name/number (e.g. PowerFlex 525, ACS550, VLT AQUA)
- HP rating (e.g. 5 HP, 10 HP — look for HP or kW on nameplate)
- Voltage rating (e.g. 480V, 460V, 230V)

Respond in this exact JSON format (no markdown, no explanation):
{"make":"","model":"","hp":"","voltage":""}
If a field is not visible, leave it as empty string.`,

  servo: `This is a photo of an industrial servo system component — either a servo drive/amplifier or a servo motor.
Extract the following from any visible labels, nameplates, or data plates:
- Make / Manufacturer (e.g. Allen-Bradley, Siemens, Fanuc, Yaskawa, Bosch Rexroth, SEW-Eurodrive, Kollmorgen, Beckhoff)
- Model name/number
- Part number / catalog number if visible
- Component type: "drive" if it looks like a drive/amplifier/controller, "motor" if it is a motor

Respond in this exact JSON format (no markdown, no explanation):
{"make":"","model":"","part_no":"","component":""}
If a field is not visible, leave it as empty string.`,

  machine: `This is a photo of industrial machinery or equipment at a manufacturing plant.
Describe what you see briefly and note any visible equipment tags, model plates, or serial number plates.
Respond in this exact JSON format (no markdown, no explanation):
{"description":""}`,

  other: `This is a photo taken at an industrial plant during an equipment mapping survey.
Note any relevant equipment information, labels, or text that is visible.
Respond in this exact JSON format (no markdown, no explanation):
{"notes":""}`,
};

export interface OcrResult {
  raw: string;
  // PLC fields
  make?: string;
  model?: string;
  series?: string;
  part_no?: string;
  // HMI fields (reuse make/model/part_no)
  // VFD fields
  hp?: string;
  voltage?: string;
  // Servo fields
  component?: string; // "drive" | "motor"
  // Fallback
  description?: string;
  notes?: string;
}

function mimeTypeFromExt(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export async function ocrPhoto(filePath: string, category: string): Promise<OcrResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const prompt = CATEGORY_PROMPTS[category] ?? CATEGORY_PROMPTS["other"];
  const imageData = readFileSync(filePath);
  const base64 = imageData.toString("base64");
  const mimeType = mimeTypeFromExt(filePath);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };

  const raw = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: OcrResult = { raw };
  try {
    const json = JSON.parse(raw);
    parsed = { raw, ...json };
  } catch {
    // raw OCR text couldn't be parsed — return raw only
  }

  return parsed;
}
