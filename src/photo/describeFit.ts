// Server side only: asks Claude which problems on the fitting list a person's own description of their toile matches.
// It only picks from the list; the person ticks what it found and sets every amount themselves. Imported by the Netlify
// function, never by the app.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { FitTarget } from '../engine/fitting';
import { checkFitWords, fitIssuesFor, keepMatches, type FitWordsResponse } from '../fitWords';
import { askFor, spendLimitReached } from './analyze';

const SYSTEM = `A home sewist has sewn a toile (a test version of their pattern, in calico) and tried it on. They have described in their own words what they see. The app has a fixed list of fitting problems it can correct on the pattern, listed below with what each looks like. Pick the problems on the list that their words describe.

- matches: the ids of the problems they describe, most clearly described first. Only pick a problem their words point to: where on the body, which way the pull or fold runs, or what the toile does. Never add a problem they didn't describe, and never pick a problem and its opposite. When their words fit two problems equally (folds at the back waist could be a sway back, or the back being too long), pick both. Leave the list empty when nothing fits or their words are too vague to tell.
- side: for a problem that is on one side only, "left" or "right" when they say which side of their body, otherwise null. Always null for the rest.
- notCovered: anything they describe that no problem on the list corrects (sleeves, the crotch or the legs of trousers, a fabric fault, a sewing mistake), each in two to five plain lower-case words of their own, such as "tight sleeves". At most three. Leave it empty when everything they describe is on the list.

Never mention prices, other apps or AI.`;

/** Which garment the toile is, in plain words. */
const TOILE_OF: Record<FitTarget, string> = {
  skirt: 'a skirt',
  bodice: 'a top',
  dress: 'a dress',
  trousers: 'a pair of trousers',
  tee: 'a T-shirt',
  knit_dress: 'a knit dress',
  hoodie: 'a hoodie',
  jumpsuit: 'a jumpsuit',
  jacket: 'a jacket',
  coat: 'a coat',
  lingerie: 'lingerie',
};

/** The fitting list as the reader sees it: one line per problem, grouped by where on the body. */
const listFor = (garment: FitTarget, ids: ReturnType<typeof fitIssuesFor>) =>
  ids.map((i) => `- ${i.id} (${garment === 'dress' ? `${i.garment === 'skirt' ? 'skirt' : 'bodice'}, ` : ''}${i.area.toLowerCase()}${i.sided ? ', one side' : ''}): ${i.title}. ${i.detail}`).join('\n');

/** Ask Claude which listed problems their words describe, and turn every outcome into a response the app can show. */
export async function describeFit(text: unknown, garment: FitTarget, hasBustDart: boolean, client: Anthropic | null): Promise<FitWordsResponse> {
  if (!client) return { ok: false, error: 'not_configured' };
  const words = checkFitWords(text);
  const issues = fitIssuesFor(garment, hasBustDart);
  if (!words || !issues.length) return { ok: false, error: 'bad_image' };

  const Answer = z.object({
    matches: z.array(z.object({ id: z.enum(issues.map((i) => i.id) as [string, ...string[]]), side: z.enum(['left', 'right']).nullable() })),
    notCovered: z.array(z.string()),
  });
  try {
    const raw = await askFor(client, Answer, {
      label: 'fit words reading',
      // The answer is a few ids; the ceiling bounds what one request can ever cost.
      max_tokens: 4000,
      system: SYSTEM,
      content: [{ type: 'text', text: `The toile is ${TOILE_OF[garment]}.\n\nThe list:\n${listFor(garment, issues)}\n\nWhat they see: ${words}` }],
    });
    if (raw === 'refused') return { ok: false, error: 'declined' };
    if (!raw) return { ok: false, error: 'failed' };
    const notCovered = raw.notCovered
      .map((s) => s.trim().toLowerCase().replace(/[.:;]+$/, ''))
      .filter((s) => s && s.length <= 60)
      .slice(0, 3);
    return { ok: true, reading: { matches: keepMatches(raw.matches, issues), notCovered } };
  } catch (e) {
    if (spendLimitReached(e)) return { ok: false, error: 'busy' };
    console.error('describeFit failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return { ok: false, error: 'failed' };
  }
}
