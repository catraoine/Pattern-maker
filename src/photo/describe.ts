// Server side only: asks Claude what a garment described in words is, whether the app can draft it, and
// which garment and style options to start from. Imported by the Netlify function, never by the app.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { Reading, SYSTEM as READING_GUIDE, piece, spendLimitReached } from './analyze';
import { IdeaReading, IdeaResponse, MAX_IDEA_CHARS } from './types';

const Idea = z.object({
  verdict: z.enum(['make', 'closest', 'not_yet']),
  name: z.string(),
  note: z.string(),
  start: piece.nullable(),
  bias: z.boolean(),
  reading: Reading,
});

const SYSTEM = `A home sewist has typed what they would like to make, in their own words. The app drafts patterns to their measurements, but only for these garments: skirts, dresses (a bodice joined to a skirt at the waist, with a back zip), woven tops, knit T-shirts, trousers (including shorts and culottes), jackets and coats. Decide what it can offer.

- verdict:
  - "make" when it is one of those garments with details the app has, even under another name (a slip dress, a camisole, a corset top, culottes, a pencil skirt, a blazer, a trench).
  - "closest" when the app can get near it with one of those garments but something will differ (a jumpsuit started as trousers, a shirt dress drafted with a waist seam, a kimono jacket, a cape started as a coat).
  - "not_yet" when no garment is near: swimwear, lingerie and bras, bags, hats, knitwear, children's clothes, anything that isn't clothing.
- name: what they asked for, in two to four plain lower-case words, such as "slip dress" or "wide-leg jumpsuit". No article.
- note: one or two short, friendly sentences to the sewist. For "make", what you set up for them. For "closest", plainly what will be different, and for a two-piece idea which garment to make next to finish it. For "not_yet", why the app can't draft it yet (for swimwear and lingerie: they need patterns drafted for stretch fabric). Never mention prices, other apps or AI.
- start: the garment to start from ("skirt", "dress", "top", "tee", "trousers", "jacket", "coat"), or null for "not_yet".
- bias: true for a skirt or dress cut on the bias (a slip skirt or slip dress), otherwise false.
- reading: the style of the start garment, filled in exactly like the photo reading described below, as if the photo showed what they described. Use their words for every detail they give and the plain, everyday choice for anything they don't. Use "high" confidence for details they named and "medium" for the rest. Set reading.garment to the start garment ("other" for "not_yet"), pieces to that one garment at x 0.5, y 0.5, and worn to true. Fill reading.measures only with sizes they give (a neckline 12 cm deep, a hem at the ankle), otherwise null, and reading.unsure with null. List in reading.missing every feature they asked for that the fields can't draft.

The photo reading, for reference:

${READING_GUIDE}`;

/** Their words, trimmed; null when there is nothing to read or too much. */
export function checkIdea(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  return t && t.length <= MAX_IDEA_CHARS ? t : null;
}

/** Ask Claude about the described idea and turn every outcome into an IdeaResponse the app can show. */
export async function describeIdea(text: unknown, client: Anthropic | null): Promise<IdeaResponse> {
  if (!client) return { ok: false, error: 'not_configured' };
  const idea = checkIdea(text);
  if (!idea) return { ok: false, error: 'bad_image' };

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      // A reading is a few hundred words at most; the ceiling bounds what one request can ever cost (about 16 cents).
      max_tokens: 8000,
      output_config: { effort: 'low', format: betaZodOutputFormat(Idea) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: `What they would like to make: ${idea}` }] }],
    });
    // Logged so the real cost per reading shows in Netlify's function logs.
    console.log('idea reading tokens', { in: response.usage?.input_tokens, out: response.usage?.output_tokens });
    if (response.stop_reason === 'refusal') return { ok: false, error: 'declined' };
    const parsed = response.parsed_output as IdeaReading | null;
    if (!parsed) return { ok: false, error: 'failed' };
    // A garment to start from only when there is one to make.
    const out: IdeaReading = parsed.verdict === 'not_yet' ? { ...parsed, start: null } : parsed.start ? parsed : { ...parsed, verdict: 'not_yet' };
    return { ok: true, idea: out };
  } catch (e) {
    if (spendLimitReached(e)) return { ok: false, error: 'busy' };
    console.error('describeIdea failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return { ok: false, error: 'failed' };
  }
}

export { wishKey } from './wish';
