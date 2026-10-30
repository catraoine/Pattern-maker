// A tie sash and belt loops for a dress or a skirt: a folded sash that wraps the waist and knots, in
// two halves joined at the centre back; and narrow loops tacked on at the waist to hold it, or to carry
// a belt of your own. Plain ASCII punctuation (see instructions.ts).
import { Path, p } from './geometry';
import { pathOf } from './manipulate';
import type { Piece } from './piece';
import type { SewingGuide, SewStep } from './instructions';

export type Belt = 'none' | 'sash' | 'sash_loops' | 'loops' | 'band';
export const BELTS: [Belt, string][] = [
  ['none', 'None'],
  ['sash', 'Tie sash'],
  ['sash_loops', 'Sash in loops'],
  ['loops', 'Belt loops'],
  ['band', 'Self band'],
];
/** A skirt's belts: the self band is the dress's own, belted at its seam. */
export const SKIRT_BELTS = BELTS.filter(([id]) => id !== 'band');

/** A sash 4 cm wide finished, with 55 cm to knot each side of the waist, its ends slanted 4 cm; loops
 * 1 cm wide, standing 1 cm proud of what they hold, each end turned under 1 cm; a belt of your own
 * taken as 3 cm wide. */
export const BELT = {
  sash: { width: 4, tie: 55, slant: 4 },
  /** A flat band of the dress fabric (Cat's gingham dress, 2026-10-30): 4 cm wide, lapping 8 cm at the front and
   * fastened with a buckle of your own, its end slanted 3 cm like the sash's. */
  band: { width: 4, lap: 8, point: 3 },
  loop: { width: 1, ease: 1, turn: 1, own: 3 },
};

export interface BeltDraft {
  kind: Exclude<Belt, 'none'>;
  /** The sash's whole length end to end, and its finished width. */
  sash?: { lengthCm: number; widthCm: number };
  /** A self band: its length end to end, pointed end and lap included, and its finished width. */
  band?: { lengthCm: number; widthCm: number };
  /** How many loops, each cut this long, and the width of what they hold. */
  loops?: { count: number; cutCm: number; holdsCm: number };
}

/** Which garments take a belt: not a wrap, which ties already, and no loops on a pull-on elastic waist,
 * where they would stop it stretching. */
export function beltAllowed(belt: Belt, g: { wrap?: boolean; elastic?: boolean }): boolean {
  if (belt === 'none') return true;
  if (g.wrap) return false;
  return belt === 'sash' || !g.elastic;
}

/** The sash and loops for a finished waist in cm. */
export function beltOf(belt: Belt | undefined, waistCm: number): BeltDraft | undefined {
  if (!belt || belt === 'none') return undefined;
  const r = (v: number) => Math.round(v * 10) / 10;
  if (belt === 'band') {
    const w = BELT.band.width;
    return {
      kind: belt,
      band: { lengthCm: r(waistCm + BELT.band.lap + BELT.band.point), widthCm: w },
      loops: { count: 2, cutCm: w + BELT.loop.ease + 2 * BELT.loop.turn, holdsCm: w },
    };
  }
  const sashed = belt !== 'loops';
  const holds = sashed ? BELT.sash.width : BELT.loop.own;
  return {
    kind: belt,
    sash: sashed ? { lengthCm: r(waistCm + 2 * BELT.sash.tie), widthCm: BELT.sash.width } : undefined,
    loops: belt === 'sash' ? undefined : { count: sashed ? 2 : 4, cutCm: holds + BELT.loop.ease + 2 * BELT.loop.turn, holdsCm: holds },
  };
}

