// "Send us a note" from Help & feedback (Cat's H3, Nov 6, 2026): what the sewist wrote, plus the details they'd
// otherwise be asked for (the screen they came from, the app version, the browser), and a screenshot if they add one.
// Never measurements, names or patterns.
import { browserFamily } from '../report/report';

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

/** Sends the note. `view` is the screen they came from. */
export async function sendNote(note: string, view: string, shot?: string): Promise<NoteResult> {
  const body = JSON.stringify({
    note: note.trim(),
    view: view.slice(0, 30),
    version: __APP_VERSION__.slice(0, 40),
    browser: browserFamily(navigator.userAgent, navigator.maxTouchPoints).slice(0, 40),
    ...(shot ? { shot } : {}),
  });
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    return res.ok ? 'sent' : res.status === 429 ? 'limit' : res.status === 503 ? 'busy' : 'failed';
  } catch {
    return 'failed';
  }
}
