// Server side only: asks Claude which skirt style options a photo shows. Imported by the Netlify function,
// never by the app, so the API key and SDK stay off the phone.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, PhotoError, PhotoReading, PhotoResponse } from './types';

const confidence = z.enum(['low', 'medium', 'high']);

const Reading = z.object({
  garment: z.enum(['skirt', 'dress', 'trousers', 'top', 'other', 'none']),
  silhouette: z.object({ value: z.enum(['pencil', 'straight', 'a_line', 'trumpet', 'half_circle', 'circle']), confidence }),
  length: z.object({ value: z.enum(['mini', 'above_knee', 'knee', 'midi', 'maxi']), confidence }),
  fit: z.object({ value: z.enum(['fitted', 'regular', 'relaxed']), confidence }),
  shape: z.object({ hemAt: z.number(), hemFullness: z.number(), flareAt: z.number().nullable(), confidence }),
  details: z.string(),
});

const SYSTEM = `You help home sewists turn a photo of a skirt into a sewing pattern. The app drafts a skirt with a waistband and a centre back zip, from the sewist's own measurements: either a darted skirt, or a circle skirt cut as a ring with no darts. Your job is only to read the style from the photo; the size always comes from their measurements.

Pick the closest option in each group:
- garment: what the main item in the photo is. Use "none" if there is no clothing.
- silhouette:
  - "pencil" narrows toward the hem.
  - "straight" hangs straight down from the hip.
  - "a_line" widens gently and evenly from the hip to the hem, keeping a clean outline without deep folds.
  - "trumpet" stays close to the body through the hips and thighs, then flares out lower down, usually from around the knee (also called mermaid, fishtail, godet or Edwardian walking skirt).
  - "half_circle" is smooth at the waist and falls into soft folds, noticeably fuller than an A-line; laid flat it makes a half circle (skater skirts are often half circles).
  - "circle" is very full, with deep folds all round the hem; laid flat it makes a whole circle (1950s circle skirts, ra-ra skirts). A skirt that is full because it is gathered or pleated into the waist, rather than smooth at the waist, is not a circle skirt: pick the closest shape and mention the gathers or pleats in details.
- length, where the hem falls on the wearer: "mini" (mid-thigh), "above_knee", "knee", "midi" (mid-calf), "maxi" (near the ankle). For a skirt laid flat or on a hanger, estimate from its proportions and use low confidence.
- fit, how close it sits at the hip: "fitted" (close to the body), "regular" (some room), "relaxed" (loose).
- shape: the exact proportions, so the pattern can match the photo rather than a standard shape. Measure them against the wearer's body, not the photo frame:
  - hemAt: where the hem falls, as a fraction of the distance from the natural waist (0) down to the floor (1). On a typical body the hip line is about 0.2, mid-thigh 0.38, just above the knee 0.5, the knee 0.56, mid-calf 0.76 and the ankle 0.93. For a skirt that sits below the natural waist, still measure from the natural waist.
  - hemFullness: the hem's circumference divided by the circumference round the hips. Judge it from how far the hem stands out from the hips and how deep and many the folds are. A pencil skirt is about 0.85 to 0.95, a straight skirt 1, an A-line 1.2 to 1.8, a half circle skirt about 2.5 to 3.5 and a full circle skirt 4 to 6 (more for a long one). Use any number in between that fits what you see.
  - flareAt: for a trumpet skirt, where the flare starts, as a fraction of waist to floor like hemAt (around the knee is 0.5 to 0.56). null for every other silhouette.

Confidence (for each group, and for the shape as a whole): "high" when the photo clearly shows it, "medium" when it is a reasonable reading, "low" when you are guessing (cropped, folded, odd angle, or not a skirt).

details: one short, friendly sentence naming design features the app can't draft yet that the sewist may want to add themselves (for example gathers, pleats, a front slit, patch pockets, a yoke, buttons down the front, a ruffle). Leave it empty if there are none. If the item isn't a skirt, still fill in your best skirt reading and say what the item is.`;

export interface AnalyzeInput {
  image: string; // base64, no data: prefix
  mediaType: string;
}

/** Cheap checks on the upload, done before anything that costs money. */
export function checkPhoto(input: AnalyzeInput): PhotoError | null {
  if (typeof input?.image !== 'string' || !(IMAGE_TYPES as readonly string[]).includes(input.mediaType)) return 'bad_image';
  if (input.image.length > MAX_IMAGE_BYTES) return 'too_large';
  return null;
}

/** Validate the upload, ask Claude, and turn every outcome into a PhotoResponse the app can show. */
export async function analyzePhoto(input: AnalyzeInput, client: Anthropic | null): Promise<PhotoResponse> {
  if (!client) return { ok: false, error: 'not_configured' };
  const bad = checkPhoto(input);
  if (bad) return { ok: false, error: bad };

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Reading a photo is a quick classification, so low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: betaZodOutputFormat(Reading) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: input.mediaType as (typeof IMAGE_TYPES)[number], data: input.image },
            },
            { type: 'text', text: 'Read the skirt style in this photo.' },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') return { ok: false, error: 'declined' };
    const reading = response.parsed_output as PhotoReading | null;
    return reading ? { ok: true, reading } : { ok: false, error: 'failed' };
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) return { ok: false, error: 'bad_image' };
    console.error('analyzePhoto failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return { ok: false, error: 'failed' };
  }
}
