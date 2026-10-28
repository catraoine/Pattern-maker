import { describe, expect, it } from 'vitest';
import { apply, convex, homography, invert, localMatrix, matToScreen, placePoint, pxPerCm, startCorners } from './projector';

const mat = { w: 60, h: 45 };
// A projector leaning to one side: the mat lands as a lopsided shape on the screen.
const corners = [
  { x: 250, y: 150 },
  { x: 1035, y: 120 },
  { x: 1090, y: 690 },
  { x: 205, y: 650 },
];

describe('projector line-up', () => {
  it('maps the mat corners onto the dragged corners', () => {
    const h = matToScreen({ corners, mat })!;
    const back = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 45 },
      { x: 0, y: 45 },
    ].map((q) => apply(h, q));
    back.forEach((q, i) => {
      expect(q.x).toBeCloseTo(corners[i].x, 6);
      expect(q.y).toBeCloseTo(corners[i].y, 6);
    });
  });

  it('turns a screen point back into mat cm', () => {
    const h = matToScreen({ corners, mat })!;
    const q = { x: 23.4, y: 17.9 };
    const r = apply(invert(h), apply(h, q));
    expect(r.x).toBeCloseTo(q.x, 6);
    expect(r.y).toBeCloseTo(q.y, 6);
  });

  it('is a plain scale near any point when the projector is square on', () => {
    const h = homography(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
    )!;
    const map = (q: { x: number; y: number }) => apply(h, q);
    expect(localMatrix(map, { x: 5, y: 5 })).toBe('matrix(10 0 0 10 150 150)');
    expect(pxPerCm(map, { x: 2, y: 7 })).toBeCloseTo(10, 6);
  });

  it('refuses corners that cross over', () => {
    expect(convex(corners)).toBe(true);
    expect(convex([corners[0], corners[2], corners[1], corners[3]])).toBe(false);
  });

  it('starts with a mat-shaped box in the middle of the screen', () => {
    const c = startCorners(1000, 800, mat);
    expect((c[1].x - c[0].x) / (c[3].y - c[0].y)).toBeCloseTo(60 / 45, 6);
    expect(c[0].x + c[1].x).toBeCloseTo(1000, 6);
  });
});

describe('placing a piece', () => {
  const mid = { x: 10, y: 20 };
  it('turns a quarter clockwise', () => {
    const q = placePoint({ x: 15, y: 20 }, mid, { at: { x: 30, y: 30 }, turn: 90, flip: false });
    expect(q.x).toBeCloseTo(30, 6);
    expect(q.y).toBeCloseTo(35, 6);
  });
  it('flips left to right', () => {
    const q = placePoint({ x: 15, y: 20 }, mid, { at: { x: 30, y: 30 }, turn: 0, flip: true });
    expect(q.x).toBeCloseTo(25, 6);
  });
});
