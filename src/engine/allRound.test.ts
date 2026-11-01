import { describe, expect, it } from 'vitest';
import { roundBodice, roundDress, roundOuter, roundSkirt, roundTee, roundTrousers, stripesMeet } from './allRound';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { draftOuter } from './outerwear';
import { draftTee } from './tee';
import { draftTrousers } from './trousers';
import { draftSleeve } from './sleeve';
import { EXAMPLE_VALUES } from '../measurements';
import { draftSkirt } from './skirt';
import { checked, roundRows } from '../ui/AllRound';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const side = Math.PI / 2;

describe('all round', () => {
  it('reads a level skirt as one length all the way round, with its seams, darts and zip', () => {
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee' }));
    expect(r.readings).toEqual({ front: 58, back: 58, left: 58, right: 58 });
    expect(r.seams.map((s) => s.kind)).toEqual(['side', 'side', 'centre_back']);
    expect(r.zip?.phi).toBe(Math.PI);
    expect(r.zip!.toCm).toBeGreaterThan(15);
    expect(r.darts).toHaveLength(8);
    expect(r.seamsMeet).toBe(true);
    expect(r.flare).toBeGreaterThan(1);
  });

  it('follows a high-low hem round the body, and a diagonal one side to side', () => {
    const hl = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', asymHem: 'high_low' })).readings;
    expect(hl.front).toBeLessThan(hl.left);
    expect(hl.back).toBeGreaterThan(hl.left);
    const dg = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', asymHem: 'diagonal' })).readings;
    expect(dg.left).not.toBe(dg.right);
  });

  // A hem drawn by hand is trued as it is drafted: front and back come to the same length at each side
  // seam, so the view shows them meeting and never flags a step.
  it('shows a hand-drawn hem meeting at the side seams', () => {
    const front = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const back = [6, 5, 4, 3, 2, 1, 0, -1, -2];
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', hem: { front, back } }));
    for (const s of [side, -side]) expect(Math.abs(r.lengthAt(s - 1e-6) - r.lengthAt(s + 1e-6))).toBeLessThan(0.05);
    expect(r.seamsMeet).toBe(true);
  });

  it('has no darts or zip on an elastic waist, and no centre back seam when the back is on the fold', () => {
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee', waist: 'elastic' }));
    expect(r.darts).toHaveLength(0);
    expect(r.zip).toBeUndefined();
    expect(r.seams.some((s) => s.kind === 'centre_back')).toBe(false);
  });

  it('says only true things, and stripes only when the fabric has them and they meet', () => {
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee' }));
    expect(stripesMeet(r)).toBe(true);
    expect(roundRows(r, false).map((x) => x.id)).toEqual(['seams', 'hem']);
    expect(roundRows(r, true).map((x) => x.id)).toEqual(['seams', 'hem', 'stripes']);
    const rows = roundRows(r, true).map((x) => x.text).join(' ');
    expect(rows).not.toMatch(/problem|fix|wrong|longer than/i);
  });

  it('folds the checks into one quiet line', () => {
    const r = roundSkirt(draftSkirt(m, { silhouette: 'a_line', length: 'knee' }));
    expect(checked(roundRows(r, false))).toBe('Seams and hem checked');
    expect(checked(roundRows(r, 'checks'))).toBe('Seams and hem checked, checks matched');
  });

  // Every garment, not only skirts: tops, dresses, jackets, coats and trousers.
  const full = EXAMPLE_VALUES as never;
  const kinds = (r: { seams: { kind: string; cont?: boolean }[] }) => r.seams.filter((s) => !s.cont).map((s) => s.kind);

  it('wraps a bodice round the form from the neck to the waist, with its zip at the centre back', () => {
    const r = roundBodice(draftBodice(full), full);
    expect(r.kind).toBe('top');
    expect(kinds(r).sort()).toEqual(['centre_back', 'shoulder', 'shoulder', 'side', 'side']);
    expect(r.topAt(Math.PI)).toBeCloseTo(-41, 0);
    expect(r.topAt(0)).toBeGreaterThan(r.topAt(Math.PI));
    expect(Math.abs(r.lengthAt(0))).toBeLessThan(2);
    expect(r.armhole!.underarmCm).toBeGreaterThan(r.armhole!.shoulderCm);
    expect(r.zip?.phi).toBe(Math.PI);
    expect(r.darts.length).toBeGreaterThan(0);
    expect(r.seamsMeet).toBe(true);
  });

  it('turns princess darts into princess seams, and carries a set-in sleeve', () => {
    const d = draftBodice(full, { princess: 'armhole' });
    const r = roundBodice(d, full, draftSleeve(d, full, { seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5, length: 'long', shape: 'straight', fit: 'regular' }));
    expect(kinds(r).filter((k) => k === 'princess')).toHaveLength(4);
    expect(r.darts).toHaveLength(0);
    expect(r.sleeve!.lengthCm).toBeGreaterThan(40);
    expect(roundRows(r, false).map((x) => x.id)).toContain('sleeves');
  });

  it('runs a dress from the neck to the hem with a waist seam all the way round', () => {
    const r = roundDress(draftDress(full), full);
    expect(r.kind).toBe('dress');
    expect(r.rings).toHaveLength(1);
    expect(r.readings.front).toBeGreaterThan(30);
    const side = r.seams.find((s) => s.kind === 'side')!;
    expect(side.pts[side.pts.length - 1].cm).toBe(r.lengthAt(Math.PI / 2));
    expect(r.zip!.toCm).toBeGreaterThan(0);
  });

  it('has no centre seams on a tee cut on the fold, and gives it sleeves', () => {
    const r = roundTee(draftTee(full), full);
    expect(kinds(r).filter((k) => k.startsWith('centre'))).toHaveLength(0);
    expect(r.sleeve).toBeDefined();
    expect(r.readings.front).toBeGreaterThan(0);
  });

  it('opens a jacket at the centre front, with its buttons and back vent', () => {
    const r = roundOuter(draftOuter(full, { kind: 'jacket' }), full);
    expect(kinds(r)).toContain('centre_front');
    expect(r.opening!.buttons.length).toBeGreaterThan(2);
    expect(r.vent).toBeDefined();
    const coat = roundOuter(draftOuter(full, { kind: 'coat' }), full);
    expect(kinds(coat).filter((k) => k === 'princess')).toHaveLength(4);
    expect(coat.readings.back).toBeGreaterThan(r.readings.back + 20);
    expect(coat.flare).toBeGreaterThanOrEqual(1);
  });

  it('gives trousers two legs, each with an outside seam and an inseam, and a fly at the centre front', () => {
    const r = roundTrousers(draftTrousers(full), full);
    expect(r.legs!.lengthCm).toBe(r.readings.front);
    expect(r.seams.filter((s) => s.kind === 'inseam')).toHaveLength(2);
    expect(r.seams.filter((s) => s.leg)).toHaveLength(4);
    expect(r.zip?.phi).toBe(0);
    expect(stripesMeet(r)).toBe(false);
    const rows = roundRows(r, true);
    expect(rows.map((x) => x.id)).toEqual(['seams', 'hem']);
    expect(rows[0].text).toMatch(/^All 6 seams and \d+ darts meet from the waist to the hems\.$/);
    expect(rows.map((x) => x.text).join(' ')).not.toMatch(/problem|fix|wrong/i);
  });
});
