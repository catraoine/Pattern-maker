import { describe, expect, it } from 'vitest';
import { Path, len, p, sub } from './geometry';
import type { Piece } from './piece';
import { straightSidePair } from './straightSides';

// A plain half front and half back: the front side bows out for the bust and bends at the waist, the back side is
// nearly straight, and each hem squares off from its side for a few centimetres before running to the centre.
const piece = (name: string, side: [number, number][], hemY: number): Piece => {
  const out = new Path(p(0, 0)).line(p(20, 0), 'shoulder').line(p(30, 25), 'armhole');
  for (const [x, y] of side) out.line(p(x, y), 'side');
  const corner = side[side.length - 1];
  out.line(p(corner[0] - 4, corner[1]), 'hem').line(p(0, hemY), 'hem').line(p(0, 0), 'fold');
  out.closed = true;
  return { name, outline: out, lines: [], notches: [[p(31.2, 40), p(1, 0)]], labels: [], cut: 'Cut 1', seamAllowance: 1.5, allowances: {}, meta: {} };
};

describe('vest sides as one straight line', () => {
  const front = piece('Jacket front', [[33, 35], [31, 45], [33, 75]], 74);
  const back = piece('Jacket back', [[31, 40], [32, 75.5]], 75.5);
  const [f, b] = straightSidePair(front, back);
  const sides = (pc: Piece) => pc.outline.segs.filter((_, i) => pc.outline.tags[i] === 'side');
  const sideLength = (pc: Piece) => {
    const i = pc.outline.tags.indexOf('side');
    return len(sub(pc.outline.segs[i].to, pc.outline.segs[i - 1].to));
  };

  it('draws each side seam as a single straight line from the underarm', () => {
    for (const pc of [f, b]) {
      expect(sides(pc)).toHaveLength(1);
      expect(sides(pc)[0].kind).toBe('L');
    }
  });

  it('lets the shorter side down so front and back sew together end to end', () => {
    expect(Math.abs(sideLength(f) - sideLength(b))).toBeLessThan(0.01);
    // The longer piece keeps its hem corner where it was.
    expect(b.outline.segs[b.outline.tags.indexOf('side')].to).toEqual(p(32, 75.5));
  });

  it('keeps the hem square at the corner instead of hooking below it', () => {
    const i = f.outline.tags.indexOf('side');
    const corner = f.outline.segs[i].to;
    const squared = f.outline.segs[i + 1].to;
    expect(Math.abs(squared.y - corner.y)).toBeLessThan(0.01);
  });

  it('keeps the side notch on the new line', () => {
    const [[q]] = f.notches;
    const i = f.outline.tags.indexOf('side');
    const a = f.outline.segs[i - 1].to;
    const c = f.outline.segs[i].to;
    const cross = (q.x - a.x) * (c.y - a.y) - (q.y - a.y) * (c.x - a.x);
    expect(Math.abs(cross) / len(sub(c, a))).toBeLessThan(0.01);
  });
});
