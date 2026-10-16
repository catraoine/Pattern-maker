import { describe, expect, it } from 'vitest';
import { EXAMPLE_VALUES, FIELDS, checkMeasurements, crossChecks, isComplete } from './measurements';
import { randomArms, randomBody, rng } from './engine/randomBodies';

describe('measurements per garment', () => {
  // A skirt-only profile saved before bodices existed.
  const skirtOnly = { waist: 70, full_hip: 98, waist_to_hip: 21, waist_to_knee: 57, waist_to_floor: 102 };

  it('keeps old skirt measurements complete and asks for the rest for a bodice', () => {
    expect(isComplete(skirtOnly, 'skirt')).toBe(true);
    expect(checkMeasurements(skirtOnly, 'cm', 'skirt')).toEqual([]);
    expect(isComplete(skirtOnly, 'bodice')).toBe(false);
    expect(checkMeasurements(skirtOnly, 'cm', 'bodice').some((c) => c.id === 'full_bust' && c.level === 'error')).toBe(true);
  });

  it('treats the hip measurements as optional for a bodice', () => {
    const { full_hip, waist_to_hip, ...rest } = EXAMPLE_VALUES;
    expect(isComplete(rest, 'bodice')).toBe(true);
    expect(checkMeasurements(rest, 'cm', 'bodice').filter((c) => c.level === 'error')).toEqual([]);
    expect(full_hip && waist_to_hip).toBeTruthy();
  });

  it('catches a bust depth longer than the front length', () => {
    const v = { ...EXAMPLE_VALUES, bust_depth: 46 - 1, front_hps_to_waist: 44 };
    expect(checkMeasurements(v, 'cm', 'bodice').some((c) => c.id === 'bust_depth' && c.level === 'error')).toBe(true);
  });
});

describe('the dress and cross-checks', () => {
  it('asks a dress for the bodice and skirt measurements, hip included, each once', () => {
    const ids = FIELDS.dress.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['full_bust', 'waist', 'full_hip', 'waist_to_hip', 'waist_to_knee', 'waist_to_floor'] as const) expect(ids).toContain(id);
    expect(FIELDS.dress.find((f) => f.id === 'full_hip')!.optional).toBeUndefined();
    expect(isComplete(EXAMPLE_VALUES, 'dress')).toBe(true);
    expect(checkMeasurements(EXAMPLE_VALUES, 'cm', 'dress')).toEqual([]);
  });

  it('stays quiet for 2000 random bodies, whose measurements hang together', () => {
    let flagged = 0;
    const r = rng(77);
    for (let i = 0; i < 2000; i++) {
      const b = randomBody(r);
      if (crossChecks({ ...b, ...randomArms(b, r) }).length) flagged++;
    }
    expect(flagged).toBeLessThan(40);
  });

  it('catches a measurement taken wrong, and names the one to retake', () => {
    const v = { ...EXAMPLE_VALUES };
    const flag = (changes: Partial<typeof v>) => checkMeasurements({ ...v, ...changes }, 'cm', 'dress').filter((c) => c.level === 'warning').map((c) => c.id);
    expect(flag({ armscye: 30 })).toContain('armscye'); // the tape pulled tight
    expect(flag({ neck: 44 })).toContain('neck'); // round the throat over a collar
    expect(flag({ shoulder_length: 18 })).toContain('shoulder_length'); // both shoulders
    expect(flag({ front_hps_to_waist: 38 })).toContain('front_hps_to_waist'); // shorter than the back
    expect(flag({ waist_to_knee: 70 })).toContain('waist_to_knee');
    expect(flag({ arm_length: 74 })).toContain('arm_length'); // to the knuckles
    expect(flag({ wrist: 26, upper_arm: 29 })).toContain('wrist');
    expect(flag({ across_front: 41 })).toContain('across_front');
    // A skirt only checks the skirt's own measurements against each other.
    expect(checkMeasurements({ ...v, armscye: 30 }, 'cm', 'skirt').some((c) => c.id === 'armscye')).toBe(false);
  });
});
