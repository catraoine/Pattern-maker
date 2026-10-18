import { describe, expect, it } from 'vitest';
import { draftTee } from '../engine/tee';
import { draftOuter, outerDrop } from '../engine/outerwear';
import { DEFAULT_COAT_CHOICES, DEFAULT_JACKET_CHOICES, DEFAULT_TEE_CHOICES, OuterChoices } from '../garments';
import type { P } from '../engine/geometry';
import { landmarks } from './formLines';
import { armAt } from './DrawOnForm';
import { outerLines, readOuterCollar, readOuterFit, readOuterFront, readOuterHem, readOuterShaping, readTeeFit, readTeeHem, readTeeNeckline, readTeeSleeve, teeForm, teeLines } from './formTops';

const m = { full_bust: 92, high_bust: 86, waist: 76, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, arm_length: 59, upper_arm: 29, wrist: 16 };

/** A line through the given points, a point every half centimetre or so. */
const line = (...at: P[]) =>
  at.slice(1).flatMap((b, i) => {
    const a = at[i];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    return Array.from({ length: n }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n }));
  });
const across = (y: number, w = 25) => line({ x: -w, y }, { x: w, y });
const down = (x: number, from: number, to: number) => line({ x, y: from }, { x, y: to });

describe('drawing on the T-shirt form', () => {
  const c = DEFAULT_TEE_CHOICES;
  const draft = draftTee(m, c);
  const tf = teeForm(m, c, draft);

  it('builds the form and finds where each option falls on it', () => {
    expect(tf.necks.crew).toBeLessThan(tf.necks.scoop);
    expect(tf.necks.scoop).toBeLessThan(tf.necks.v);
    expect(tf.hems.cropped).toBeLessThan(tf.hems.hip);
    expect(tf.hems.hip).toBeLessThan(tf.hems.tunic);
    expect(tf.sleeves.short).toBeLessThan(tf.sleeves.elbow);
    expect(tf.sleeves.elbow).toBeLessThan(tf.sleeves.long);
    expect(tf.body.waistY).toBe(m.nape_to_waist);
    // The arm hangs clear of the body.
    expect(armAt(tf.arm, tf.bustY).inner).toBeGreaterThan(tf.body.width(tf.bustY));
  });

  it('reads a neckline as crew, scoop or V by its depth and its shape', () => {
    const from = { x: 8, y: -1 };
    expect(readTeeNeckline(line(from, { x: 4, y: 5 }, { x: 0, y: tf.necks.crew }), tf, c).choices?.neckline).toBe('crew');
    // Straight down to a point is a V; curving down and across is a scoop.
    expect(readTeeNeckline(line(from, { x: 0, y: tf.necks.v }), tf, c).choices?.neckline).toBe('v');
    const scoop = readTeeNeckline(line(from, { x: 7, y: tf.necks.scoop - 1 }, { x: 0, y: tf.necks.scoop }), tf, c);
    expect(scoop.choices?.neckline).toBe('scoop');
    expect(scoop.said).toMatch(/scoop neck, \d+ cm lower than a crew/);
    // Far deeper than the tee goes: the nearest, said so.
    expect(readTeeNeckline(line(from, { x: 0, y: tf.necks.v + 10 }), tf, c).said).toMatch(/set depths/);
    expect(readTeeNeckline(line(from, { x: 7, y: 6 }), tf, c).choices).toBeUndefined();
  });

  it('pins the fit at the side, for the knit', () => {
    const at = (k: number) => readTeeFit(down((m.full_bust / 4) * k, tf.bustY - 2, m.nape_to_waist - 6), tf, m, c);
    expect(at(0.95).choices?.fit).toBe('fitted');
    expect(at(1).choices?.fit).toBe('regular');
    expect(at(1.1).choices?.fit).toBe('relaxed');
    expect(at(0.95).said).toMatch(/-5% ease .* medium-stretch knit, so it stretches on/);
    expect(at(0.3).choices).toBeUndefined();
  });

  it('sets the length from a hem, and keeps it level', () => {
    expect(readTeeHem(across(tf.hems.cropped + 1), tf, c).choices?.length).toBe('cropped');
    expect(readTeeHem(across(tf.hems.tunic), tf, c).choices?.length).toBe('tunic');
    const curved = Array.from({ length: 30 }, (_, i) => ({ x: -25 + i * 1.7, y: tf.hems.hip + 0.03 * (-25 + i * 1.7) ** 2 - 6 }));
    const r = readTeeHem(curved, tf, c);
    expect(r.choices?.length).toBe('hip');
    expect(r.said).toMatch(/cut level/);
  });

  it('reads a line across the arm as the sleeve length', () => {
    const acrossArm = (len: number) => {
      const y = tf.arm.tip.y + len;
      const a = armAt(tf.arm, y);
      return line({ x: a.inner - 1, y }, { x: a.outer + 1, y: y + 1 });
    };
    expect(readTeeSleeve(acrossArm(tf.sleeves.elbow), tf, c).choices?.sleeve).toBe('elbow');
    expect(readTeeSleeve(acrossArm(tf.sleeves.long - 1), tf, c).said).toMatch(/^Long sleeves, \d+ cm from the shoulder\.$/);
    // On the left arm as well.
    const left = acrossArm(tf.sleeves.short).map((q) => ({ x: -q.x, y: q.y }));
    expect(readTeeSleeve(left, tf, { ...c, sleeve: 'long' }).choices?.sleeve).toBe('short');
    expect(readTeeSleeve(across(30, 8), tf, c).choices).toBeUndefined();
  });

  it('draws the lines the tee already has', () => {
    const lines = teeLines(draft, tf);
    expect(lines.neckline).toHaveLength(2);
    expect(lines.sleeve![0][0].y).toBeCloseTo(tf.arm.tip.y + draft.sleeve.lengthCm, 5);
    expect(lines.hem![0].some((q) => Math.abs(q.y - tf.hems.hip) < 0.01)).toBe(true);
  });
});

