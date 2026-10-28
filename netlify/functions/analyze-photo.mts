// POST a photo (base64 JSON), get back the closest skirt style options. Needs ANTHROPIC_API_KEY set in
// Netlify: Site configuration > Environment variables.
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { blobCounts } from '../../src/server/blobCounts';
import { analyzeBack, analyzePhoto, checkPhoto, missingKeys, type AnalyzeInput } from '../../src/photo/analyze';
import { TESTER_CAPS, TESTER_POOL, isTesterCode, takeAllowance, type Allowance } from '../../src/photo/limit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };


// Visitors are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

async function countMissing(keys: string[]) {
  try {
    const store = blobCounts('missing-details');
    for (const k of keys) await store.take(k, Infinity);
  } catch (e) {
    console.error('missing detail count failed', e);
  }
}

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  let body: AnalyzeInput;
  try {
    body = (await req.json()) as AnalyzeInput;
  } catch {
    return Response.json({ ok: false, error: 'bad_image' }, { status: 400 });
  }
  const bad = checkPhoto(body);
  if (bad) return Response.json({ ok: false, error: bad }, { status: 400 });

  if (key) {
    let allowance: Allowance = 'ok';
    try {
      // A fit tester's code (sent from Your account) counts them in the testers' own, larger allowance.
      const tester = isTesterCode(req.headers.get('x-tester-code'), Netlify.env.get('TESTER_CODES'));
      allowance = tester
        ? await takeAllowance(blobCounts('photo-limits'), visitorId(context.ip), new Date(), TESTER_CAPS, TESTER_POOL)
        : await takeAllowance(blobCounts('photo-limits'), visitorId(context.ip));
    } catch (e) {
      // If the counter can't be reached, nothing is read: an uncounted reading is one the caps can't stop.
      console.error('photo limit check failed', e);
      allowance = 'busy';
    }
    if (allowance !== 'ok') return Response.json({ ok: false, error: allowance }, { status: 429 });
  }

  const client = key ? new Anthropic({ apiKey: key }) : null;
  // A back photo is read for its back details only, and counted like any reading.
  if (body.view === 'back') {
    const back = await analyzeBack(body, client);
    if (back.ok && back.back.shown) await countMissing(missingKeys({ garment: body.garment ?? 'other', missing: back.back.missing }));
    const status = back.ok ? 200 : back.error === 'not_configured' ? 503 : back.error === 'failed' ? 502 : 400;
    return Response.json(back, { status });
  }
  const result = await analyzePhoto(body, client);
  // What the app couldn't match is counted by name and garment (never with who sent it), so the most wanted details show up.
  if (result.ok) await countMissing(missingKeys(result.reading));
  const status = result.ok ? 200 : result.error === 'not_configured' ? 503 : result.error === 'failed' ? 502 : 400;
  return Response.json(result, { status });
};

// Netlify turns away more than 10 requests a minute from one address before the function even starts, so a script
// hammering it never reaches Claude or uses function time. The daily caps above still do the everyday work.
export const config = { rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
