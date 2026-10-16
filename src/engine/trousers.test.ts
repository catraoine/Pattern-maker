import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomBody, randomCrotch, rng } from './randomBodies';
import { DEFAULT_TROUSERS, Leg, TrouserClosure, TrousersMeasurements, draftTrousers, trousersWaistband } from './trousers';
import { trousersGuide } from './trousersGuide';
import { trousersFlat } from './flat';
import { trousersSpec } from './spec';
import { withAllowances } from './allowances';
import { layPlans } from './layplan';
import { carriedFitting, toFitting } from './fitting';
import type { Fit } from './skirt';

const EX: TrousersMeasurements = { waist: 76, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, crotch_depth: 27, crotch_length: 70 };
const LEGS: Leg[] = ['straight', 'wide', 'tapered', 'culotte'];
const CLOSURES: TrouserClosure[] = ['fly', 'side_zip'];
const FITS: Fit[] = ['fitted', 'regular', 'relaxed'];

describe('trousers block', () => {
  it('drafts the crotch seam to the crotch length with ease, front shorter than back', () => {
    const d = draftTrousers(EX);
    expect(d.crotch.front + d.crotch.back).toBeCloseTo(d.crotch.target, 0);
    expect(d.crotch.target).toBe(73);
    expect(d.crotch.back).toBeGreaterThan(d.crotch.front + 5);
    expect(d.crotchCapped).toBe(false);
  });

  it('gives each leg its own knee and hem, widest for culottes and narrowest tapered', () => {
    const w = Object.fromEntries(LEGS.map((leg) => [leg, draftTrousers(EX, { leg })]));
    expect(w.tapered.hemCm).toBeLessThan(w.straight.hemCm);
    expect(w.straight.hemCm).toBeLessThan(w.wide.hemCm);
    expect(w.wide.hemCm).toBeLessThan(w.culotte.hemCm);
    expect(w.tapered.hemCm).toBeGreaterThanOrEqual(31);
    expect(w.culotte.lengthCm).toBeLessThan(w.straight.lengthCm - 20);
    expect(draftTrousers(EX, { length: 'ankle' }).lengthCm).toBe(w.straight.lengthCm - 6);
  });

  it('adds the fly facing and shield for a fly, and marks the zip in the left side seam otherwise', () => {
    const fly = draftTrousers(EX, { closure: 'fly' });
    expect(fly.pieces.map((pc) => pc.name)).toEqual(['Trousers front', 'Trousers back', 'Fly facing', 'Fly shield']);
    const side = draftTrousers(EX, { closure: 'side_zip' });
    expect(side.pieces).toHaveLength(2);
    expect(side.pieces.every((pc) => pc.labels.some((l) => l.text === 'LEFT ZIP ENDS'))).toBe(true);
    // The facing's centre edge follows the front's centre front from the waist.
    const facing = fly.pieces[2];
    expect(facing.outline.start).toEqual(fly.pieces[0].outline.start);
    expect(taggedLength(facing.outline, 'fly')).toBeCloseTo(fly.zipCm + 2, 0);
  });

  it('passes the seam check for random bodies in every leg, opening and fit', () => {
    const r = rng(2026);
    for (let i = 0; i < 24; i++) {
      const b = randomBody(r);
      const m: TrousersMeasurements = { ...b, ...randomCrotch(b, r) };
      for (const leg of LEGS)
        for (const closure of CLOSURES) {
          const fit = FITS[Math.floor(r() * 3)];
          const d = draftTrousers(m, { leg, closure, fit });
          const bad = checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok);
          expect(bad.map((c) => `${i} ${leg} ${closure} ${fit}: ${c.label} ${c.detail}`)).toEqual([]);
          const labels = checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).map((c) => c.label);
          expect(labels).toContain('Inside leg seams');
          expect(labels).toContain('Crotch seam to your crotch length');
          expect(labels).toContain('Crotch seam blends across the inside leg');
        }
    }
  });

  it('takes the skirt toile’s waist, hip and sway back, not its darts', () => {
    const c = carriedFitting({ skirt: { issues: { 'skirt-sway-back': 1.5, 'skirt-hip-tight': 2, 'skirt-dart-bubble': 1 }, round: 1, date: '2026-10-01' } }, 'trousers');
    expect(Object.keys(c.fitting.issues).sort()).toEqual(['skirt-hip-tight', 'skirt-sway-back']);
    const plain = draftTrousers(EX);
    const fitted = draftTrousers(EX, { fitting: toFitting(c.fitting, 'skirt') });
    expect(fitted.finishedHip).toBe(plain.finishedHip + 2);
    // A sway back lowers the centre back waist.
    expect(fitted.pieces[1].outline.start.y).toBeGreaterThan(plain.pieces[1].outline.start.y + 1);
  });

  it('makes a waistband, guide, flat, spec and cutting layout', () => {
    for (const closure of CLOSURES) {
      const d = draftTrousers(EX, { ...DEFAULT_TROUSERS, closure });
      const band = trousersWaistband(d, 1.5);
      expect(band.meta.lengthCm).toBeCloseTo(d.finishedWaist + d.waistband.underlap, 0);
      const pieces = [...d.pieces, band].map((pc) => withAllowances(pc, 'home'));
      const lays = layPlans(pieces, 140);
      expect(lays[0].metres).toBeGreaterThan(1.8);
      expect(lays[0].metres).toBeLessThan(3.2);
      const g = trousersGuide(d, lays[0].metres);
      const titles = g.steps.map((s) => s.title);
      expect(new Set(titles).size).toBe(titles.length);
      expect(titles).toContain(closure === 'fly' ? 'Put in the fly zip' : 'Put in the side zip');
      for (const s of g.steps) expect(s.text).toMatch(/^[\x20-\x7e]*$/);
      const flat = trousersFlat(d, EX);
      expect(flat.views).toHaveLength(2);
      expect(flat.width).toBeGreaterThan(80);
      expect(trousersSpec(EX, d).find((r) => r.label === 'Crotch length')?.finished).toBeCloseTo(73, 0);
    }
  });
});
