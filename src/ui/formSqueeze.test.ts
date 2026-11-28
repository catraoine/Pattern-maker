import { describe, expect, it } from 'vitest';
import { skirtForm, torsoForm } from './DrawOnForm';
import { SQUEEZE, drawnPoint, drawnPointBack, neckLift, squeezeX, unsqueezeX, wornFolds } from './FormSketch';

// The form is drawn narrower than the pattern's flat girths, but a shoulder and a neck are straight widths across
// (Nov 17: a long-sleeve dress read as a coat with padded shoulders and its crew neck as a deep U).
const m = { full_bust: 82, waist: 62, full_hip: 90, waist_to_hip: 21.5, neck: 33 };
const body = torsoForm({ neckPoint: { x: 6.2, y: -2 }, shoulderTip: { x: 17.8, y: 2.7 }, apex: { x: 9, y: 22 }, waistY: 42.4 }, m);

describe('the form drawn at true width at the neck and shoulders', () => {
  it('draws the neck point at its true width, and the shoulder tip at about its own', () => {
    expect(squeezeX(body, 6.2, -2)).toBeCloseTo(6.2);
    expect(squeezeX(body, -17.8, 2.7)).toBeLessThan(-0.95 * 17.8);
    expect(squeezeX(body, 17.8, 2.7)).toBeLessThanOrEqual(17.8);
  });
  it('narrows evenly at the bust and below, and up the neck where the head sits', () => {
    for (const [x, y] of [[20, 27.4], [15, 42], [22, 60], [4, -8]]) expect(squeezeX(body, x, y)).toBeCloseTo(SQUEEZE * x);
  });
  it('moves the arm out with the shoulder, keeping its own width', () => {
    const y = 10;
    expect(squeezeX(body, 27, y) - squeezeX(body, 20, y)).toBeCloseTo(SQUEEZE * 7);
  });
  it('reads a line drawn on the form back to the same cm, both sides', () => {
    for (const y of [-3, 0, 4, 12, 20, 30]) for (const x of [-25, -12, -3, 0, 5, 17.8, 26]) expect(unsqueezeX(body, squeezeX(body, x, y), y)).toBeCloseTo(x);
  });
  it('leaves a form without shoulders (a skirt) narrowed evenly', () => {
    const skirt = skirtForm(m);
    expect(squeezeX(skirt, 20, -5)).toBeCloseTo(SQUEEZE * 20);
    expect(unsqueezeX(skirt, SQUEEZE * 20, -5)).toBeCloseTo(20);
  });
});

// The cloth under the neck is drawn a touch raised, seen from a little above (Nov 17: a crew read as a deep scoop).
describe('the cloth under the neck drawn a touch foreshortened', () => {
  const lift = neckLift(body);
  // A crew is the block's neck plus 1 cm, about 9 cm down: it should read at the neck base, not as a U as deep as
  // it is wide (the film's Draw view, Nov 17).
  it('draws a crew at the neck base, and leaves the neck point and the bust alone', () => {
    // This form's neck point is 2 cm above y = 0.
    const front = drawnPoint(body, lift, { x: 0, y: -2 + 9 }).y;
    expect(front).toBeGreaterThan(-2 + 3);
    expect(front).toBeLessThan(-2 + 4.5);
    expect(drawnPoint(body, lift, { x: 6.2, y: -2 }).y).toBeCloseTo(-2);
    expect(drawnPoint(body, lift, { x: 4, y: 22 }).y).toBeCloseTo(22);
    expect(drawnPoint(body, lift, { x: 15, y: 4 }).y).toBeCloseTo(4);
  });
  it('leaves a scoop, a square and a V where they are cut', () => {
    expect(drawnPoint(body, lift, { x: 0, y: -2 + 18 }).y).toBeCloseTo(-2 + 18);
    expect(drawnPoint(body, lift, { x: 0, y: -2 + 22 }).y).toBeCloseTo(-2 + 22);
  });
  it('draws deeper cuts deeper, with no jump anywhere down the centre front', () => {
    let was = -Infinity;
    for (let y = -2; y < 20; y += 0.05) {
      const at = drawnPoint(body, lift, { x: 0, y }).y;
      expect(at).toBeGreaterThan(was);
      if (was > -Infinity) expect(at - was).toBeLessThan(0.2);
      was = at;
    }
  });
  it('rises smoothly across a wide, shallow neckline such as a boat neck, with no step at the sides of the neck', () => {
    let was = drawnPoint(body, lift, { x: 0, y: -2 + 10 }).y;
    for (let x = 0.1; x < 20; x += 0.1) {
      const at = drawnPoint(body, lift, { x, y: -2 + 10 }).y;
      expect(Math.abs(at - was)).toBeLessThan(0.2);
      was = at;
    }
  });
  it('reads a line drawn on it back to the same cm, so a neckline lands where it was drawn', () => {
    for (const y of [-2, 0, 2, 4, 6, 7, 8, 10, 12, 14, 16]) for (const x of [-12, -8, -3, 0, 2, 6, 9, 11]) {
      const back = drawnPointBack(body, lift, drawnPoint(body, lift, { x, y }));
      expect(back.x).toBeCloseTo(x, 3);
      expect(back.y).toBeCloseTo(y, 3);
    }
  });
  it('leaves a form without a neck (a skirt) as it is', () => {
    expect(neckLift(skirtForm(m))).toBeUndefined();
  });
});

// EM walk, Nov 28: on the Blush Shift the folds fell from the shoulders to the hem and read as panel seams.
describe('the folds a loose piece falls in', () => {
  // A piece `upper` wide each side at `top`, flaring to `hem` each side at `bottom`.
  const piece = (top: number, bottom: number, upper: number, hem: number) => [
    { x: -upper, y: top },
    { x: upper, y: top },
    { x: hem, y: bottom },
    { x: -hem, y: bottom },
  ];
  const at = { waist: 0, hip: 20 };
  it('start below the hip on a shift that hangs from the shoulders', () => {
    const folds = wornFolds([piece(-40, 40, 20, 34)], [piece(-40, 40, 20, 24)], at);
    expect(folds.length).toBeGreaterThan(0);
    for (const run of folds) expect(Math.min(...run.map((q) => q.y))).toBeGreaterThanOrEqual(20);
  });
  it('still fall from just under the waist on a skirt', () => {
    const folds = wornFolds([piece(0, 60, 20, 40)], [piece(0, 60, 20, 26)], at);
    expect(folds.length).toBeGreaterThan(0);
    for (const run of folds) expect(run[0].y).toBeLessThan(3);
  });
});
