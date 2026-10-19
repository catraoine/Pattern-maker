// Send my work to another device (Cat, 2026-10-19): everything the app keeps on this device, packed into a link
// the sewist sends themselves (email, AirDrop, Messages) and opens on their computer, so they can measure on the
// phone and print on the laptop. Like the measure-me links it all travels after the #, which browsers never send
// to a server. Packed with the browser's own deflate where there is one, so a few saved patterns still fit a link.
import { readBackup, type Backup } from './account';

const MOVE = 'move=';

const toB64 = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const packs = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** The link that carries this backup to another device. "z." is deflated, "p." plain for browsers without it. */
export async function moveLink<S>(origin: string, backup: Backup<S>) {
  const bytes = new TextEncoder().encode(JSON.stringify(backup));
  const body = packs() ? `z.${toB64(await through(bytes, new CompressionStream('deflate-raw')))}` : `p.${toB64(bytes)}`;
  return `${origin}/#${MOVE}${body}`;
}

export const isMoveLink = (hash: string) => hash.replace(/^#/, '').startsWith(MOVE);

/** Read a move link's #part: the backup, 'broken' for a cut-off or damaged link, or null for any other #. */
export async function readMoveLink<S extends object>(hash: string): Promise<Backup<S> | 'broken' | null> {
  const h = hash.replace(/^#/, '');
  if (!h.startsWith(MOVE)) return null;
  const body = h.slice(MOVE.length);
  try {
    const kind = body.slice(0, 2);
    if (kind !== 'z.' && kind !== 'p.') return 'broken';
    if (kind === 'z.' && !packs()) return 'broken';
    let bytes = fromB64(body.slice(2));
    if (kind === 'z.') bytes = await through(bytes, new DecompressionStream('deflate-raw'));
    return readBackup<S>(new TextDecoder().decode(bytes)) ?? 'broken';
  } catch {
    return 'broken';
  }
}
