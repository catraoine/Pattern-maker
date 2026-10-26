import { describe, expect, it } from 'vitest';
import { draftBodice } from '../engine/bodice';
import { draftSkirt } from '../engine/skirt';
import { draftOuter } from '../engine/outerwear';
import { draftSleeve } from '../engine/sleeve';
import { DEFAULT_BODICE, DEFAULT_JACKET_CHOICES, DEFAULT_COAT_CHOICES, validDetails } from '../garments';
import type { Choices } from '../savedWork';
import type { P } from '../engine/geometry';
import { EXAMPLE_VALUES } from '../measurements';
import { armAt, armFor } from './DrawOnForm';
import { bodiceLines, landmarks } from './formLines';
import { readBodiceSleeve, readOuterSleeve, sleeveRange } from './formSleeves';
import { readFullness, readSkirtPocket, readSkirtWaist, readSlit, skirtHalf } from './formSkirt';
import { readCollar, readFront } from './formCollar';
import { readOuterPocket, readOuterVent } from './formOuter';
import { readOuterHem, readOuterFit } from './formTops';

const m = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40, full_hip: 98, waist_to_hip: 20, arm_length: 58, upper_arm: 28, wrist: 16 };
const d = draftBodice(m);
const L = landmarks(d);
const arm = armFor(L.shoulderTip, L.underarm, m);
const range = sleeveRange(d, m, 'regular')!;
const line = (...at: P[]) =>
  at.slice(1).flatMap((b, i) => {
    const a = at[i];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    return [...Array.from({ length: n }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n })), ...(i === at.length - 2 ? [b] : [])];
  });
/** Down the outside of the arm, `off` cm out from it at each height. */
const downArm = (from: number, to: number, off: (t: number) => number) =>
  Array.from({ length: 30 }, (_, i) => {
    const y = from + ((to - from) * i) / 29;
    return { x: armAt(arm, y).outer + off(i / 29), y };
  });
const acrossArm = (y: number) => line({ x: armAt(arm, y).inner, y }, { x: armAt(arm, y).outer, y });

describe('drawing sleeves', () => {
  it('reads a line across the arm as the sleeve length, to the cm', () => {
    const r = readBodiceSleeve(acrossArm(arm.tip.y + 44), d, arm, range, DEFAULT_BODICE);
    expect(r.choices?.sleeve).toBe('three_quarter');
    expect(r.said).toMatch(/44 cm from the shoulder/);
    const s = draftSleeve(d, m, { length: r.choices!.sleeve as 'three_quarter', shape: 'straight', fit: 'regular', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5, lengthCm: r.choices!.sleeveCm });
    expect(s.lengthCm).toBeCloseTo(44, 0);
  });

  it('reads the shape from how a line down the arm stands off it', () => {
    const shape = (pts: P[]) => readBodiceSleeve(pts, d, arm, range, DEFAULT_BODICE).choices?.sleeveShape;
    expect(shape(downArm(arm.tip.y + 1, arm.wristY, () => 0.3))).toBe('fitted');
    expect(shape(downArm(arm.tip.y + 1, arm.tip.y + 21, (t) => 3.5 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * 0.6)))).toBe('puff');
    expect(shape(downArm(arm.tip.y + 1, arm.wristY, (t) => 1.6 + 4 * t ** 2))).toBe('bishop');
    expect(shape(downArm(arm.tip.y + 1, arm.tip.y + 12, (t) => 5 * t))).toBe('flutter');
    expect(shape(downArm(arm.tip.y + 1, arm.tip.y + 6, () => 0.6))).toBe('cap');
  });

  it('reads the neck to the underarm as raglan, once there is a sleeve', () => {
    const raglan = line(L.neckPoint, L.underarm);
    expect(readBodiceSleeve(raglan, d, arm, range, DEFAULT_BODICE).choices).toBeUndefined();
    const r = readBodiceSleeve(raglan, d, arm, range, { ...DEFAULT_BODICE, sleeve: 'long' });
    expect(r.choices?.sleeveCut).toBe('raglan');
  });

  it('reads a jacket sleeve’s cut from how close it sits', () => {
    const j = draftOuter(EXAMPLE_VALUES as never, { kind: 'jacket' });
    const ja = armFor(landmarks(j.base).shoulderTip, landmarks(j.base).underarm, EXAMPLE_VALUES as never);
    const down = (off: number) => Array.from({ length: 30 }, (_, i) => ({ x: armAt(ja, ja.tip.y + 1 + (i * (ja.wristY - ja.tip.y - 1)) / 29).outer + off, y: ja.tip.y + 1 + (i * (ja.wristY - ja.tip.y - 1)) / 29 }));
    expect(readOuterSleeve(down(0.5), ja, landmarks(j.base).neckPoint, DEFAULT_JACKET_CHOICES).choices?.sleeve).toBe('fitted');
    expect(readOuterSleeve(down(4.5), ja, landmarks(j.base).neckPoint, DEFAULT_JACKET_CHOICES).choices?.sleeve).toBe('straight');
  });
});