/** The pieces: half the sash (cut as a pair, joined at the centre back) and one strip for the loops. */
export function beltPieces(b: BeltDraft | undefined, sa: number): Piece[] {
  if (!b) return [];
  const out: Piece[] = [];
  if (b.sash) {
    const L = b.sash.lengthCm / 2;
    const h = 2 * b.sash.widthCm;
    const s = BELT.sash.slant;
    const cut = 'Cut 2 (1 pair)';
    out.push({
      name: 'Sash',
      kind: 'band',
      // From the centre back join along the bottom edge to the slanted end, and back along the top.
      outline: pathOf({ pts: [p(0, 0), p(L, 0), p(L - s, -h), p(0, -h)], tags: ['edge', 'edge', 'edge', 'centre'] }),
      lines: [new Path(p(0.5, -h / 2)).line(p(L - s / 2 - 0.5, -h / 2))],
      grain: [p(L * 0.3 - 4, -h * 0.3), p(L * 0.3 + 4, -h * 0.3)],
      notches: [],
      labels: [
        { at: p(L * 0.45, -h * 0.68), text: 'SASH', size: 0.7 },
        { at: p(L * 0.45, -h * 0.18), text: cut, size: 0.5 },
        { at: p(2.5, -h / 2 - 0.3), text: 'FOLD', size: 0.45 },
        { at: p(1.2, -0.6), text: 'CENTRE BACK', size: 0.4 },
      ],
      cut,
      fabric: 'Self',
      seamAllowance: sa,
      allowances: { edge: 1, centre: 1 },
      meta: { sash: true },
    });
  }
  if (b.band) {
    // Cut on the fold along its length: the long edge at y = 0 is the fold, the point at the far end.
    const L = b.band.lengthCm;
    const h = b.band.widthCm;
    const pt = BELT.band.point;
    const cut = 'Cut 1 on the lengthwise fold';
    out.push({
      name: 'Self band',
      kind: 'band',
      outline: pathOf({ pts: [p(0, 0), p(L - pt, 0), p(L, -h), p(0, -h)], tags: ['fold', 'edge', 'edge', 'edge'] }),
      lines: [],
      grain: [p(L * 0.3 - 4, -h * 0.4), p(L * 0.3 + 4, -h * 0.4)],
      notches: [],
      labels: [
        { at: p(L * 0.45, -h * 0.68), text: 'SELF BAND', size: 0.7 },
        { at: p(L * 0.45, -h * 0.25), text: cut, size: 0.45 },
        { at: p(2.5, -0.6), text: 'FOLD', size: 0.45 },
      ],
      cut,
      fabric: 'Self',
      seamAllowance: sa,
      allowances: { fold: 0, edge: 1 },
      meta: { band: true },
    });
  }
  if (b.loops) {
    const L = b.loops.count * b.loops.cutCm;
    const w = 4 * BELT.loop.width;
    const cut = 'Cut 1';
    const lines = Array.from({ length: b.loops.count - 1 }, (_, i) => new Path(p((i + 1) * b.loops!.cutCm, -w + 0.4)).line(p((i + 1) * b.loops!.cutCm, -0.4)));
    out.push({
      name: 'Belt loops',
      kind: 'band',
      outline: pathOf({ pts: [p(0, 0), p(L, 0), p(L, -w), p(0, -w)], tags: ['edge', 'edge', 'edge', 'edge'] }),
      lines,
      grain: [p(L / 2 - 3, -w * 0.25), p(L / 2 + 3, -w * 0.25)],
      notches: [],
      labels: [
        { at: p(L / 2, -w * 0.62), text: 'BELT LOOPS', size: 0.5 },
        { at: p(Math.min(L / 2, 6), -w * 0.62), text: cut, size: 0.4 },
      ],
      cut,
      fabric: 'Self',
      // The folds are in the width: no allowance.
      seamAllowance: 0,
      allowances: { edge: 0 },
      meta: { loops: b.loops.count },
    });
  }
  return out;
}

/** The pattern note. */
export function beltNote(b: BeltDraft): string {
  const sash = b.sash
    ? `A tie sash ${b.sash.lengthCm} cm long and ${b.sash.widthCm} cm wide, in two halves joined at the centre back`
    : b.band
      ? `A self band ${b.band.lengthCm} cm long and ${b.band.widthCm} cm wide, for a ${b.band.widthCm} cm buckle of your own`
      : '';
  const loops = b.loops ? `${b.loops.count} belt loops${b.sash || b.band ? ' at the side seams to hold it' : ` for a belt up to ${b.loops.holdsCm} cm wide`}` : '';
  return `${[sash, loops].filter(Boolean).join(', and ')}.`;
}

