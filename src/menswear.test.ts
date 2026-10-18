import { describe, expect, it } from 'vitest';
import { withEstimates } from './estimate';
import { checkMeasurements, isComplete, type MeasurementValues } from './measurements';
import { extrasFor, fullSetMissing, labelOf, missingFor, stepsOf, tipOf, titleOf } from './measureFlow';
import { draftBodice, type BodiceMeasurements } from './engine/bodice';
import { draftOuter, type OuterMeasurements } from './engine/outerwear';

// The menswear form (Cat's B2 Two Forms, 2026-10-18): the chest instead of the bust, none of the bust
// measurements asked, and tops drafted with no bust dart.

/** A man measured with the base set and the bodice's essentials (cm). */
const MAN: MeasurementValues = { full_bust: 100, waist: 86, full_hip: 100, waist_to_floor: 108, shoulder_width: 46, nape_to_waist: 45, waist_to_hip: 21 };
const ARMS: MeasurementValues = { arm_length: 64, upper_arm: 32 };

describe('measuring on the menswear form', () => {
  it('never asks the high bust, bust depth or bust point to bust point', () => {
    const skipped = ['high_bust', 'bust_depth', 'apex_separation'];
    for (const g of ['bodice', 'dress', 'jacket', 'coat', 'tee'] as const) {
      expect(extrasFor(g, 'menswear').map((f) => f.id).filter((id) => skipped.includes(id))).toEqual([]);
    }
    expect(extrasFor('bodice').map((f) => f.id)).toContain('high_bust');
    expect(fullSetMissing({}, 'menswear').map((f) => f.id).filter((id) => skipped.includes(id))).toEqual([]);
  });

  it('is ready for a bodice without them, where the womenswear form still asks the high bust', () => {
    expect(missingFor('bodice', MAN, 'menswear')).toEqual([]);
    expect(isComplete(MAN, 'bodice', 'menswear')).toBe(true);
    expect(checkMeasurements(MAN, 'cm', 'bodice', 'menswear').filter((c) => c.level === 'error')).toEqual([]);
    expect(isComplete(MAN, 'bodice')).toBe(false);
  });

  it('says chest wherever the womenswear form says bust', () => {
    expect(titleOf('full_bust', false, 'menswear')).toBe('Your chest');
    expect(titleOf('full_bust', true, 'menswear')).toBe('Their chest');
    expect(labelOf('full_bust', 'menswear')).toBe('Chest');
    expect(labelOf('full_bust')).toBe('Full bust');
    for (const line of [tipOf('full_bust', false, 'menswear'), tipOf('full_bust', true, 'menswear'), ...stepsOf('full_bust', false, 'menswear')]) {
      expect(line).not.toMatch(/bust/i);
    }
    expect(stepsOf('full_bust', false, 'menswear').join(' ')).toMatch(/chest/);
  });
});

describe('drafting on the menswear form', () => {
  it('estimates with no bust shaping and never changes what was measured', () => {
    const v = withEstimates(MAN, 'menswear');
    expect(v.high_bust).toBe(100);
    for (const [id, x] of Object.entries(MAN)) expect(v[id as keyof MeasurementValues]).toBe(x);
    expect(v.neck).toBeGreaterThan(36);
  });

  it('drafts every bodice style with no bust dart, keeping the waist darts', () => {
    const m = withEstimates(MAN, 'menswear') as BodiceMeasurements;
    for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
      for (const darts of ['bust_waist', 'bust', 'none'] as const) {
        const d = draftBodice(m, { fit, neckline: 'crew', length: 'waist', darts, fitting: { flatFront: true } });
        expect(d.bustDart).toBe(0);
        expect(d.pieces.length).toBeGreaterThan(0);
      }
    }
    expect(draftBodice(m, { fit: 'fitted', neckline: 'crew', length: 'waist', darts: 'bust_waist', fitting: { flatFront: true } }).pieces[0].lines.length).toBeGreaterThan(0);
  });

  it('drafts a jacket and a coat on it', () => {
    const m = withEstimates({ ...MAN, ...ARMS, waist_to_knee: 60 }, 'menswear') as OuterMeasurements;
    for (const kind of ['jacket', 'coat'] as const) {
      const d = draftOuter(m, { kind, fitting: { flatFront: true } });
      expect(d.pieces.length).toBeGreaterThan(3);
    }
  });
});
