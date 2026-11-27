// POST: a tester email from the team's threads, sent through Resend from hello@maisontrace.co with links exactly as
// written (the Gmail connector blanked them, Nov 19). See src/server/testerMail.ts for what it checks. Needs, in
// Netlify's environment variables: RESEND_API_KEY, TESTER_MAIL_KEY (a long random key, sent in the x-tester-mail-key
// header) and TESTER_MAIL_COPY_TO (Cat's inbox: every email is copied there, and replies go there). Without any of
// them nothing is sent. Optional TESTER_MAIL_FROM_NAME is the name testers see beside hello@maisontrace.co.
import { createHash, timingSafeEqual } from 'node:crypto';
import { blobCounts } from '../../src/server/blobCounts';
import { EMAIL_CAPS } from '../../src/server/emailPdf';
import { MAX_TESTER_MAIL_REQUEST, TESTER_MAIL_CAP, checkTesterMail, linkAllowed, linksIn, testerMailFor } from '../../src/server/testerMail';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

// Compared as hashes, so the check takes the same time however much of a wrong key matches.
const hash = (s: string) => createHash('sha256').update(s).digest();
function keyMatches(given: string | null, want: string): boolean {
  return !!given && timingSafeEqual(hash(given.trim()), hash(want));
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const resendKey = Netlify.env.get('RESEND_API_KEY')?.trim();
  const mailKey = Netlify.env.get('TESTER_MAIL_KEY')?.trim();
  const copyTo = Netlify.env.get('TESTER_MAIL_COPY_TO')?.trim();
  // Fails closed: a missing or short key, or nowhere to copy to, and nothing is sent.
  if (!resendKey || !mailKey || mailKey.length < 32 || !copyTo) return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  if (!keyMatches(req.headers.get('x-tester-mail-key'), mailKey)) return Response.json({ ok: false, error: 'not_allowed' }, { status: 403 });

  if (Number(req.headers.get('content-length') ?? 0) > MAX_TESTER_MAIL_REQUEST) return Response.json({ ok: false, error: 'too_big' }, { status: 413 });
  const body = await req.text();
  if (body.length > MAX_TESTER_MAIL_REQUEST) return Response.json({ ok: false, error: 'too_big' }, { status: 413 });
  const mail = checkTesterMail(body);
  if (!mail) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  // Every link is checked before anything is counted or sent; the answer names the ones turned away.
  const badLinks = linksIn(mail.text).filter((l) => !linkAllowed(l));
  if (badLinks.length) return Response.json({ ok: false, error: 'link_not_allowed', links: badLinks }, { status: 400 });

  try {
    // Fails closed: if a counter can't be reached, the throw lands below and nothing is sent.
    const day = new Date().toISOString().slice(0, 10);
    const shared = blobCounts('email-limits');
    const own = blobCounts('tester-mail-limits');
    // The same send asked for again (a retry after a dropped connection) isn't counted again; Resend sends it once.
    const sentKey = mail.sendId && `${day}/sent/${mail.sendId}`;
    const repeat = !!sentKey && (await own.get(sentKey)) > 0;
    if (!repeat) {
      // Room for both is checked first, so a refusal near the end of the day doesn't use up a send it didn't make.
      if ((await shared.get(`${day}/all`)) > EMAIL_CAPS.all - 2) return Response.json({ ok: false, error: 'busy' }, { status: 503 });
      if ((await own.get(`${day}/all`)) >= TESTER_MAIL_CAP) return Response.json({ ok: false, error: 'limit_reached' }, { status: 429 });
      // The same day count as "Email me the PDF", twice: the tester's email and Cat's copy. Taken before the testers' own
      // count (weekly review, Nov 23): a PDF email landing in between makes this 'busy', and it mustn't have used up one
      // of the day's tester sends first.
      if (!(await shared.take(`${day}/all`, EMAIL_CAPS.all)) || !(await shared.take(`${day}/all`, EMAIL_CAPS.all))) return Response.json({ ok: false, error: 'busy' }, { status: 503 });
      if (!(await own.take(`${day}/all`, TESTER_MAIL_CAP))) return Response.json({ ok: false, error: 'limit_reached' }, { status: 429 });
      // Marked only once it has been counted, so a send refused above is counted when it's tried again.
      if (sentKey) await own.take(sentKey, 1);
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        // The same send asked for twice goes out once.
        ...(mail.sendId ? { 'Idempotency-Key': `tester-mail-${mail.sendId}` } : {}),
      },
      body: JSON.stringify(testerMailFor(mail, copyTo, Netlify.env.get('TESTER_MAIL_FROM_NAME') ?? 'Maison Tracé')),
    });
    if (!res.ok) {
      // Only the status: the service's reply could hold the address, which is never logged.
      console.error('tester email not sent', res.status);
      return Response.json({ ok: false, error: 'failed', status: res.status }, { status: 502 });
    }
    const { id } = (await res.json().catch(() => ({}))) as { id?: string };
    return Response.json({ ok: true, id });
  } catch (e) {
    console.error('tester email not sent', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
};

// Netlify turns away more than 20 requests a minute from one address before the function starts, so a wrong-key
// script can't hammer it; 20 a minute still lets a round of check-ins go out one by one.
export const config = { rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
