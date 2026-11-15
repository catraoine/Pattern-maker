// POST { unit }: a fit tester's one-scan pass for Bodygram's body scanner, as the address to open. Testers only (the
// x-tester-code header). Needs BODYGRAM_API_KEY in Netlify: Site configuration > Environment variables.
import { createHash } from 'node:crypto';
import { blobCounts } from '../../src/server/blobCounts';
import { isTesterCode, takeAllowance } from '../../src/photo/limit';
import { newScanToken, scanUrl, takeScanPass } from '../../src/server/bodyScan';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

// Testers are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

// Code checks here are capped as the tester check's are (tester.mts), counted before the code is looked at: without
// it, this function answered "tester or not" up to 10 times a minute, so codes could be guessed here instead
// (security pass, Nov 15). A tester makes a scan or two a day.
const CODE_CAPS = { visitor: 10, all: 500 };

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let unit: unknown;
  let sent: unknown;
  try {
    ({ unit, code: sent } = (await req.json()) as { unit?: unknown; code?: unknown });
  } catch {
    unit = undefined;
  }
  // The code comes in the body, as the tester check's does: a header can't carry every character a code might have
  // (an accented letter, say), and the two checks must agree. The header is still read, for older copies of the app.
  const code = typeof sent === 'string' ? sent : req.headers.get('x-tester-code');
  try {
    if ((await takeAllowance(blobCounts('body-scan-code-limits'), visitorId(context.ip), new Date(), CODE_CAPS)) !== 'ok') return Response.json({ ok: false, error: 'limit_reached' }, { status: 429 });
  } catch (e) {
    // Fails closed: an uncounted check is one the cap can't stop.
    console.error('body scan code limit failed', e);
    return Response.json({ ok: false, error: 'busy' }, { status: 503 });
  }
  if (!isTesterCode(code, Netlify.env.get('TESTER_CODES'))) {
    // Never the code itself: only whether one was sent, so a stale code on a phone shows up in the log.
    console.error('body scan: not a tester code', code ? '(a code was sent)' : '(no code sent)');
    return Response.json({ ok: false, error: 'not_tester' }, { status: 403 });
  }
  // Trimmed, since a key pasted into Netlify can pick up a stray space or line break.
  const key = Netlify.env.get('BODYGRAM_API_KEY')?.trim();
  if (!key) {
    console.error('body scan: BODYGRAM_API_KEY is not set for this deploy');
    return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }
  try {
    const allowance = await takeScanPass(blobCounts('body-scan-limits'), visitorId(context.ip));
    if (allowance !== 'ok') {
      console.error('body scan: no pass left', allowance);
      return Response.json({ ok: false, error: allowance }, { status: 429 });
    }
  } catch (e) {
    // If the counter can't be reached, no pass is made: an uncounted pass is one the monthly cap can't stop.
    console.error('body scan limit check failed', e);
    return Response.json({ ok: false, error: 'busy' }, { status: 503 });
  }
  try {
    const token = await newScanToken(key);
    if (!token) {
      console.error('body scan: Bodygram gave no pass');
      return Response.json({ ok: false, error: 'failed' }, { status: 502 });
    }
    console.log('body scan: pass made');
    return Response.json({ ok: true, url: scanUrl(token, unit === 'in' ? 'in' : 'cm') });
  } catch (e) {
    console.error('body scan pass failed', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
};

// Netlify turns away more than 10 requests a minute from one address before the function even starts.
export const config = { rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