/**
 * The guide with the belt added: cutting words, making the sash and the loops, and tacking the loops
 * on at the waist before the final press. `at` says where the loops sit: on a waistband, or across the
 * waist (or a dress's waist seam).
 */
export function withBelt(g: SewingGuide, b: BeltDraft | undefined, o: { band: boolean; sideZip?: boolean }): SewingGuide {
  if (!b) return g;
  const steps = [...g.steps];
  const ci = steps.findIndex((s) => s.title === 'Cut out');
  const cutWords = [b.sash && 'Cut the two sash halves as a pair.', b.band && 'Cut the self band once, its FOLD edge on a lengthwise fold.', b.loops && 'Cut the belt loop strip once, along the grain.'].filter(Boolean).join(' ');
  if (ci >= 0) steps[ci] = { ...steps[ci], text: `${steps[ci].text} ${cutWords}` };
  const added: SewStep[] = [];
  if (b.loops) {
    const where = b.sash || b.band
      ? `one at each side seam${o.sideZip ? ' (the one on the zip side just behind the zip, so it opens freely)' : ''}`
      : 'two on the front and two on the back, each halfway between the centre and the side seam';
    const height = o.band ? 'its top end at the top of the waistband and its lower end just below the band' : 'centred on the waist';
    added.push(
      {
        title: 'Make the belt loops',
        text: `Press the loop strip in half along its length, open it, and press both long edges in to the middle crease. Fold it on the crease again, so it is 1 cm wide, and edgestitch both long edges. Cut it into ${b.loops.count} loops at the marks, each ${b.loops.cutCm} cm.`,
      },
      {
        title: 'Sew on the belt loops',
        text: `Pin on ${b.loops.count} loops, ${where}, ${height}. Turn each end under 1 cm and leave ${BELT.loop.ease} cm of slack, so a ${b.loops.holdsCm} cm ${b.sash ? 'sash' : b.band ? 'band' : 'belt'} slides through. Sew across each end twice, close to the fold, by machine or with small firm hand stitches.`,
      },
    );
  }
  if (b.sash)
    added.push({
      title: 'Make the sash',
      text: `Pin the two sash halves right sides together at their straight CENTRE BACK ends and sew 1 cm from the edge. Press the seam open. Fold the sash in half along its length, right sides together, and sew across the slanted ends and along the long edge 1 cm from it, leaving a 10 cm gap near the centre back seam. Trim the corners, turn it right side out through the gap, press, and slip-stitch the gap closed.`,
    });
  if (b.band)
    added.push({
      title: 'Make the self band',
      text: `Fold the band in half along its FOLD line, right sides together, and sew across the slanted end and along the long edge 1 cm from it, leaving the straight end open. Trim the corner, turn it right side out, press it flat, and edgestitch all round. Thread the straight end through a ${b.band.widthCm} cm buckle, fold it back 4 cm and stitch it down, then make a hole for the prong where the band laps.`,
    });
  const fin = steps.findIndex((s) => s.title === 'Finish');
  steps.splice(fin >= 0 ? fin : steps.length, 0, ...added);
  return { ...g, steps };
}

/** The belt a skirt or dress gets for its choice, or none where it can't take one. */
export const skirtBelt = (belt: Belt | undefined, d: { wrap?: unknown; elastic?: unknown; finishedWaist: number }) =>
  beltAllowed(belt ?? 'none', { wrap: !!d.wrap, elastic: !!d.elastic }) ? beltOf(belt, d.finishedWaist) : undefined;
// A dress is belted at its waist seam, wherever it is: round the seam when it is moved off the waist.
export const dressBelt = (belt: Belt | undefined, d: { bodice: { wrap?: unknown }; finishedWaist: number; seamCm?: number }) =>
  beltAllowed(belt ?? 'none', { wrap: !!d.bodice.wrap }) ? beltOf(belt, d.seamCm ?? d.finishedWaist) : undefined;

/** The belt in a garment's name: "a tie sash", "a sash in loops", "belt loops". */
export const beltWords = (b: Belt) => (b === 'sash' ? 'a tie sash' : b === 'sash_loops' ? 'a sash in loops' : b === 'loops' ? 'belt loops' : b === 'band' ? 'a self band' : '');