describe('drawing on the skirt', () => {
  const sm = { waist: 74, full_hip: 98, waist_to_hip: 20, waist_to_knee: 58, waist_to_floor: 104 };
  const c: Choices = { fit: 'regular', silhouette: 'straight', length: 'knee' };
  const sd = draftSkirt(sm, c as never);
  const half = skirtHalf(sd, c, sm as never, 0);
  const hem = sd.lengthCm;

  it('opens a slit as high as the line drawn up from the hem, at the side or the centre', () => {
    const side = readSlit(line({ x: half(hem), y: hem }, { x: half(hem - 25), y: hem - 25 }), 0, hem, sm, c, 'front', half);
    expect(side.choices).toMatchObject({ slit: 'side', slitCm: 25 });
    const back = readSlit(line({ x: 0.5, y: hem }, { x: 0.5, y: hem - 18 }), 0, hem, sm, c, 'back', half);
    expect(back.choices).toMatchObject({ slit: 'back', slitCm: 18 });
    expect(readSlit(line({ x: 0, y: hem }, { x: 0, y: hem - 18 }), 0, hem, sm, { ...c, silhouette: 'circle' }, 'front', half).choices).toBeUndefined();
  });

  it('reads marks from the waist as pleats, a point up from the hem as godets, a wave low down as a flounce', () => {
    expect(readFullness(line({ x: 8, y: 0.5 }, { x: 8.5, y: 12 }), 0, hem, c).choices?.pleats).toBe('knife');
    expect(readFullness(line({ x: 0.5, y: 0.5 }, { x: 0.5, y: 12 }), 0, hem, c).choices?.pleats).toBe('inverted');
    expect(readFullness(line({ x: 6, y: 0.5 }, { x: 6.5, y: 10 }, { x: 7, y: 1 }), 0, hem, c).choices?.pleats).toBe('box');
    expect(readFullness(line({ x: 4, y: hem }, { x: 7, y: hem - 25 }, { x: 10, y: hem }), 0, hem, c).choices?.godets).toBe(8);
    const wave = (y: number) => Array.from({ length: 60 }, (_, i) => ({ x: -20 + (40 * i) / 59, y: y + 1.2 * Math.sin(i * 0.7) }));
    expect(readFullness(wave(hem - 10), 0, hem, c).choices?.flounce).toBe('hem_flounce');
    expect(readFullness(wave(0.3), 0, hem, c).choices?.silhouette).toBe('gathered');
  });

  it('reads the waist line as a yoke, a high waist or the waistband, and the side seam as pockets', () => {
    expect(readSkirtWaist(line({ x: -18, y: 12 }, { x: 18, y: 12 }), 0, sm, c).choices?.yoke).toBe(true);
    expect(readSkirtWaist(line({ x: -18, y: -5 }, { x: 18, y: -5 }), 0, sm, c).choices?.waist).toBe('high');
    expect(readSkirtWaist(line({ x: -18, y: 0 }, { x: 18, y: 0 }), 0, sm, { ...c, waist: 'high' }).choices?.waist).toBeUndefined();
    expect(readSkirtPocket(line({ x: half(5), y: 5 }, { x: half(18), y: 18 }), 0, sm, c, half, true).choices?.pockets).toBe('inseam');
  });
});

