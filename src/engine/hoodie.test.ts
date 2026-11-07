import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { HOODIE_FRONTS, HOODIE_LENGTHS, HOODIE_POCKETS, draftHoodie } from './hoodie';
import type { TeeMeasurements } from './tee';
import { HAND_CM, RIB_STRETCH } from './knitBands';

const EX: TeeMeasurements = { full_bust: 92, waist: 76, full_hip: 102, waist_to_hip: 20.5, neck: 35, shoulder_width: 38, nape_to_waist: 41, armscye: 40, arm_length: 59, upper_arm: 29, wrist: 16 };
const names = (d: ReturnType<typeof draftHoodie>) => d.pieces.map((pc) => pc.name);

describe('hoodie', () => {
  it('drafts every front, pocket and length with a pattern that checks out', () => {
    for (const front of HOODIE_FRONTS)
      for (const pocket of HOODIE_POCKETS)
        for (const length of HOODIE_LENGTHS) {
          const d = draftHoodie(EX, { front, pocket, length, hemBand: length !== 'cropped' });
          expect(checkPattern(d.pieces).filter((c) => !c.ok), `${front} ${pocket} ${length}`).toEqual([]);
        }
  });

  it('sizes the hood to the neckline: its two neck edges go round the whole neck', () => {
    for (const hood of ['standard', 'big'] as const) {
      const d = draftHoodie(EX, { hood });
      const h = d.pieces.find((pc) => pc.name === 'Hood')!;
      expect(2 * taggedLength(h.outline, 'neck')).toBeCloseTo(d.hood.neckCm, 0);
      expect(d.pieces.find((pc) => pc.name === 'Neckband')).toBeUndefined();
    }
    expect(draftHoodie(EX, { hood: 'big' }).hood.height).toBeGreaterThan(draftHoodie(EX).hood.height);
  });

  it('cuts the front in two for a zip-up, with a zip from neck to hem, and a facing for the half-zip', () => {
    const zip = draftHoodie(EX, { front: 'zip', pocket: 'split' });
    const front = zip.pieces.find((pc) => pc.name === 'Hoodie front')!;
    expect(front.cut).toBe('Cut 2 (1 pair)');
    expect(front.fold).toBeUndefined();
    expect(zip.zipCm).toBeGreaterThan(EX.nape_to_waist + EX.waist_to_hip - 15);
    expect(names(zip)).toContain('Pocket');
    const half = draftHoodie(EX, { front: 'half_zip', pocket: 'none' });
    expect(half.zipCm).toBe(18);
    expect(names(half)).toContain('Zip facing');
    expect(names(half)).not.toContain('Kangaroo pocket');
  });

  it('pulls on over the bust through the band, and the cuffs pass the hand', () => {
    for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
      const d = draftHoodie(EX, { fit });
      expect(d.bands.hemBand! * RIB_STRETCH).toBeGreaterThan(EX.full_bust);
      expect(d.bands.cuff! * RIB_STRETCH).toBeGreaterThanOrEqual(HAND_CM - 0.1);
    }
  });

  it('runs longer from cropped to long, and a cropped hoodie without a band has a turned hem', () => {
    const lens = HOODIE_LENGTHS.map((length) => draftHoodie(EX, { length }).belowWaist);
    expect(lens[1]).toBeGreaterThan(lens[0]);
    expect(lens[2]).toBeGreaterThan(lens[1]);
    const crop = draftHoodie(EX, { length: 'cropped', hemBand: false });
    expect(names(crop)).not.toContain('Hem band');
    expect(crop.pieces[0].allowances.hem).toBe(2.5);
  });

  it('drafts on random bodies, the pattern checking out', () => {
    for (let seed = 1; seed <= sweep(60); seed++) {
      const r = rng(seed);
      const b = randomBody(r);
      const d = draftHoodie({ ...b, ...randomArms(b, r) }, { front: HOODIE_FRONTS[seed % 3], pocket: HOODIE_POCKETS[seed % 3], length: HOODIE_LENGTHS[(seed >> 1) % 3], hood: seed % 2 ? 'big' : 'standard' });
      expect(checkPattern(d.pieces).filter((c) => !c.ok), `seed ${seed}`).toEqual([]);
    }
  });
});
