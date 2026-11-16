// POST: "Email me the PDF" from the Print screen, for a signed-in person (to their own email) or a fit tester. Checks the request (src/server/emailPdf.ts), counts it against the
// daily caps, then sends it through Resend from hello@maisontrace.co. Needs RESEND_API_KEY set in Netlify (Site
// configuration > Environment variables); without it nothing is sent. Nothing about the request is stored.
import { createHash } from 'node:crypto';
import { blobCounts } from '../../src/server/blobCounts';
import { EMAIL_CAPS, MAX_EMAIL_REQUEST, checkEmailRequest, emailFor } from '../../src/server/emailPdf';
import { isTesterCode, takeAllowance } from '../../src/photo/limit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

// Senders are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

/** The address this request may send to, or undefined. */
async function allowedTo(req: Request, typed: string): Promise<string | undefined> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token) {
    const url = Netlify.env.get('SUPABASE_URL') ?? Netlify.env.get('VITE_SUPABASE_URL');
    const key = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Netlify.env.get('VITE_SUPABASE_ANON_KEY');
    if (!url || !key) return undefined;
    try {
      const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
      if (!who.ok) return undefined;
      const { email, email_confirmed_at } = (await who.json()) as { email?: string; email_confirmed_at?: string | null };
      return email && email_confirmed_at ? email : undefined;
    } catch {
      return undefined;
    }
  }
  return isTesterCode(req.headers.get('x-tester-code'), Netlify.env.get('TESTER_CODES')) ? typed : undefined;
}

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = Netlify.env.get('RESEND_API_KEY');
  if (!key) return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  // Turned away before it's read, when it says it's too big to be a pattern.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_EMAIL_REQUEST) return Response.json({ ok: false, error: 'too_big' }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_EMAIL_REQUEST) return Response.json({ ok: false, error: 'too_big' }, { status: 413 });
  const request = checkEmailRequest(text);
  if (!request) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });

  // Who it may go to (weekly review, Nov 16; Cat's "apply" pending): a signed-in person's own confirmed email, taken from
  // the account service and never from the request, or, for a fit tester (their code in x-tester-code), the address
  // they typed. Anyone else can't use our address to send a file to a stranger.
  const to = await allowedTo(req, request.to);
  if (!to) return Response.json({ ok: false, error: 'sign_in' }, { status: 403 });

  try {
    // Fails closed: if the counter can't be reached, the throw lands below and nothing is sent.
    const allowance = await takeAllowance(blobCounts('email-limits'), visitorId(context.ip), new Date(), EMAIL_CAPS);
    if (allowance !== 'ok') return Response.json({ ok: false, error: allowance }, { status: allowance === 'busy' ? 503 : 429 });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailFor({ ...request, to })),
    });
    if (!res.ok) {
      // Only the status: the service's reply could hold the address, which is never logged.
      console.error('email not sent', res.status);
      return Response.json({ ok: false, error: 'failed' }, { status: 502 });
    }
  } catch (e) {
    console.error('email not sent', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
  return Response.json({ ok: true });
};
