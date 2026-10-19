// POST a photo (base64 JSON), get back the closest skirt style options. Needs ANTHROPIC_API_KEY set in
// Netlify: Site configuration > Environment variables.
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import { analyzePhoto, checkPhoto, type AnalyzeInput } from '../../src/photo/analyze';
import { TESTER_CAPS, TESTER_POOL, isTesterCode, takeAllowance, type Allowance, type CountStore } from '../../src/photo/limit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

const blobCounts = (): CountStore => {
  const store = getStore({ name: 'photo-limits', consistency: 'strong' });
  return {
    get: async (key) => Number((await store.get(key)) ?? 0),
    set: async (key, count) => void (await store.set(key, String(count))),
  };
};

// Visitors are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

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
        ? await takeAllowance(blobCounts(), visitorId(context.ip), new Date(), TESTER_CAPS, TESTER_POOL)
        : await takeAllowance(blobCounts(), visitorId(context.ip));
    } catch (e) {
      // If the counter can't be reached, still read the photo; the prepaid credit stays the hard cap.
      console.error('photo limit check failed', e);
    }
    if (allowance !== 'ok') return Response.json({ ok: false, error: allowance }, { status: 429 });
  }

  const result = await analyzePhoto(body, key ? new Anthropic({ apiKey: key }) : null);
  const status = result.ok ? 200 : result.error === 'not_configured' ? 503 : result.error === 'failed' ? 502 : 400;
  return Response.json(result, { status });
};
