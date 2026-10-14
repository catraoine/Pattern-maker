// Server side only: asks Claude which skirt style options a photo shows. Imported by the Netlify function,
// never by the app, so the API key and SDK stay off the phone.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, PhotoReading, PhotoResponse } from './types';

const confidence = z.enum(['low', 'medium', 'high']);

const Reading = z.object({
  garment: z.enum(['skirt', 'dress', 'trousers', 'top', 'other', 'none']),
  silhouette: z.object({ value: z.enum(['pencil', 'straight', 'a_line']), confidence }),
  length: z.object({ value: z.enum(['mini', 'above_knee', 'knee', 'midi', 'maxi']), confidence }),
  fit: z.object({ value: z.enum(['fitted', 'regular', 'relaxed']), confidence }),
  details: z.string(),
});

const SYSTEM = `You help home sewists turn a photo of a skirt into a sewing pattern. The app drafts a darted skirt with a waistband and a centre back zip, from the sewist's own measurements. Your job is only to read the style from the photo; the size always comes from their measurements.

Pick the closest option in each group:
- garment: what the main item in the photo is. Use "none" if there is no clothing.
- silhouette: "pencil" narrows toward the hem, "straight" hangs straight down from the hip, "a_line" flares out toward the hem. For a very full, gathered or circle skirt, pick "a_line" and mention the fullness in details.
- length, where the hem falls on the wearer: "mini" (mid-thigh), "above_knee", "knee", "midi" (mid-calf), "maxi" (near the ankle). For a skirt laid flat or on a hanger, estimate from its proportions and use low confidence.
- fit, how close it sits at the hip: "fitted" (close to the body), "regular" (some room), "relaxed" (loose).

Confidence: "high" when the photo clearly shows it, "medium" when it is a reasonable reading, "low" when you are guessing (cropped, folded, odd angle, or not a skirt).

details: one short, friendly sentence naming design features the app can't draft yet that the sewist may want to add themselves (for example pleats, a front slit, patch pockets, a yoke, buttons down the front, a ruffle). Leave it empty if there are none. If the item isn't a skirt, still fill in your best skirt reading and say what the item is.`;

export interface AnalyzeInput {
  image: string; // base64, no data: prefix
  mediaType: string;
}

/** Validate the upload, ask Claude, and turn every outcome into a PhotoResponse the app can show. */
export async function analyzePhoto(input: AnalyzeInput, client: Anthropic | null): Promise<PhotoResponse> {
  if (!client) return { ok: false, error: 'not_configured' };
  if (typeof input?.image !== 'string' || !(IMAGE_TYPES as readonly string[]).includes(input.mediaType)) {
    return { ok: false, error: 'bad_image' };
  }
  if (input.image.length > MAX_IMAGE_BYTES) return { ok: false, error: 'too_large' };

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
