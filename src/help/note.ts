// "Send us a note" from Help & feedback (Cat's H3, Nov 6, 2026): what the sewist wrote, plus the details they'd
// otherwise be asked for (the screen they came from, the app version, the browser), and a screenshot if they add one.
// Never measurements, names or patterns. An email only if they type one for a reply, and for a tester only the fact
// that they are one, never their tester code.
import { browserFamily } from '../report/report';
import type { Pin } from './pin';

const ENDPOINT = '/.netlify/functions/note';
/** The screenshot's longest side once shrunk: enough to read a phone screen, small enough to send on a slow line. */
const SHOT_SIDE = 1_000;

type NoteResult = 'sent' | 'limit' | 'busy' | 'failed';

/**
 * Shrinks a picked screenshot to a small JPEG, as a data address. A phone screenshot is 1 to 4 MB; this makes it
 * about a tenth of that. Null if the file isn't a picture the browser can read.
 */
export async function shrinkShot(file: Blob, side = SHOT_SIDE): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const pen = canvas.getContext('2d');
    if (!pen) return null;
    // A JPEG has no see-through: clear parts of a picked picture come out white, not black.
    pen.fillStyle = '#fff';
    pen.fillRect(0, 0, canvas.width, canvas.height);
    pen.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // A busy screenshot can still come out big: step the quality down until it fits what the server takes.
    for (const q of [0.75, 0.6, 0.45]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= 650_000) return url;
    }
    return null;
  } catch {
    return null;
  }
}

interface NoteExtras {
  shot?: string;
  /** Where they'd like a reply, if anywhere. Checked with REPLY_EMAIL before this is called. */
  email?: string;
  /** They're a fit tester. Only the fact, never the code. */
  tester?: boolean;
  /** Held on a spot to write it (src/help/pin.ts): where. */
  pin?: Pin;
}

/** Sends the note. `view` is the screen they came from. */
export async function sendNote(note: string, view: string, { shot, email, tester, pin }: NoteExtras = {}): Promise<NoteResult> {
  const reply = email?.trim();
  const body = JSON.stringify({
    note: note.trim(),
    view: view.slice(0, 30),
    version: __APP_VERSION__.slice(0, 40),
    browser: browserFamily(navigator.userAgent, navigator.maxTouchPoints).slice(0, 40),
    ...(shot ? { shot } : {}),
    ...(reply ? { email: reply } : {}),
    ...(tester ? { tester: true } : {}),
    ...(pin ? { pin } : {}),
  });
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    return res.ok ? 'sent' : res.status === 429 ? 'limit' : res.status === 503 ? 'busy' : 'failed';
  } catch {
    return 'failed';
  }
}
