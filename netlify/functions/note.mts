// POST: a note sent from Help & feedback (Cat's H3, Nov 6, 2026). Kept in the "reports" Netlify Blobs store beside
// the crash reports: the note under note/<date>/, its screenshot (if any) on its own under note-shot/<date>/. Read
// them in the report read-out (see report.mts). Nothing that identifies the sender is kept.
import { createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { blobCounts } from '../../src/server/blobCounts';
import { MAX_NOTE_BYTES, NOTE_CAPS, checkNote, type StoredNote } from '../../src/server/notes';
import { takeAllowance } from '../../src/photo/limit';

// Senders are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  // Turned away before it's read, when it says it's too big to be a note.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_NOTE_BYTES) return Response.json({ ok: false, error: 'bad_note' }, { status: 413 });
  const note = checkNote(await req.text());
  if (!note) return Response.json({ ok: false, error: 'bad_note' }, { status: 400 });

  try {
    // Fails closed: if the counter can't be reached, the throw lands below and the note is refused.
    const allowance = await takeAllowance(blobCounts('note-limits'), visitorId(context.ip), new Date(), NOTE_CAPS);
    // The sender's own cap, or the whole site's for the day, each with its own words in the app.
    if (allowance !== 'ok') return Response.json({ ok: false, error: allowance }, { status: allowance === 'busy' ? 503 : 429 });
    const at = new Date().toISOString();
    const id = `${at.slice(0, 10)}/${at.slice(11, 19).replace(/:/g, '')}-${randomUUID().slice(0, 8)}`;
    const store = getStore({ name: 'reports', consistency: 'strong' });
    const { shot, ...rest } = note;
    const shotKey = `note-shot/${id}`;
    if (shot) await store.set(shotKey, shot);
    const stored: StoredNote = { ...rest, receivedAt: at, ...(shot ? { shot: shotKey } : {}) };
    try {
      await store.setJSON(`note/${id}`, stored);
    } catch (e) {
      // No screenshot left behind without its note, where nobody would find it to delete it.
      if (shot) await store.delete(shotKey).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error('note not stored', e);
    return Response.json({ ok: false, error: 'failed' }, { status: 502 });
  }
  return Response.json({ ok: true });
};
