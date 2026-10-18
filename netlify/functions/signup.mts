// POST a "Be a fit tester" or "Get news" sign-up. Kept in the "signups" Netlify Blobs store, one entry per email
// (signing up again replaces it): tester/<id>, news/<id> and interest/<offer>/<id>
// (interest/nights/<city>/<id> for Atelier Nights, so someone can count themselves in for more than one city). Read them through the report function's read-out.
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { checkSignup } from '../../src/server/reports';
import { takeAllowance, type CountStore } from '../../src/photo/limit';

const CAPS = { visitor: 5, all: 300 };

const blobCounts = (): CountStore => {
  const store = getStore({ name: 'signup-limits', consistency: 'strong' });
  return {
    get: async (key) => Number((await store.get(key)) ?? 0),
    set: async (key, count) => void (await store.set(key, String(count))),
  };
};

const hash = (s: string, n: number) => createHash('sha256').update(s).digest('hex').slice(0, n);

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const signup = checkSignup(await req.text());
  if (!signup) return Response.json({ ok: false, error: 'bad_signup' }, { status: 400 });

  try {
    // Senders are counted by a hash of their IP address for the day, so no address is stored.
    if ((await takeAllowance(blobCounts(), hash(context.ip ?? 'unknown', 24), new Date(), CAPS)) !== 'ok') {
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
  return Response.json({ ok: true });
};
