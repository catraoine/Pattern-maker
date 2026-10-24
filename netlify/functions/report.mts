// POST: the app's report beacon, sent once when a visit ends or the tab is hidden (anonymous daily counts, and crash
// reports with no measurements, names or photos). Kept in the "reports" Netlify Blobs store: daily totals under
// day/<date>, crash reports under crash/<date>/. No IP address or per-person id is stored.
// GET ?key=…: the owner's read-out of the daily totals, recent crash reports, sign-ups and every fit report sent, as
// JSON. Add &download=1 to save it as a dated file (the weekly backup of the fit evidence). Needs STATS_KEY set in
// Netlify (Site configuration > Environment variables); without it the read-out is refused.
import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { addBeacon, checkBeacon, byLanguage, funnel, keyMatches, lastDays, updateDay, type DayStore, type DayTotals, type StoredCrash } from '../../src/server/reports';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

const reports = () => getStore({ name: 'reports', consistency: 'strong' });

const blobDays = (): DayStore => {
  const store = reports();
  return {
    read: async (key) => {
      const r = await store.getWithMetadata(key, { type: 'json' });
      return r ? { value: r.data as DayTotals, etag: r.etag } : null;
    },
    write: async (key, value, etag) => (await store.setJSON(key, value, etag ? { onlyIfMatch: etag } : { onlyIfNew: true })).modified,
  };
};

async function record(text: string) {
  const beacon = checkBeacon(text);
  if (!beacon) return new Response(null, { status: 400 });
  const at = new Date().toISOString();
  const day = at.slice(0, 10);
  try {
    const crashes = await updateDay(blobDays(), `day/${day}`, (d) => {
      const r = addBeacon(d, beacon, at);
      return { day: r.day, extra: r.crashes };
    });
    const store = reports();
    const time = at.slice(11, 19).replace(/:/g, '');
    await Promise.all((crashes ?? []).map((c) => store.setJSON(`crash/${day}/${time}-${randomUUID().slice(0, 8)}`, c)));
  } catch (e) {
    // Reports are best effort: the visitor never waits on them or sees a failure.
    console.error('report not stored', e);
  }
  return new Response(null, { status: 204 });
}

async function readOut(url: URL) {
  const expected = Netlify.env.get('STATS_KEY');
  if (!expected) return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  if (!keyMatches(url.searchParams.get('key'), expected)) return Response.json({ ok: false, error: 'wrong_key' }, { status: 401 });

  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const store = reports();
  const signupStore = getStore({ name: 'signups', consistency: 'strong' });
  const totals = await Promise.all(
    lastDays(new Date(), days).map(async (day) => ({ day, totals: (await store.get(`day/${day}`, { type: 'json' })) as DayTotals | null })),
  );
  const crashKeys = (await store.list({ prefix: 'crash/' })).blobs
    .map((b) => b.key)
    .sort()
    .reverse()
    .slice(0, 100);
  const crashes = (await Promise.all(crashKeys.map((k) => store.get(k, { type: 'json' })))) as StoredCrash[];
  const signups = async (prefix: string) => Promise.all((await signupStore.list({ prefix })).blobs.map((b) => signupStore.get(b.key, { type: 'json' })));
  const [testers, news, interest] = await Promise.all([signups('tester/'), signups('news/'), signups('interest/')]);
  const fitStore = getStore('fit-feedback');
  const fitReports = await Promise.all((await fitStore.list()).blobs.map((b) => fitStore.get(b.key, { type: 'json' })));

  const days_ = totals.flatMap(({ day, totals: t }) => (t ? [{ day, ...t }] : []));
  return Response.json(
    {
      ok: true,
      // The four numbers the plan watches weekly (sign-ups by source, printed, fit reported, paid), over these days.
      funnel: funnel(days_),
      days: days_,
      crashes,
      // Which language waitlist sign-ups sew in, so the first translation follows them.
      newsByLanguage: byLanguage(news),
      signups: { testers, news, interest },
      fitReports,
    },
    { headers: { 'Cache-Control': 'no-store', ...(url.searchParams.has('download') ? { 'Content-Disposition': `attachment; filename="maison-trace-backup-${new Date().toISOString().slice(0, 10)}.json"` } : {}) } },
  );
}

export default async (req: Request) => {
  if (req.method === 'POST') return record(await req.text());
  if (req.method === 'GET') return readOut(new URL(req.url));
  return new Response('Method not allowed', { status: 405 });
};
