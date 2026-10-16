// POST fit notes a sewist chose to send. They're kept in the "fit-feedback" Netlify Blobs store, one entry per
// report, keyed by date: open the site in Netlify, then Blobs, to read them. Nothing that identifies the sender is kept.
import { createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { checkFitReport } from '../../src/server/fitReport';
import { takeAllowance, type CountStore } from '../../src/photo/limit';

const CAPS = { visitor: 20, all: 500 };

const blobCounts = (): CountStore => {
  const store = getStore({ name: 'fit-feedback-limits', consistency: 'strong' });
  return {
    get: async (key) => Number((await store.get(key)) ?? 0),
    set: async (key, count) => void (await store.set(key, String(count))),
  };
};

// Senders are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const report = checkFitReport(await req.text());
  if (!report) return Response.json({ ok: false, error: 'bad_report' }, { status: 400 });

  try {
    if ((await takeAllowance(blobCounts(), visitorId(context.ip), new Date(), CAPS)) !== 'ok') {
      return Response.json({ ok: false, error: 'limit_reached' }, { status: 429 });
    }
    const at = new Date().toISOString();
    await getStore('fit-feedback').setJSON(`${at.slice(0, 10)}/${at.slice(11, 19).replace(/:/g, '')}-${randomUUID().slice(0, 8)}`, {
      ...report,
      receivedAt: at,
    });
  } catch (e) {
    console.error('fit feedback not stored', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
  return Response.json({ ok: true });
};
