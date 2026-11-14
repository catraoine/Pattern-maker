// GET with the signed-in person's token: their Founding Atelier place, if their email is on the list (src/server/founding.ts).
// The app uses it to show "Founding member No. 12" in Your account, and from Feb 9 to let a founding member past the
// waitlist page before launch. The email comes from Supabase, never from the request, so nobody can ask about
// someone else's. Anything that can't be checked answers "not on the list" (fails closed), so it never lets anyone in.
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { blobCounts } from '../../src/server/blobCounts';
import { MEMBERS_KEY, placeFor, readList } from '../../src/server/founding';
import { takeAllowance } from '../../src/photo/limit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

// Someone opens the app a few times a day; the cap only stops a script hammering Supabase through us.
const CAPS = { visitor: 60, all: 20_000 };

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const url = Netlify.env.get('SUPABASE_URL') ?? Netlify.env.get('VITE_SUPABASE_URL');
  const key = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Netlify.env.get('VITE_SUPABASE_ANON_KEY');
  if (!url || !key) return Response.json({ ok: false, error: 'not_set_up' }, { status: 503 });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ ok: false, error: 'signed_out' }, { status: 401 });

  try {
    const ip = createHash('sha256').update(context.ip ?? 'unknown').digest('hex').slice(0, 24);
    if ((await takeAllowance(blobCounts('founding-limits'), ip, new Date(), CAPS)) !== 'ok') return Response.json({ ok: false, error: 'limit_reached' }, { status: 429 });

    // Who the token belongs to, asked of Supabase itself. Only an email Supabase has checked counts.
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!who.ok) return Response.json({ ok: false, error: 'signed_out' }, { status: 401 });
    const { email } = (await who.json()) as { email?: string };
    if (!email) return Response.json({ ok: false, error: 'signed_out' }, { status: 401 });

    const list = readList(await getStore({ name: 'founding', consistency: 'strong' }).get(MEMBERS_KEY, { type: 'json' }));
    if (!list) return Response.json({ ok: true, place: null });
    return Response.json({ ok: true, place: placeFor(list, email) });
  } catch (e) {
    console.error('founding check failed', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
};
