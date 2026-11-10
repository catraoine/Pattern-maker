// The pattern code printed on every pattern, on the cover and in the title block on page 1 (Cat's tester plan, Nov 10 2026): a short code a fit tester types into the
// report form, so each report ties to the exact draft it was sewn from. It reads, in order: the app's build (the first
// four characters of its commit), the hip, bust and high bust it was drafted for (whole cm, "0" where not given), so
// reports can be grouped by body without looking anything up, and four characters standing for the pieces themselves
// (every stitching line to the millimetre), so two prints of the same draft share a code and any change of style,
// finish or measurement gives a new one. Nothing in it names the sewist.
import type { Piece } from './engine/piece';
import type { MeasurementValues } from './measurements';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O or 1/I, which read alike when typed back

/** FNV-1a, 32 bits: a quick fingerprint, not a secret. */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function patternCode(pieces: Piece[], values: MeasurementValues, version: string): string {
  const build = (version.split('+')[1] ?? 'dev').slice(0, 4).toUpperCase();
  const cm = (v: number | undefined) => (v === undefined ? '0' : String(Math.round(v)));
  const lines = pieces.map((pc) => `${pc.name}:${pc.outline.points().map((q) => `${Math.round(q.x * 10)},${Math.round(q.y * 10)}`).join(' ')}`).join('|');
  let h = fnv(lines);
  let tail = '';
  for (let i = 0; i < 4; i++) {
    tail += ALPHABET[h % 32];
    h = Math.floor(h / 32);
  }
  return [build, cm(values.full_hip), cm(values.full_bust), cm(values.high_bust), tail].join('-');
}
