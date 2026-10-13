// Minimal 2D geometry for pattern drafting. Units are centimetres, y points down.

export interface P {
  x: number;
  y: number;
}

export const p = (x: number, y: number): P => ({ x, y });
export const add = (a: P, b: P): P => p(a.x + b.x, a.y + b.y);
export const sub = (a: P, b: P): P => p(a.x - b.x, a.y - b.y);
export const mul = (a: P, k: number): P => p(a.x * k, a.y * k);
export const len = (a: P): number => Math.hypot(a.x, a.y);
export const unit = (a: P): P => {
  const n = len(a) || 1;
  return p(a.x / n, a.y / n);
};
export const lerp = (a: P, b: P, t: number): P => add(a, mul(sub(b, a), t));

type Seg = { kind: 'L'; to: P } | { kind: 'C'; c1: P; c2: P; to: P };

/** A path made of line and cubic Bezier segments. Each segment carries a tag such as "waist" or "hem". */
export class Path {
  segs: Seg[] = [];
  tags: string[] = [];
  closed = false;

  constructor(public start: P) {}

  get end(): P {
    return this.segs.length ? this.segs[this.segs.length - 1].to : this.start;
  }

  line(to: P, tag = ''): this {
    this.segs.push({ kind: 'L', to });
    this.tags.push(tag);
    return this;
  }

  curve(c1: P, c2: P, to: P, tag = ''): this {
    this.segs.push({ kind: 'C', c1, c2, to });
    this.tags.push(tag);
    return this;
  }

  /** Flatten into a polyline; tags[i] labels the edge pts[i] -> pts[i+1]. */
  taggedPoints(steps = 24): { pts: P[]; tags: string[] } {
    const pts = [this.start];
    const tags: string[] = [];
    let cur = this.start;
    this.segs.forEach((s, i) => {
      const tag = this.tags[i];
      if (s.kind === 'L') {
        pts.push(s.to);
        tags.push(tag);
      } else {
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          const mt = 1 - t;
          pts.push(
            p(
              mt ** 3 * cur.x + 3 * mt ** 2 * t * s.c1.x + 3 * mt * t ** 2 * s.c2.x + t ** 3 * s.to.x,
              mt ** 3 * cur.y + 3 * mt ** 2 * t * s.c1.y + 3 * mt * t ** 2 * s.c2.y + t ** 3 * s.to.y,
            ),
          );
          tags.push(tag);
        }
      }
      cur = s.to;
    });
    return { pts, tags };
  }

  points(steps = 24): P[] {
    return this.taggedPoints(steps).pts;
  }

  length(): number {
    const pts = this.points(48);
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += len(sub(pts[i], pts[i - 1]));
    return total;
  }
}

/** Length of the part of a path whose segments carry `tag`. */
export function taggedLength(path: Path, tag: string): number {
  const { pts, tags } = path.taggedPoints(48);
  let total = 0;
  tags.forEach((t, i) => {
    if (t === tag) total += len(sub(pts[i + 1], pts[i]));
  });
  return total;
}

function intersect(a: P, u: P, b: P, v: P): P | null {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.x - a.x) * v.y - (b.y - a.y) * v.x) / den;
  return add(a, mul(u, t));
}

/** Offset a closed polygon outward. dists gives one distance per edge (edge i runs pts[i] -> pts[i+1]);
 * corners are mitred, very sharp ones bevelled. */
export function offsetPolygon(pts: P[], dists: number[] | number): P[] {
  const n0 = pts.length;
  const d = Array.isArray(dists) ? dists : new Array(n0).fill(dists);
  const clean: P[] = [];
  const cd: number[] = [];
  pts.forEach((pt, i) => {
    const q = pts[(i + 1) % n0];
    if (len(sub(q, pt)) > 1e-4) {
      clean.push(pt);
      cd.push(d[i % d.length]);
    }
  });
  const n = clean.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = clean[i];
    const b = clean[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area > 0 ? 1 : -1;
  const normal = (a: P, b: P): P => {
    const u = unit(sub(b, a));
    return mul(p(-u.y, u.x), -sign);
  };
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = clean[(i - 1 + n) % n];
    const b = clean[i];
    const c = clean[(i + 1) % n];
    const d1 = cd[(i - 1 + n) % n];
    const d2 = cd[i];
    const p1 = add(b, mul(normal(a, b), d1));
    const p2 = add(b, mul(normal(b, c), d2));
    const x = intersect(p1, unit(sub(b, a)), p2, unit(sub(c, b)));
    if (x === null || len(sub(x, b)) > 3 * Math.max(d1, d2, 0.1)) {
      out.push(p1);
      if (len(sub(p2, p1)) > 1e-6) out.push(p2);
    } else {
      out.push(x);
    }
  }
  return out;
}
