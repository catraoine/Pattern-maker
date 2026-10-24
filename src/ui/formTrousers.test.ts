import { describe, expect, it } from 'vitest';
import type { P } from '../engine/geometry';
import { checkPattern } from '../engine/qc';
import { randomBody, randomCrotch, rng } from '../engine/randomBodies';
import { RISE_RANGE, TrousersMeasurements, draftTrousers } from '../engine/trousers';
import { DEFAULT_TROUSERS_CHOICES, TrousersChoices } from '../garments';
import { readTrouserHem, readTrouserPocket, readTrouserRise, readTrouserSide, trouserLines, trouserMarks } from './formTrousers';

const EX: TrousersMeasurements = { waist: 76, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, crotch_depth: 27, crotch_length: 70 };
const line = (a: P, b: P, n = 12): P[] => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
const good = (c: TrousersChoices) => {
  const d = draftTrousers(EX, c);
  expect(d.crotchCapped).toBe(false);
  expect(checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((k) => !k.ok)).toEqual([]);
  return d;
};

describe('drawing on trousers', () => {
  const c = DEFAULT_TROUSERS_CHOICES;
  const d = draftTrousers(EX, c);
  const k = trouserMarks(d, EX);

  it('reads a side line narrow at the knee and wide at the hem as a flare, drafted to the widths drawn', () => {
    const r = readTrouserSide([...line({ x: k.hw, y: k.hd }, { x: k.crease + 10, y: k.kn }), ...line({ x: k.crease + 10, y: k.kn }, { x: k.crease + 17, y: k.L })], d, EX, c);
    expect(r.choices?.leg).toBe('flare');
    expect(Math.abs(r.choices!.legCm!.knee - 40)).toBeLessThan(2);
    expect(r.said).toMatch(/flared leg/);
    const t = good(r.choices!);
    expect(t.kneeCm).toBeLessThan(d.kneeCm);
    expect(t.hemCm).toBeGreaterThan(d.hemCm + 15);
  });

  it('reads a tapering line as tapered and a wide one as wide, the same on either leg', () => {
    const taper = readTrouserSide(line({ x: -(k.crease + 11), y: k.kn }, { x: -(k.crease + 8), y: k.L }), d, EX, c);
    expect(taper.choices?.leg).toBe('tapered');
    const wide = readTrouserSide(line({ x: k.crease + 16, y: k.kn }, { x: k.crease + 17.5, y: k.L }), d, EX, c);
    expect(wide.choices?.leg).toBe('wide');
    good(taper.choices!);
    good(wide.choices!);
  });

  it('sets the fit from where the side passes the hip', () => {
    expect(readTrouserSide(line({ x: (EX.full_hip + 10) / 4, y: k.hd - 3 }, { x: (EX.full_hip + 10) / 4, y: k.hd + 3 }), d, EX, c).choices?.fit).toBe('relaxed');
    expect(readTrouserSide(line({ x: (EX.full_hip + 4) / 4, y: k.hd - 3 }, { x: (EX.full_hip + 4) / 4, y: k.hd + 3 }), d, EX, c).choices?.fit).toBe('fitted');
  });

  it('cuts the hem where it is drawn, from shorts to the floor', () => {
    const shorts = readTrouserHem(line({ x: 2, y: 38 }, { x: 20, y: 38 }), EX, c);
    expect(shorts.choices?.length).toBe('shorts');
    const s = good(shorts.choices!);
    expect(s.shorts).toBe(true);
    expect(s.lengthCm).toBe(38);
    const mid = readTrouserHem(line({ x: 2, y: 85 }, { x: 20, y: 85 }), EX, c);
    expect(good(mid.choices!).lengthCm).toBe(85);
    const ankle = readTrouserHem(line({ x: 2, y: EX.waist_to_floor - 9 }, { x: 20, y: EX.waist_to_floor - 9 }), EX, c);
    expect(ankle.choices).toMatchObject({ length: 'ankle', lengthCm: undefined });
  });

  it('drafts a low or high rise from where the waistband is drawn, the leg still ending where it did', () => {
    const low = readTrouserRise(line({ x: -15, y: 5 }, { x: 15, y: 5 }), EX, c);
    expect(low.choices?.riseCm).toBe(-5);
    const lo = good(low.choices!);
    expect(lo.finishedWaist).toBeGreaterThan(d.finishedWaist + 3);
    expect(lo.lengthCm).toBeCloseTo(d.lengthCm, 0);
    expect(lo.crotch.target).toBeLessThan(d.crotch.target - 9);
    const high = readTrouserRise(line({ x: -15, y: -4 }, { x: 15, y: -4 }), EX, c);
    expect(high.choices?.riseCm).toBe(4);
    good(high.choices!);
    for (const rise of [RISE_RANGE.min, RISE_RANGE.max]) good({ ...c, riseCm: rise, leg: 'flare' });
    expect(readTrouserRise(line({ x: -15, y: 0.4 }, { x: 15, y: 0.4 }), EX, { ...c, riseCm: -5 }).choices?.riseCm).toBeUndefined();
  });

  it('reads a slant from the waist to the side as slant pockets and a line down the side seam as in-seam', () => {
    expect(readTrouserPocket(line({ x: k.W - 4, y: 0 }, { x: k.hw, y: 17 }), d, EX, c).choices?.pockets).toBe('slant');
    expect(readTrouserPocket(line({ x: k.hw - 0.5, y: 6 }, { x: k.hw, y: 20 }), d, EX, c).choices?.pockets).toBe('inseam');
    expect(readTrouserPocket(line({ x: k.W - 4, y: 0 }, { x: k.hw, y: 17 }), d, EX, { ...c, closure: 'side_zip' }).choices).toBeUndefined();
  });

  it('draws the lines as they stand, the waistband moved with the rise', () => {
    const lo = draftTrousers(EX, { ...c, riseCm: -5 });
    expect(trouserLines(lo, EX).waist![0][0].y).toBe(5);
    expect(readTrouserRise(line({ x: -15, y: 8 }, { x: 15, y: 8 }), EX, c).said).toMatch(/as low as it goes/);
    expect(trouserLines(d, EX).fit).toHaveLength(2);
  });

  it('drafts flare and bootcut legs at every length and fit', () => {
    for (const leg of ['flare', 'bootcut'] as const)
      for (const fit of ['fitted', 'regular', 'relaxed'] as const)
        for (const length of ['shorts', 'knee', 'cropped', 'full'] as const) good({ ...c, leg, fit, length });
  });

  it('drafts drawn legs, lengths and rises for random bodies', () => {
    const r = rng(1024);
    for (let i = 0; i < 80; i++) {
      const b = randomBody(r);
      const m: TrousersMeasurements = { ...b, ...randomCrotch(b, r) };
      const H = m.full_hip + 6;
      const choice: TrousersChoices = {
        ...c,
        leg: r() < 0.5 ? 'flare' : 'tapered',
        legCm: { knee: H * (0.36 + r() * 0.36), hem: H * (0.25 + r() * 0.6) },
        riseCm: Math.round((RISE_RANGE.min + r() * (RISE_RANGE.max - RISE_RANGE.min)) * 2) / 2,
        lengthCm: m.crotch_depth + 10 + r() * (m.waist_to_floor - m.crotch_depth - 11),
        closure: r() < 0.5 ? 'fly' : 'side_zip',
      };
      const d = draftTrousers(m, choice);
      const bad = checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((k) => !k.ok);
      expect(bad.map((k) => `${i} ${JSON.stringify(choice)}: ${k.label} ${k.detail}`)).toEqual([]);
    }
  });
});
