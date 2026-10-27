// POST { code }: whether it's a fit tester code, so Your account can say so before a photo is read.
// The codes are TESTER_CODES in Netlify (Site configuration > Environment variables), comma separated.
// Checks are capped per visitor, so codes can't be guessed by trying them all.
import { createHash } from 'node:crypto';
import { blobCounts } from '../../src/server/blobCounts';
import { isTesterCode, takeAllowance } from '../../src/photo/limit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

const CAPS = { visitor: 10, all: 500 };


export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let code: unknown;
  try {
    code = ((await req.json()) as { code?: unknown }).code;
  } catch {
    code = undefined;
  }
  if (typeof code !== 'string' || code.length > 60) return Response.json({ ok: false, error: 'bad_code' }, { status: 400 });
  try {
    const visitor = createHash('sha256').update(context.ip ?? 'unknown').digest('hex').slice(0, 24);
    if ((await takeAllowance(blobCounts('tester-check-limits'), visitor, new Date(), CAPS)) !== 'ok') return Response.json({ ok: false, error: 'limit_reached' }, { status: 429 });
  } catch (e) {
    console.error('tester check limit failed', e);
  }
  return Response.json({ ok: true, tester: isTesterCode(code, Netlify.env.get('TESTER_CODES')) });
};
