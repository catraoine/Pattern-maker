import { describe, expect, it } from 'vitest';
import { EXAMPLE_VALUES, FIELDS, checkMeasurements, crossChecks, isComplete, weightChecks } from './measurements';
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

describe('height and weight checks', () => {
  // Sample body A is 165 cm; about 62 kg goes with its bust, waist and hip.
  const body = { ...EXAMPLE_VALUES };
  const warn = (v: typeof body, weight?: number, form: 'womenswear' | 'menswear' = 'womenswear') =>
    checkMeasurements(v, 'cm', 'dress', form, { weight }).filter((c) => c.level === 'warning');

  it('drafts without a height, but asks for it first', () => {
    const { height, ...rest } = body;
    expect(height).toBe(165);
    expect(isComplete(rest, 'dress')).toBe(true);
    expect(checkMeasurements(rest, 'cm', 'dress')).toEqual([]);
    for (const g of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) expect(FIELDS[g][0].id).toBe('height');
  });

  it('stays quiet for a body whose numbers hang together, with or without the weight', () => {
    expect(warn(body)).toEqual([]);
    expect(warn(body, 62)).toEqual([]);
    expect(warn(body, 55)).toEqual([]);
    expect(warn(body, 70)).toEqual([]);
  });

  it('stays quiet for random bodies at a weight that fits them', () => {
    const r = rng(5);
    let flagged = 0;
    for (let i = 0; i < 500; i++) {
      const b = randomBody(r);
      const height = b.waist_to_floor / 0.615;
      // The weight a body with these girths usually has, give or take a few kilos.
      const bmi = ((b.full_bust + b.waist + b.full_hip) / 3 - 40.7) / 2.17;
      const weight = bmi * (height / 100) ** 2 * (0.94 + 0.12 * r());
      if (crossChecks({ ...b, height }).length || weightChecks({ ...b, height }, weight).length) flagged++;
    }
    // Random bodies run to shapes rarer than the checks are tuned for, so a few of them are asked to double-check.
    expect(flagged).toBeLessThan(35);
  });

  it('catches a length that is off for the height', () => {
    expect(warn({ ...body, nape_to_waist: 55 }).map((c) => c.id)).toContain('nape_to_waist');
    expect(warn({ ...body, arm_length: 48 }).map((c) => c.id)).toContain('arm_length');
    expect(warn({ ...body, waist_to_floor: 85 }).map((c) => c.id)).toContain('waist_to_floor');
  });

  it('catches a height typed in the wrong unit', () => {
    expect(checkMeasurements({ ...body, height: 65 }, 'cm', 'dress').some((c) => c.id === 'height' && c.level === 'error')).toBe(true);
  });

  it('catches one girth that does not match the height and weight, and says which', () => {
    const ids = warn({ ...body, waist: 108 }, 62).map((c) => c.id);
    expect([...new Set(ids)]).toEqual(['waist']);
    expect(warn({ ...body, full_hip: 135 }, 62).map((c) => c.id)).toEqual(['full_hip']);
    // Without the weight there is nothing to read the waist against, so nothing is said of it.
    expect(warn({ ...body, waist: 108 }).filter((c) => /height and weight/.test(c.message))).toEqual([]);
  });

  it('blames the height and weight when every girth is off the same way', () => {
    const out = warn(body, 100);
    expect(out.map((c) => c.id)).toEqual(['height']);
    expect(out[0].message).toMatch(/height and weight/);
    // A weight in the wrong unit (pounds typed as kg) reads as impossible with the height.
    expect(warn(body, 30)[0].message).toMatch(/wrong unit/);
  });

  it('reads the menswear form against menswear proportions', () => {
    const man = { ...body, height: 178, full_bust: 100, waist: 88, full_hip: 100 };
    expect(warn(man, 78, 'menswear')).toEqual([]);
    expect(warn({ ...man, waist: 58 }, 78, 'menswear').map((c) => c.id)).toEqual(['waist']);
  });

  it('never judges the body: the words are about the measurement', () => {
    for (const c of [...warn({ ...body, waist: 108 }, 62), ...warn(body, 100), ...warn({ ...body, nape_to_waist: 55 })]) {
      expect(c.message).not.toMatch(/overweight|underweight|obese|slim|fat|thin|BMI/i);
    }
  });
});
