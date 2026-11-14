// POST { unit }: a fit tester's one-scan pass for Bodygram's body scanner, as the address to open. Testers only (the
// x-tester-code header). Needs BODYGRAM_API_KEY in Netlify: Site configuration > Environment variables.
import { createHash } from 'node:crypto';
import { blobCounts } from '../../src/server/blobCounts';
import { isTesterCode } from '../../src/photo/limit';
import { newScanToken, scanUrl, takeScanPass } from '../../src/server/bodyScan';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

// Testers are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!isTesterCode(req.headers.get('x-tester-code'), Netlify.env.get('TESTER_CODES'))) return Response.json({ ok: false, error: 'not_tester' }, { status: 403 });
  const key = Netlify.env.get('BODYGRAM_API_KEY');
  if (!key) return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  let unit: unknown;
  try {
    unit = ((await req.json()) as { unit?: unknown }).unit;
  } catch {
    unit = undefined;
  }
  try {
    const allowance = await takeScanPass(blobCounts('body-scan-limits'), visitorId(context.ip));
    if (allowance !== 'ok') return Response.json({ ok: false, error: allowance }, { status: 429 });
  } catch (e) {
    // If the counter can't be reached, no pass is made: an uncounted pass is one the monthly cap can't stop.
    console.error('body scan limit check failed', e);
    return Response.json({ ok: false, error: 'busy' }, { status: 503 });
  }
  try {
    const token = await newScanToken(key);
    if (!token) return Response.json({ ok: false, error: 'failed' }, { status: 502 });
    return Response.json({ ok: true, url: scanUrl(token, unit === 'in' ? 'in' : 'cm') });
  } catch (e) {
    console.error('body scan pass failed', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
};

// Netlify turns away more than 10 requests a minute from one address before the function even starts.
export const config = { rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