describe('drawing on the jacket and coat form', () => {
  const c = DEFAULT_JACKET_CHOICES;
  const draft = draftOuter(m, { ...c, kind: 'jacket' });
  const L = landmarks(draft.base);
  const redraft = (next: OuterChoices) => draftOuter(m, { ...next, kind: next.garment });

  it('sets the length from the nearest of the jacket’s or the coat’s', () => {
    expect(readOuterHem(across(L.waistY + outerDrop(m, 'long') + 1), draft, m, c).choices?.length).toBe('long');
    const cropped = readOuterHem(across(L.waistY + 9), draft, m, c);
    expect(cropped.choices).toMatchObject({ length: 'cropped', vent: 'none' });
    expect(cropped.said).toMatch(/back vent/);
    expect(readOuterHem(across(L.waistY + 60), draft, m, c).said).toMatch(/make a coat/);
    const coat = draftOuter(m, { ...DEFAULT_COAT_CHOICES, kind: 'coat' });
    expect(readOuterHem(across(L.waistY + outerDrop(m, 'midi')), coat, m, DEFAULT_COAT_CHOICES).choices?.length).toBe('midi');
  });

  it('pins the fit at the side, and a fitted cut keeps its darts', () => {
    const at = (room: number, base = c) => readOuterFit(down((m.full_bust + room) / 4, L.apex.y - 2, L.waistY - 6), draft, m, base);
    expect(at(10).choices?.fit).toBe('fitted');
    expect(at(17).choices?.fit).toBe('relaxed');
    expect(at(13).said).toBe('Regular: 13 cm of room at the bust.');
    expect(at(10, { ...c, shaping: 'boxy' }).choices).toMatchObject({ fit: 'fitted', shaping: 'darts' });
  });

  it('reads a line down the front as single- or double-breasted', () => {
    const single = readOuterFront(down(2.5, L.apex.y - 4, L.waistY + 10), draft, c);
    expect(single.choices?.front).toBe('single');
    const double = readOuterFront(down(-7, L.apex.y - 4, L.waistY + 10), draft, c);
    expect(double.choices?.front).toBe('double');
    expect(double.said).toMatch(/two rows of buttons/);
    expect(redraft(double.choices!).ext).toBe(6.5);
    expect(readOuterFront(across(30), draft, c).choices).toBeUndefined();
  });

  it('reads the collar line: down to the bust for lapels, round to the centre for collarless', () => {
    const from = { x: L.neckPoint.x, y: L.neckPoint.y + 0.5 };
    const collarless = readOuterCollar(line(from, { x: 4, y: 6 }, { x: 0, y: draft.block[0].outline.start.y }), draft, c);
    expect(collarless.choices?.collar).toBe('collarless');
    expect(redraft(collarless.choices!).lapel).toBeUndefined();
    const notched = readOuterCollar(line(from, { x: 2, y: L.apex.y }), draft, { ...c, collar: 'collarless' });
    expect(notched.choices?.collar).toBe('notched');
    expect(readOuterCollar(line({ x: 15, y: 20 }, { x: 2, y: 30 }), draft, c).choices).toBeUndefined();
  });

  it('turns a line through the bust to the waist into princess seams, and any other into darts', () => {
    const shoulderMid = { x: (L.neckPoint.x + L.shoulderTip.x) / 2, y: (L.neckPoint.y + L.shoulderTip.y) / 2 };
    const princess = readOuterShaping(line(shoulderMid, L.apex, { x: L.apex.x, y: L.waistY }), draft, c);
    expect(princess.choices?.shaping).toBe('princess');
    expect(princess.said).toMatch(/start at the armhole/);
    expect(redraft(princess.choices!).pieces.some((pc) => /side front/i.test(pc.name))).toBe(true);
    expect(readOuterShaping(line(shoulderMid, L.apex), draft, { ...c, shaping: 'princess' }).choices?.shaping).toBe('darts');
  });

  it('draws the lines the jacket already has', () => {
    const lines = outerLines(draft);
    expect(lines.front).toHaveLength(1);
    expect(lines.front![0][0].x).toBe(draft.ext);
    expect(lines.collar!.length).toBe(4);
    expect(outerLines(redraft({ ...c, collar: 'collarless' })).collar).toHaveLength(2);
  });
});
