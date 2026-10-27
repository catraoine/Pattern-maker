// POST { text } describing a garment, get back whether the app can make it and the style to start from.
// Shares the ANTHROPIC_API_KEY the photo reading uses, with its own daily caps. Ideas the app can't make
// yet are counted by name (never with who asked), so the most wanted garments show up.
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { blobCounts } from '../../src/server/blobCounts';
import { checkIdea, describeIdea, wishKey } from '../../src/photo/describe';
import { TESTER_CAPS, TESTER_POOL, isTesterCode, takeAllowance, type Allowance } from '../../src/photo/limit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };


// Visitors are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  let text: unknown;
  try {
    text = ((await req.json()) as { text?: unknown }).text;
  } catch {
    text = undefined;
  }
  if (!checkIdea(text)) return Response.json({ ok: false, error: 'bad_image' }, { status: 400 });

  if (key) {
    let allowance: Allowance = 'ok';
    try {
      // A fit tester's code (sent from Your account) counts them in the testers' own, larger allowance.
      const tester = isTesterCode(req.headers.get('x-tester-code'), Netlify.env.get('TESTER_CODES'));
      allowance = tester
        ? await takeAllowance(blobCounts('describe-limits'), visitorId(context.ip), new Date(), TESTER_CAPS, TESTER_POOL)
        : await takeAllowance(blobCounts('describe-limits'), visitorId(context.ip));
    } catch (e) {
      // If the counter can't be reached, nothing is read: an uncounted reading is one the caps can't stop.
      console.error('describe limit check failed', e);
      allowance = 'busy';
    }
    if (allowance !== 'ok') return Response.json({ ok: false, error: allowance }, { status: 429 });
  }

  const result = await describeIdea(text, key ? new Anthropic({ apiKey: key }) : null);
  if (result.ok && result.idea.verdict === 'not_yet') {
    try {
      await blobCounts('wishes').take(wishKey(result.idea.name), Infinity);
    } catch (e) {
      console.error('wish count failed', e);
    }
  }
  const status = result.ok ? 200 : result.error === 'not_configured' ? 503 : result.error === 'failed' ? 502 : 400;
  return Response.json(result, { status });
};

// Netlify turns away more than 10 requests a minute from one address before the function even starts, so a script
// hammering it never reaches Claude or uses function time. The daily caps above still do the everyday work.
export const config = { rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
