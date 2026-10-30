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

/** What the projector is lined up on: a cutting mat's grid, or one sheet of printer paper (C1 Paper line-up, Cat
 *  applied 2026-10-30), whose size is known to the millimetre, so no mat is needed. */
export type Ref = 'mat' | 'a4' | 'letter';

/** Printer paper, held upright, in cm. */
export const PAPER = { a4: { w: 21, h: 29.7 }, letter: { w: 21.59, h: 27.94 } } as const;

/** A line-up: where the mat's grid corners (or the paper's corners) sit on the screen, and that size in cm. */
export interface LineUp {
  /** Screen points (CSS px) of the corners: top left, top right, bottom right, bottom left. */
  corners: P[];
  /** The marked grid on the mat, or the sheet of paper, in cm. */
  mat: { w: number; h: number };
  /** The screen it was made on, so a different screen asks again. */
  screen: string;
  /** What it was lined up on; a line-up saved before paper existed was on a mat. */
  ref?: Ref;
}

/** The paper's size the way it lies on the table: turned sideways when the dragged corners are wider than tall. */
export function paperSize(ref: Exclude<Ref, 'mat'>, corners: P[]): { w: number; h: number } {
  const d = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);
  const across = d(corners[0], corners[1]) + d(corners[3], corners[2]);
  const down = d(corners[0], corners[3]) + d(corners[1], corners[2]);
  const { w, h } = PAPER[ref];
  return across > down ? { w: h, h: w } : { w, h };
}

/**
 * The part of the mat's plane that the screen shows, in cm, for a check grid over the whole table (C2, Cat applied
 * 2026-10-30): the screen's corners taken back onto the mat, kept within `reach` cm of it, so a steep lean never
 * stretches the grid out to the horizon.
 */
export function onScreenArea(h: Homography, screenW: number, screenH: number, mat: { w: number; h: number }, reach = 150) {
  const back = invert(h);
  const seen = [
    { x: 0, y: 0 },
    { x: screenW, y: 0 },
    { x: screenW, y: screenH },
    { x: 0, y: screenH },
  ]
    .filter((q) => back[6] * q.x + back[7] * q.y + back[8] > 0)
    .map((q) => apply(back, q));
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  if (seen.length < 4) return { x0: -reach, y0: -reach, x1: mat.w + reach, y1: mat.h + reach };
  return {
    x0: clamp(Math.min(...seen.map((q) => q.x)), -reach, 0),
    y0: clamp(Math.min(...seen.map((q) => q.y)), -reach, 0),
    x1: clamp(Math.max(...seen.map((q) => q.x)), mat.w, mat.w + reach),
    y1: clamp(Math.max(...seen.map((q) => q.y)), mat.h, mat.h + reach),
  };
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

/** Corners for a first line-up: a mat-shaped box in the middle of the screen, or of the free area when the line-up
 *  panel takes a side of it (a phone held upright or turned sideways). */
export function startCorners(
  screenW: number,
  screenH: number,
  mat: { w: number; h: number },
  free = { left: 0, top: 0, right: screenW, bottom: screenH },
  fill = 0.7,
): P[] {
  const fw = free.right - free.left, fh = free.bottom - free.top;
  const scale = Math.min((fw * fill) / mat.w, (fh * fill) / mat.h);
  const w = mat.w * scale, h = mat.h * scale;
  const x = free.left + (fw - w) / 2, y = free.top + (fh - h) / 2;
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

/** The kinds of line that can be shown or hidden on the cloth (L1 Layers panel, Cat applied 2026-10-30). */
export const LAYERS = ['cut', 'stitch', 'inner', 'notches', 'grain', 'labels'] as const;
export type Layer = (typeof LAYERS)[number];

/** Line colours that read on different cloth (L3, Cat applied 2026-10-30): yellow and green show best on prints. */
export const INKS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Yellow', hex: '#ffe14a' },
  { name: 'Green', hex: '#4cff7a' },
  { name: 'Blue', hex: '#4ad8ff' },
  { name: 'Pink', hex: '#ff5ad1' },
] as const;

/** How the lines look on the cloth: their thickness in mm, which kinds show, their colour, and a dim grey ground. */
export interface Look {
  mm: number;
  show: Record<Layer, boolean>;
  ink: string;
  dim: boolean;
}

export const LINE_MM = { min: 1, max: 6 } as const;
export const START_LOOK: Look = { mm: 3, show: { cut: true, stitch: true, inner: true, notches: true, grain: true, labels: true }, ink: '#ffffff', dim: false };

const LOOK_KEY = 'pattern-maker:projector-look';

export function loadLook(): Look {
  try {
    const l = JSON.parse(localStorage.getItem(LOOK_KEY) ?? 'null') as Partial<Look> | null;
    if (!l) return START_LOOK;
    const mm = typeof l.mm === 'number' && l.mm >= LINE_MM.min && l.mm <= LINE_MM.max ? l.mm : START_LOOK.mm;
    const show = { ...START_LOOK.show };
    for (const k of LAYERS) if (typeof l.show?.[k] === 'boolean') show[k] = l.show[k];
    const ink = INKS.some((i) => i.hex === l.ink) ? l.ink! : START_LOOK.ink;
    return { mm, show, ink, dim: l.dim === true };
  } catch {
    return START_LOOK;
  }
}

export function saveLook(l: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(l));
  } catch {
    // Kept for this time only.
  }
}

/**
 * Where the loupe's round lens sits (M2, Cat applied 2026-10-30): beside the spot it magnifies, to the right when it
 * fits and to the left when not, kept on the screen and above the tools.
 */
export function lensAt(target: P, r: number, zoom: number, screenW: number, screenH: number, bottom = 0): P {
  const gap = r + r / zoom + 24;
  const x = target.x + gap + r <= screenW ? target.x + gap : target.x - gap;
  const lo = r + 8, hi = screenH - bottom - r - 8;
  return { x: Math.min(screenW - r - 8, Math.max(r + 8, x)), y: hi < lo ? screenH / 2 : Math.min(hi, Math.max(lo, target.y)) };
}
