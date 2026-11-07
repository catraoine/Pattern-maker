import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { KNIT_DRESS_LENGTHS, KNIT_DRESS_SKIRTS, KnitDressMeasurements, draftKnitDress, lengthBelowWaist } from './knitDress';
import { draftTee } from './tee';
import { HAND_CM, RIB_STRETCH } from './knitBands';

const EX: KnitDressMeasurements = { full_bust: 92, waist: 76, full_hip: 102, waist_to_hip: 20.5, neck: 35, shoulder_width: 38, nape_to_waist: 41, armscye: 40, arm_length: 59, upper_arm: 29, wrist: 16, waist_to_knee: 58, waist_to_floor: 104 };

/** Half the body's width at a level below the nape, from a piece's outline points. */
const widthAt = (pts: { x: number; y: number }[], y: number) => Math.max(...pts.filter((q) => Math.abs(q.y - y) < 0.8).map((q) => q.x));

describe('knit dress', () => {
  it('leaves the T-shirt as it was when nothing is carried on', () => {
    const a = draftTee(EX, {});
    const b = draftTee(EX, { carry: undefined });
    expect(b.finishedHem).toBe(a.finishedHem);
    expect(b.backLength).toBe(a.backLength);
  });

  it('drafts every skirt at every length, longer each time, with a pattern that checks out', () => {
    for (const skirt of KNIT_DRESS_SKIRTS) {
      let last = 0;
      for (const length of KNIT_DRESS_LENGTHS) {
        const d = draftKnitDress(EX, { skirt, length });
        expect(d.belowWaist).toBeGreaterThan(last);
        last = d.belowWaist;
        expect(checkPattern(d.pieces).filter((c) => !c.ok), `${skirt} ${length}`).toEqual([]);
      }
    }
  });

  it('passes the hip at its full width before the skirt hugs or flares', () => {
    for (const skirt of ['straight', 'hugging', 'aline'] as const)
      for (const stretch of ['low', 'medium', 'high'] as const) {
        const d = draftKnitDress(EX, { skirt, stretch, length: 'midi' });
        const hipY = EX.nape_to_waist + EX.waist_to_hip;
        const [front, back] = d.pieces;
        const round = 2 * (widthAt(front.outline.points(), hipY) + widthAt(back.outline.points(), hipY));
        // A fitted knit may be cut a few per cent under the hip; never more.
        expect(round, `${skirt} ${stretch}`).toBeGreaterThan(EX.full_hip * 0.9);
      }
  });

  it('narrows a hugging skirt only in a knit stretchy enough to walk in, and flares an A-line', () => {
    const hipQ = (d: ReturnType<typeof draftKnitDress>) => widthAt(d.pieces[0].outline.points(), EX.nape_to_waist + EX.waist_to_hip);
    const hemQ = (d: ReturnType<typeof draftKnitDress>) => Math.max(...d.pieces[0].outline.points().map((q) => q.x));
    const firm = draftKnitDress(EX, { skirt: 'hugging', stretch: 'low', length: 'midi' });
    const rib = draftKnitDress(EX, { skirt: 'hugging', stretch: 'high', length: 'midi' });
    const aline = draftKnitDress(EX, { skirt: 'aline', length: 'midi' });
    expect(hemQ(firm)).toBeGreaterThanOrEqual(hipQ(firm) - 0.2);
    expect(hemQ(rib)).toBeLessThanOrEqual(hemQ(firm));
    expect(hemQ(aline)).toBeGreaterThan(hipQ(aline) + 5);
  });

  it('sews the skater skirt to the bodice waist edge for edge, and the bodice is fitted in to the waist', () => {
    for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
      const d = draftKnitDress(EX, { skirt: 'skater', fit });
      const [front, back, sf, sb] = d.pieces;
      const bodice = taggedLength(front.outline, 'hem') + taggedLength(back.outline, 'hem');
      const skirt = taggedLength(sf.outline, 'waist') + taggedLength(sb.outline, 'waist');
      expect(Math.abs(bodice - skirt)).toBeLessThan(0.2);
      // The front's curve for the bust adds a little; a knit waist seam takes it.
      expect(2 * bodice).toBeLessThan(EX.waist * 1.15);
      expect(d.skater!.length).toBeCloseTo(lengthBelowWaist(EX, 'knee'), 0);
    }
  });

  it('cuts rib bands that pass the bust or hip and cuffs that pass the hand, the body shortened by the band', () => {
    const plain = draftKnitDress(EX, { sleeve: 'long', length: 'above_knee', fit: 'relaxed', stretch: 'low' });
    const d = draftKnitDress(EX, { sleeve: 'long', length: 'above_knee', fit: 'relaxed', stretch: 'low', ribbed: true });
    expect(d.belowWaist).toBe(plain.belowWaist);
    expect(d.bands!.hemBand! * RIB_STRETCH).toBeGreaterThan(EX.full_hip);
    expect(d.bands!.cuff! * RIB_STRETCH).toBeGreaterThanOrEqual(HAND_CM - 0.1);
    expect(d.pieces.filter((pc) => pc.meta.rib).map((pc) => pc.name)).toEqual(['Hem band', 'Cuff']);
    expect(checkPattern(d.pieces).filter((c) => !c.ok)).toEqual([]);
  });

  it('drafts on random bodies with every skirt, the pattern checking out', () => {
    for (let seed = 1; seed <= sweep(60); seed++) {
      const r = rng(seed);
      const b = randomBody(r);
      const body = { ...b, ...randomArms(b, r) } as KnitDressMeasurements;
      const skirt = KNIT_DRESS_SKIRTS[seed % 4];
      const length = KNIT_DRESS_LENGTHS[seed % 5];
      const d = draftKnitDress(body, { skirt, length, ribbed: seed % 3 === 0, sleeve: seed % 2 ? 'long' : 'short' });
      expect(checkPattern(d.pieces).filter((c) => !c.ok), `seed ${seed} ${skirt} ${length}`).toEqual([]);
    }
  });
});