describe('drawing collars and fronts', () => {
  const neck = bodiceLines(d, 'front').neckline.flat();
  const at = (k: number) => neck.map((q) => ({ x: q.x, y: q.y + k }));

  it('reads a band standing above the neckline as a mandarin, and a tall one as a funnel neck', () => {
    expect(readCollar(at(-2.5), d, DEFAULT_BODICE).choices?.collar).toBe('mandarin');
    expect(readCollar(at(-6), d, DEFAULT_BODICE).choices?.collar).toBe('funnel');
  });

  it('reads a flat rounded collar as a Peter Pan, and a pointed one as a shirt collar that buttons the front', () => {
    const half = neck.filter((q) => q.x >= 0).sort((a, b) => b.x - a.x);
    const round = half.filter((q, i) => i === 0 || q.x < half[i - 1].x).map((q) => ({ x: q.x + 1, y: q.y + 4 }));
    expect(readCollar(round, d, DEFAULT_BODICE).choices?.collar).toBe('peter_pan');
    const cf = half[half.length - 1];
    const point = [...half.filter((q, i) => i === 0 || q.x < half[i - 1].x).map((q) => ({ x: q.x + 1, y: q.y + 3 })).filter((q) => q.x > 4), { x: 1.5, y: cf.y + 6 }, { x: 0.5, y: cf.y + 0.5 }];
    const shirt = readCollar(point, d, DEFAULT_BODICE);
    expect(shirt.choices).toMatchObject({ collar: 'shirt', closure: 'front_buttons' });
  });

  it('reads straight down the centre front as buttons, and crossing to the side at the waist as a wrap', () => {
    expect(readFront(line({ x: 0.3, y: L.apex.y - 12 }, { x: 0.2, y: L.waistY }), d, DEFAULT_BODICE).choices?.closure).toBe('front_buttons');
    expect(readFront(line({ x: -L.neckPoint.x, y: L.neckPoint.y + 2 }, { x: L.apex.x + 6, y: L.waistY }), d, DEFAULT_BODICE).choices?.closure).toBe('wrap');
    expect(readFront(line({ x: 0, y: 5 }, { x: 0, y: 30 }), d, validDetails({ ...DEFAULT_BODICE, closure: 'front_buttons' }), 'bodice', 'back').choices?.closure).toBeUndefined();
  });
});

describe('drawing on jackets and coats', () => {
  const coat = draftOuter(EXAMPLE_VALUES as never, { kind: 'coat' });
  const foot = Math.max(...coat.block[0].outline.points(4).map((q) => q.y));

  it('reads a line up from the hem at the centre as the vent, and across it as none', () => {
    expect(readOuterVent(line({ x: 0, y: foot }, { x: 0, y: foot - 28 }), coat, DEFAULT_COAT_CHOICES).choices).toMatchObject({ vent: 'centre', ventCm: 28 });
    expect(readOuterVent(line({ x: -4, y: foot - 1 }, { x: 4, y: foot - 1 }), coat, DEFAULT_COAT_CHOICES).choices?.vent).toBe('none');
  });

  it('reads a box as a patch pocket and a short level line as a welt, where they were drawn', () => {
    const box = line({ x: 10, y: 60 }, { x: 24, y: 60 }, { x: 24, y: 76 }, { x: 10, y: 76 }, { x: 10, y: 60.5 });
    expect(readOuterPocket(box, DEFAULT_COAT_CHOICES).choices).toMatchObject({ pockets: 'patch', pocketAt: { x: 17, y: 60 } });
    expect(readOuterPocket(line({ x: 10, y: 62 }, { x: 25, y: 62.5 }), DEFAULT_COAT_CHOICES).choices?.pockets).toBe('welt');
  });

  it('reads a hem curving up to the front edge as a cutaway, and a side flaring from the hip as an A-line coat', () => {
    const j = draftOuter(EXAMPLE_VALUES as never, { kind: 'jacket' });
    const jf = Math.max(...j.block[0].outline.points(4).map((q) => q.y));
    const curve = Array.from({ length: 40 }, (_, i) => {
      const x = -24 + (48 * i) / 39;
      return { x, y: jf - 9 * Math.max(0, 1 - Math.abs(x) / 9) ** 2 };
    });
    const r = readOuterHem(curve, j, EXAMPLE_VALUES as never, DEFAULT_JACKET_CHOICES);
    expect(r.choices?.cutawayCm).toBeGreaterThanOrEqual(8);
    const w = landmarks(coat.base);
    const hipY = w.waistY + (EXAMPLE_VALUES.waist_to_hip as number);
    const side = line({ x: (EXAMPLE_VALUES.full_bust as number) / 4 + 4, y: w.apex.y }, { x: 27, y: hipY }, { x: 40, y: foot - 2 });
    expect(readOuterFit(side, coat, EXAMPLE_VALUES as never, DEFAULT_COAT_CHOICES).choices?.flare).toBe('a_line');
  });
});
