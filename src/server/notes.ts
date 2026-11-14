// Server side only: checks a "Send us a note" from the Help page before it's stored beside the crash reports, in the
// "reports" Netlify Blobs store. A note is what the sewist wrote, the screen they came from, the app version, the
// browser family and, if they added one, a small screenshot they picked themselves. If they'd like a reply, the email
// they typed for it, and whether they're a fit tester (never the tester code). No IP address is kept.
import { z } from 'zod';
import { REPLY_EMAIL, REPLY_EMAIL_MAX } from '../help/replyEmail';

/** The words they write. Long enough for a real problem, short enough that a paste of a whole page is turned away. */
export const NOTE_MAX = 2_000;
/** The screenshot, shrunk on the phone to a small JPEG first (see src/help/note.ts), as a data address. */
const SHOT_MAX = 700_000;
/** The whole request: the note, the details and the screenshot, with a little room. */
export const MAX_NOTE_BYTES = SHOT_MAX + 8_000;
/** Daily caps, so a stuck page or a script can't fill the store: per sender, and for the whole site. */
export const NOTE_CAPS = { visitor: 10, all: 300 };

const SHOT = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

const NoteSchema = z
  .object({
    note: z.string().trim().min(1).max(NOTE_MAX),
    view: z.string().max(30),
    version: z.string().max(40),
    browser: z.string().max(40),
    shot: z.string().max(SHOT_MAX).regex(SHOT).optional(),
    /** Only when they typed one so we can write back (Help box for testers, Nov 14). */
    email: z.string().trim().max(REPLY_EMAIL_MAX).regex(REPLY_EMAIL).optional(),
    /**
     * True when this device holds a tester code, so a tester's note is answered first. The code itself is never sent.
     * Not checked here: anyone could set it, but it only changes the order Cat reads notes in, and every reply is hers.
     */
    tester: z.literal(true).optional(),
  })
  .strict();

export type Note = z.infer<typeof NoteSchema>;
/** What's kept: the note without its screenshot, which is stored on its own so the read-out stays small. */
export interface StoredNote extends Omit<Note, 'shot'> {
  receivedAt: string;
  /** The key of its screenshot, to open with the read-out's &shot=. */
  shot?: string;
}

/** The note to store, or null when the body isn't one (or is too big to be one). */
export function checkNote(text: string): Note | null {
  if (new TextEncoder().encode(text).length > MAX_NOTE_BYTES) return null;
  try {
    const r = NoteSchema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** A stored screenshot's bytes, from its data address. */
export const shotBytes = (shot: string) => Buffer.from(shot.slice(shot.indexOf(',') + 1), 'base64');
