// POST a "Be a fit tester" or "Get news" sign-up. Kept in the "signups" Netlify Blobs store, one entry per email
// (signing up again replaces it): tester/<id>, news/<id> and interest/<offer>/<id>
// (interest/nights/<city>/<id> for Atelier Nights, so someone can count themselves in for more than one city). Read them through the report function's read-out.
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { blobCounts } from '../../src/server/blobCounts';
import { checkSignup } from '../../src/server/reports';
import { addToKit } from '../../src/server/kit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };
import { takeAllowance } from '../../src/photo/limit';

// The whole-site cap only stops a runaway bot, so it sits well above a launch day (5,000 sign-ups is the planning
// figure); the hidden bot trap and the per-sender cap do the everyday work. 20 per sender, because a sewing class on
// one wifi or phones on the same mobile network can share an address.
const CAPS = { visitor: 20, all: 25_000 };


const hash = (s: string, n: number) => createHash('sha256').update(s).digest('hex').slice(0, n);

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const signup = checkSignup(await req.text());
  if (!signup) return Response.json({ ok: false, error: 'bad_signup' }, { status: 400 });

  try {
    // Senders are counted by a hash of their IP address for the day, so no address is stored.
    if ((await takeAllowance(blobCounts('signup-limits'), hash(context.ip ?? 'unknown', 24), new Date(), CAPS)) !== 'ok') {
      return Response.json({ ok: false, error: 'limit_reached' }, { status: 429 });
    }
    await getStore({ name: 'signups', consistency: 'strong' }).setJSON(`${signup.kind === 'interest' ? `interest/${signup.offer}${signup.city ? `/${signup.city}` : ''}` : signup.kind}/${hash(signup.email, 16)}`, {
      ...signup,
      receivedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('sign-up not stored', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
  // Waitlist and news sign-ups also join the newsletter list in Kit, once it's set up (src/server/kit.ts).
  if (signup.kind === 'news') {
    const kit = await addToKit(signup.email, signup.src, { apiKey: Netlify.env.get('KIT_API_KEY'), formId: Netlify.env.get('KIT_FORM_ID') }, new URL(req.url).origin);
    if (kit === 'failed') {
      // Kept for the hourly catch-up (kit-catch-up.mts), so a rush past Kit's rate limit still gets the welcome email.
      try {
        await getStore({ name: 'kit-retry', consistency: 'strong' }).setJSON(hash(signup.email, 16), { email: signup.email, src: signup.src, tries: 0 });
      } catch (e) {
        console.error('sign-up not added to Kit or kept for retry', e);
      }
    }
  }
  return Response.json({ ok: true });
};
