// POST with the signed-in person's token: deletes their account and the work kept in it (Your account > Delete my
// account). Their saved work goes with the account (backups cascade); purchase records stay, without the person.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify (Site configuration > Environment variables).

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = Netlify.env.get('SUPABASE_URL') ?? Netlify.env.get('VITE_SUPABASE_URL');
  const key = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return Response.json({ ok: false, error: 'not_set_up' }, { status: 503 });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ ok: false, error: 'signed_out' }, { status: 401 });

  // Who the token belongs to, asked of Supabase itself, so nobody can delete someone else's account.
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!who.ok) return Response.json({ ok: false, error: 'signed_out' }, { status: 401 });
  const { id } = (await who.json()) as { id?: string };
  if (!id) return Response.json({ ok: false, error: 'signed_out' }, { status: 401 });

  const gone = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!gone.ok) {
    console.error('delete account failed', gone.status, await gone.text().catch(() => ''));
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
  return Response.json({ ok: true });
};
