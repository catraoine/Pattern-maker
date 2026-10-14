// Pattern quality checks, the way a pattern cutter walks a pattern before it is cut: seams that join
// are the same length, curves blend across seams, centre lines are square and dart legs are trued.
import { P, len, sub, taggedLength } from './geometry';
import { dartsOf } from './marks';
import { Piece } from './piece';

export interface Check {
  group: 'Seams' | 'Corners' | 'Darts';
  label: string;
  detail: string;
  ok: boolean;
}

/** Seams walked to within 1 mm, corners to within a degree (two where curves meet across a seam). */
export const SEAM_TOLERANCE = 0.1;
const SQUARE_TOLERANCE = 1;
const BLEND_TOLERANCE = 2;

const cm = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)} cm`;
const deg = (v: number) => `${Math.round(v * 10) / 10}°`;

interface Corner {
  a: string;
  b: string;
  angle: number; // interior angle in degrees
}

/** Interior angle at every point where one edge tag gives way to another. */
export function corners(pc: Piece): Corner[] {
  let { pts, tags } = pc.outline.taggedPoints(256);
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  // Drop zero-length edges so every direction is well defined.
  const P2: P[] = [];
  const T2: string[] = [];
  pts.forEach((q, i) => {
    const next = pts[(i + 1) % pts.length];
    if (len(sub(next, q)) > 1e-6) {
      P2.push(q);
      T2.push(tags[i] ?? tags[tags.length - 1]);
    }
  });
  const n = P2.length;
  const turn = (i: number) => {
    const d1 = sub(P2[i], P2[(i - 1 + n) % n]);
    const d2 = sub(P2[(i + 1) % n], P2[i]);
    return Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y);
  };
  let total = 0;
  for (let i = 0; i < n; i++) total += turn(i);
  const sgn = Math.sign(total) || 1;
  const out: Corner[] = [];
  for (let i = 0; i < n; i++) {
    const a = T2[(i - 1 + n) % n];
    const b = T2[i];
    if (a !== b) out.push({ a, b, angle: 180 - (sgn * turn(i) * 180) / Math.PI });
  }
  return out;
}

const NAMES: Record<string, string> = {
  waist: 'waist',
  hem: 'hem',
  side: 'side seam',
  shoulder: 'shoulder',
  neck: 'neckline',
  armhole: 'armhole',
};

const isFront = (pc: Piece) => /front/i.test(pc.name);
const isBack = (pc: Piece) => /back/i.test(pc.name);

/** Run every check that applies to a set of pieces. Front and back pieces are paired by name. */
export function checkPattern(pieces: Piece[], opts: { finishedWaist?: number } = {}): Check[] {
  const checks: Check[] = [];
  const front = pieces.find(isFront);
  const back = pieces.find(isBack);

  if (front && back) {
    // Seams that sew together.
    for (const seam of ['side', 'shoulder']) {
      const f = taggedLength(front.outline, seam);
      const b = taggedLength(back.outline, seam);
      if (!f || !b) continue;
      if (seam === 'shoulder') {
        // The back shoulder is drafted 1 cm longer and eased in over the shoulder blade.
        const ease = b - f;
        checks.push({
          group: 'Seams',
          label: 'Shoulder seams',
          detail: `front ${cm(f)}, back ${cm(b)}: ${cm(ease)} of back shoulder ease, as drafted`,
          ok: Math.abs(ease - 1) <= SEAM_TOLERANCE,
        });
      } else {
        checks.push({
          group: 'Seams',
          label: 'Side seams',
          detail: `front ${cm(f)}, back ${cm(b)}, ${Math.abs(f - b) < 0.05 ? 'identical' : `${cm(Math.abs(f - b))} apart`}`,
          ok: Math.abs(f - b) <= SEAM_TOLERANCE,
        });
      }
      // Curves meeting across the seam must blend: the two corners add up to a straight line.
      const fc = corners(front).filter((c) => (c.a === seam || c.b === seam) && c.a !== 'dart' && c.b !== 'dart');
      for (const c of fc) {
        const other = c.a === seam ? c.b : c.a;
        const bc = corners(back).find((k) => (k.a === seam && k.b === other) || (k.b === seam && k.a === other));
        if (!bc || !NAMES[other]) continue;
        const sum = c.angle + bc.angle;
        checks.push({
          group: 'Corners',
          label: `${cap(NAMES[other])} blends across the ${NAMES[seam]}`,
          detail: `front ${deg(c.angle)} + back ${deg(bc.angle)} = ${deg(sum)}`,
          ok: Math.abs(sum - 180) <= BLEND_TOLERANCE,
        });
      }
    }
    if (opts.finishedWaist) {
      // Two of each piece (a pair, or a piece cut on the fold that is half the front).
      const seam = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
      checks.push({
        group: 'Seams',
        label: 'Waist seam to waistband',
        detail: `${cm(seam)} with darts closed, band ${cm(opts.finishedWaist)}`,
        ok: Math.abs(seam - opts.finishedWaist) <= 1,
      });
    }
  }

  // Centre lines are square to the edges that cross them, so the piece mirrors without a point or dip.
  for (const pc of pieces) {
    const where = isFront(pc) ? 'centre front' : 'centre back';
    for (const c of corners(pc)) {
      const centre = ['fold', 'centre'].includes(c.a) ? c.b : ['fold', 'centre'].includes(c.b) ? c.a : '';
      if (!centre || !NAMES[centre]) continue;
      checks.push({
        group: 'Corners',
        label: `${cap(NAMES[centre])} square at ${where}`,
        detail: deg(c.angle),
        ok: Math.abs(c.angle - 90) <= SQUARE_TOLERANCE,
      });
    }
    dartsOf(pc).forEach((d, i, all) => {
      const l1 = len(sub(d.near, d.tip));
      const l2 = len(sub(d.far, d.tip));
      checks.push({
        group: 'Darts',
        label: `${pc.name}${all.length > 1 ? ` dart ${i + 1}` : ' dart'} legs trued`,
        detail: `${cm(l1)} and ${cm(l2)}`,
        ok: Math.abs(l1 - l2) <= SEAM_TOLERANCE / 2,
      });
    });
  }
  return checks;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export interface FinishedRow {
  label: string;
  body?: number;
  ease?: number;
  finished: number;
}
