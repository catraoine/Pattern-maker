import { describe, expect, it } from 'vitest';
import { bodiceFabrics, checkFabric, describeFabric, fabricLines, skirtFabrics, withFabric, withFabricEase } from './fabrics';
import type { Length, Silhouette } from './skirt';
import type { BodiceFit, Neckline } from './bodice';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { EXAMPLE_VALUES } from '../measurements';

const SILHOUETTES: Silhouette[] = ['pencil', 'straight', 'a_line', 'trumpet', 'half_circle', 'circle'];
const LENGTHS: Length[] = ['mini', 'above_knee', 'knee', 'midi', 'maxi'];
const FITS: BodiceFit[] = ['fitted', 'regular', 'relaxed'];
const NECKS: Neckline[] = ['crew', 'scoop', 'v', 'square', 'boat'];
const ascii = (s: string) => /^[\x20-\x7e]*$/.test(s);

describe('fabric advice', () => {
  it('suggests three fabrics, a lining and what to avoid for every skirt', () => {
    for (const silhouette of SILHOUETTES)
      for (const length of LENGTHS) {
        const a = skirtFabrics({ silhouette, length });
        expect(a.picks).toHaveLength(3);
        expect(a.avoid).toMatch(/stretch fabrics and knits/);
        expect(a.style).not.toMatch(/\ba above/);
        expect(a.lining.name).toMatch(/^Lining/);
      }
  });

  it('suggests three fabrics for every bodice, with a note for sharp or wide necklines', () => {
    for (const fit of FITS)
      for (const neckline of NECKS) {
        const a = bodiceFabrics({ fit, neckline });
        expect(a.picks).toHaveLength(3);
        expect(a.avoid).toMatch(/woven/);
        expect(!!a.note).toBe(neckline === 'square' || neckline === 'v' || neckline === 'boat');
      }
  });
});

describe('checking your fabric', () => {
  it('says nothing until a weight or drape is set', () => {
    expect(checkFabric({ garment: 'skirt', silhouette: 'a_line', length: 'midi' }, {})).toEqual([]);
  });

  it('calls a suggested fabric a good match', () => {
    const notes = checkFabric({ garment: 'skirt', silhouette: 'a_line', length: 'midi' }, { weight: 'medium', drape: 'crisp', fibre: 'linen' });
    expect(notes[0]).toEqual({ level: 'ok', text: 'Good match for a midi A-line.' });
    expect(notes[1].text).toMatch(/twice/);
  });

  it('warns about fluid cloth on a pencil skirt and on a fitted bodice', () => {
    expect(checkFabric({ garment: 'skirt', silhouette: 'pencil', length: 'knee' }, { drape: 'fluid' })[0].level).toBe('warn');
    expect(checkFabric({ garment: 'bodice', fit: 'fitted', neckline: 'crew' }, { drape: 'fluid' })[0].level).toBe('warn');
    expect(checkFabric({ garment: 'bodice', fit: 'relaxed', neckline: 'crew' }, { drape: 'fluid', weight: 'light' })[0].level).toBe('ok');
  });

  it('warns about heavy crisp cloth on a circle skirt', () => {
    expect(checkFabric({ garment: 'skirt', silhouette: 'circle', length: 'knee' }, { weight: 'heavy', drape: 'crisp' })[0].level).toBe('warn');
  });
});

describe('ease for the fabric', () => {
  const m = EXAMPLE_VALUES as never;

  it('adds ease only for heavy cloth, and only while it is turned on', () => {
    const base = draftSkirt(m, { silhouette: 'straight', length: 'knee' });
    const heavy = draftSkirt(m, { silhouette: 'straight', length: 'knee', fitting: withFabricEase({}, { weight: 'heavy' }, 'skirt') });
    const off = draftSkirt(m, { silhouette: 'straight', length: 'knee', fitting: withFabricEase({}, { weight: 'heavy', matchEase: false }, 'skirt') });
    const light = draftSkirt(m, { silhouette: 'straight', length: 'knee', fitting: withFabricEase({}, { weight: 'light' }, 'skirt') });
    expect(heavy.finishedHip - base.finishedHip).toBeCloseTo(1);
    expect(heavy.finishedWaist - base.finishedWaist).toBeCloseTo(0.5);
    expect(off.finishedHip).toBe(base.finishedHip);
    expect(light.finishedHip).toBe(base.finishedHip);
  });

  it('adds to the toile corrections rather than replacing them', () => {
    expect(withFabricEase({ hipEase: 2, frontDrop: 1 }, { weight: 'heavy' }, 'skirt')).toEqual({ hipEase: 3, waistEase: 0.5, frontDrop: 1 });
  });

  it('widens a heavy bodice at the bust and, below the waist, the hem', () => {
    const style = { length: 'hip' as const };
    const base = draftBodice(m, style);
    const heavy = draftBodice(m, { ...style, fitting: withFabricEase({}, { weight: 'heavy' }, 'bodice') });
    expect(heavy.finishedBust - base.finishedBust).toBeCloseTo(1);
    expect(heavy.finishedHem! - base.finishedHem!).toBeCloseTo(1);
  });
});

describe('fabric in the sewing guide', () => {
  const guide = { notions: ['1.6 m of woven fabric, 140 cm wide', 'Hook and eye'], steps: [{ title: 'Cut out', text: 'Cut it.' }] };

  it('always opens with preparing the fabric, once', () => {
    const g = withFabric(guide, undefined, 'skirt');
    expect(g.steps.map((s) => s.title)).toEqual(['Prepare your fabric', 'Cut out']);
    expect(withFabric(g, undefined, 'skirt').steps).toHaveLength(2);
    expect(g.notions[0]).toBe('1.6 m of woven fabric, 140 cm wide');
    expect(g.fabric).toEqual([]);
  });

  it('names the fabric in the notions and lists its details in plain ASCII for the PDF', () => {
    const f = { name: 'Olive washed linen', colour: 'olive', fibre: 'linen' as const, weight: 'heavy' as const, drape: 'crisp' as const };
    const g = withFabric(guide, f, 'bodice');
    expect(g.notions[0]).toBe('1.6 m of Olive washed linen, 140 cm wide');
    expect(g.fabric![0]).toBe('Fabric: Olive washed linen, olive');
    expect(g.fabric!.some((l) => l.startsWith('Ease:') && l.includes('bust'))).toBe(true);
    expect(g.steps[0].text).toMatch(/twice/);
    for (const l of [...g.fabric!, ...g.steps.map((s) => s.text)]) expect(ascii(l)).toBe(true);
    expect(fabricLines(f, 'skirt').find((l) => l.startsWith('Ease:'))).not.toMatch(/bust/);
  });

  it('describes a fabric with no name by its traits', () => {
    expect(describeFabric({ weight: 'medium', drape: 'crisp', fibre: 'linen' })).toBe('medium, crisp linen');
    expect(describeFabric({})).toBeUndefined();
  });
});
