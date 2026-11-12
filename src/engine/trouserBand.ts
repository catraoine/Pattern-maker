// A low-rise trouser's waistband cut curved (SS27 Look 08, the Chocolate Barrel Trouser, Nov 11: the fit-test trouser).
// Slung low, the band sits on the slope between waist and hip, which is smaller at its top edge than where it is sewn;
// cut straight it stands off the body at the top. Cut as an arc, its lower edge the trousers' waist seam and its upper
// edge the shorter round WAISTBAND_CM higher, it lies on the body. It is not folded: an outer band and a facing.
import { Path, P, add, mul, p, sub, unit } from './geometry';
import type { Piece } from './piece';
import { WAISTBAND_CM } from './skirt';

/**
 * The curved band from the waist seam's marks: `L` along the lower edge (with the underlap), `top` the round of the upper
 * edge without it, `marks` the positions along the lower edge with their names.
 */
export function curvedTrouserBand(L: number, waist: number, top: number, underlap: number, marks: [number, string][], sa: number): Piece {
  const W = WAISTBAND_CM;
  // The underlap runs on straight past the centre front, so only the body's part of the band is shortened at the top.
  const T = (top / waist) * (L - underlap) + underlap;
  const theta = (L - T) / W;
  const Ro = L / theta;
  const Ri = Ro - W;
  const at = (rad: number, s: number) => {
    const phi = s / rad - theta / 2;
    return p(Ro - rad * Math.cos(phi), rad * Math.sin(phi) + Ro * Math.sin(theta / 2));
  };
  // A point on the upper edge matching one on the lower: the same share along the body's part of the band.
  const up = (s: number) => (s <= L - underlap ? (s * (T - underlap)) / (L - underlap) : T - (L - s));
  const N = 64;
  const lower = Array.from({ length: N + 1 }, (_, i) => at(Ro, (L * i) / N));
  const upper = Array.from({ length: N + 1 }, (_, i) => at(Ri, up((L * (N - i)) / N)));
  const outline = new Path(lower[0]);
  for (const q of lower.slice(1)) outline.line(q, 'waist');
  outline.line(upper[0], 'end');
  for (const q of upper.slice(1)) outline.line(q, 'band');
  outline.line(lower[0], 'end');
  outline.closed = true;
  const notches: [P, P][] = marks
    .filter(([s]) => s > 0)
    .flatMap(([s]): [P, P][] => {
      const a = at(Ro, s);
      const b = at(Ri, up(s));
      const out = unit(sub(a, b));
      return [
        [a, out],
        [b, mul(out, -1)],
      ];
    });
  const tag = (s: number, text: string) => ({ at: at(Ro - W * 0.75, s), text, size: 0.55, rotate: 90 });
  const cut = 'Cut 2 (band and facing) + interfacing';
  return {
    name: 'Waistband',
    kind: 'waistband',
    outline,
    lines: [],
    grain: [add(at(Ro - W / 2, L / 2), p(0, -4)), add(at(Ro - W / 2, L / 2), p(0, 4))],
    notches,
    labels: [
      { at: at(Ro - W / 2, L * 0.4), text: 'WAISTBAND, CURVED', size: 0.8, rotate: 90 },
      { at: at(Ro - W / 2, L * 0.6), text: cut, size: 0.5, rotate: 90 },
      ...marks.filter(([, t]) => t).map(([s, t]) => tag(s + 2.6, t)),
      ...(underlap ? [tag(L - underlap + 0.3, 'UNDERLAP')] : []),
    ],
    cut,
    fabric: 'Self + interfacing',
    seamAllowance: sa,
    allowances: {},
    meta: { finishedWidth: W, lengthCm: Math.round(L * 10) / 10, topCm: Math.round(T * 10) / 10, curved: true },
  };
}
