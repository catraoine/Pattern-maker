// Projecting a pattern straight onto fabric. A projector is rarely square over the table, so the person drags
// four corners onto a cutting mat's grid once; a perspective map (a homography) then draws every piece at
// true size on the mat, however the projector leans.
import type { P } from './geometry';

/** A 3 × 3 perspective map, row by row, with the last entry 1. */
type Homography = [number, number, number, number, number, number, number, number, number];

/** Solve A·x = b by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | undefined {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (Math.abs(m[piv][c]) < 1e-12) return undefined;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** The perspective map that carries four points onto four others, or undefined when three of them line up. */
export function homography(from: P[], to: P[]): Homography | undefined {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return h ? ([...h, 1] as Homography) : undefined;
}

export function apply(h: Homography, q: P): P {
  const w = h[6] * q.x + h[7] * q.y + h[8];
  return { x: (h[0] * q.x + h[1] * q.y + h[2]) / w, y: (h[3] * q.x + h[4] * q.y + h[5]) / w };
}

export function invert(h: Homography): Homography {
  const [a, b, c, d, e, f, g, k, i] = h;
  const A = e * i - f * k, B = -(d * i - f * g), C = d * k - e * g;
  const det = a * A + b * B + c * C;
  const inv = [A, -(b * i - c * k), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * k - b * g), a * e - b * d].map((v) => v / det);
  return inv.map((v) => v / inv[8]) as Homography;
}

/**
 * The perspective map near one point, as a plain SVG matrix: how 1 cm across and 1 cm down land on the screen
 * there. Text and arrowheads are small enough to draw with it; long lines are mapped point by point instead.
 */
export function localMatrix(map: (q: P) => P, q: P): string {
  const d = 0.01;
  const at = map(q);
  const x = map({ x: q.x + d, y: q.y });
  const y = map({ x: q.x, y: q.y + d });
  const f = [(x.x - at.x) / d, (x.y - at.y) / d, (y.x - at.x) / d, (y.y - at.y) / d, at.x, at.y];
  return `matrix(${f.map((v) => +v.toFixed(4)).join(' ')})`;
}

/** Screen pixels to the cm near a point of the mat: for line widths that read true on the cloth. */
export function pxPerCm(map: (q: P) => P, q: P): number {
  const at = map(q);
  const x = map({ x: q.x + 1, y: q.y });
  const y = map({ x: q.x, y: q.y + 1 });
  return (Math.hypot(x.x - at.x, x.y - at.y) + Math.hypot(y.x - at.x, y.y - at.y)) / 2;
}

/** Whether four corners make a shape the map can use: every turn the same way round, so no corner crosses over. */
export function convex(q: P[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = [q[i], q[(i + 1) % 4], q[(i + 2) % 4]];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
}

/** A line-up: where the mat's grid corners sit on the screen, and the grid's size in cm. */
export interface LineUp {
  /** Screen points (CSS px) of the mat corners: top left, top right, bottom right, bottom left. */
  corners: P[];
  /** The marked grid on the mat, in cm. */
  mat: { w: number; h: number };
  /** The screen it was made on, so a different screen asks again. */
  screen: string;
}

/** The map from mat cm onto the screen, for a line-up. */
export function matToScreen(l: Pick<LineUp, 'corners' | 'mat'>): Homography | undefined {
  const { w, h } = l.mat;
  return homography(
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    l.corners,
  );
}

/** Corners for a first line-up: a mat-shaped box in the middle of the screen. */
export function startCorners(screenW: number, screenH: number, mat: { w: number; h: number }): P[] {
  const scale = Math.min((screenW * 0.7) / mat.w, (screenH * 0.7) / mat.h);
  const w = mat.w * scale, h = mat.h * scale;
  const x = (screenW - w) / 2, y = (screenH - h) / 2;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

const KEY = 'pattern-maker:projector';

export function loadLineUp(screen: string): LineUp | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const l = JSON.parse(raw) as LineUp;
    return l.screen === screen && l.corners?.length === 4 && l.mat?.w > 0 && l.mat?.h > 0 && convex(l.corners) ? l : undefined;
  } catch {
    return undefined;
  }
}

export function saveLineUp(l: LineUp): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    // Without storage it is asked for again next time; projecting still works now.
  }
}

/** Where a piece lies on the mat: its middle, how far it is turned (degrees clockwise) and whether it is flipped. */
export interface Placement {
  at: P;
  turn: number;
  flip: boolean;
}

/** Points from the piece's own drawing into mat cm, about the piece's middle `mid`. */
export function placePoint(q: P, mid: P, pl: Placement): P {
  const x = (q.x - mid.x) * (pl.flip ? -1 : 1);
  const y = q.y - mid.y;
  const r = (pl.turn * Math.PI) / 180;
  return { x: pl.at.x + x * Math.cos(r) - y * Math.sin(r), y: pl.at.y + x * Math.sin(r) + y * Math.cos(r) };
}

/** Line weights on the cloth, in cm: what a sewist sees and cuts along. */
export const LINE_CM = { thin: 0.1, medium: 0.2, thick: 0.3 } as const;
export type LineWeight = keyof typeof LINE_CM;
