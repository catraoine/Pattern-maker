import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { draftSleeve } from './sleeve';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { CUFF, cuffAllowed } from './cuffs';
import { bodiceGuide } from './instructions';
import { bodiceFlat } from './flat';
import { sleeveSpec } from './spec';
import { describeBodice } from '../garments';
import { DEFAULT_BODICE } from '../garments';

const body = { full_bust: 92, high_bust: 86, waist: 76, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40 };
const arms = { arm_length: 59, upper_arm: 29, wrist: 16 };
const style = { seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 };
const ascii = (g: { steps: { title: string; text: string }[] }) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text));

describe('cuffs', () => {
  it('drafts each cuff on 30 random bodies, the sleeve seams and crown still matching', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const r = rng(seed);
      const b = randomBody(r);
      const a = randomArms(b, r);
      const bd = draftBodice(b, { fit: 'regular' });
      for (const shape of ['straight', 'bishop'] as const)
        for (const length of ['elbow', 'three_quarter', 'long'] as const)
          for (const cuff of ['shirt', 'elastic', 'tie'] as const) {
            if (!cuffAllowed(cuff, length, shape)) continue;
            if (shape === 'bishop' && length === 'elbow') continue;
            const d = draftSleeve(bd, a, { ...style, length, shape, fit: 'regular', cuff });
            expect(d.cuff?.kind).toBe(cuff);
            // The hem gathers into the cuff, or passes the hand for elastic.
            expect(d.gathers!.hem).toBeGreaterThan(cuff === 'elastic' ? 2 : 4);
            expect(d.hemCm).toBe(d.cuff!.round);
            for (const c of checkPattern([...bd.pieces, ...d.pieces]).filter((c) => /Sleeve/.test(c.label)))
              if (!c.ok) failures.push(`seed ${seed} ${length} ${shape} ${cuff}: ${c.label} (${c.detail})`);
          }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('cuts a shirt cuff and placket, a tie band and slit, and elastic; and ends the sleeve at the same place', () => {
    const b = draftBodice(body);
    const plain = draftSleeve(b, arms, { ...style, length: 'long', shape: 'straight', fit: 'regular' });
    const shirt = draftSleeve(b, arms, { ...style, length: 'long', shape: 'straight', fit: 'regular', cuff: 'shirt' });
    expect(shirt.pieces.map((pc) => pc.name)).toEqual(['Sleeve', 'Cuff', 'Sleeve placket']);
    expect(shirt.cuff!.round).toBe(arms.wrist + CUFF.shirt.ease);
    // The sleeve stops short by the cuff, less the blousing.
    expect(shirt.lengthCm).toBeCloseTo(plain.lengthCm - CUFF.shirt.depth + CUFF.blouse, 0);
    expect(shirt.pieces[0].labels.some((l) => l.text === 'PLACKET')).toBe(true);
    const tie = draftSleeve(b, arms, { ...style, length: 'three_quarter', shape: 'bishop', fit: 'regular', cuff: 'tie' });
    expect(tie.pieces.map((pc) => pc.name)).toEqual(['Sleeve', 'Tie cuff']);
    expect(tie.vent?.lengthCm).toBe(CUFF.tie.slit);
    const elastic = draftSleeve(b, arms, { ...style, length: 'elbow', shape: 'straight', fit: 'regular', cuff: 'elastic' });
    expect(elastic.pieces.map((pc) => pc.name)).toEqual(['Sleeve']);
    expect(elastic.pieces[0].allowances.hem).toBe(CUFF.elastic.depth + 0.5);
    // Sleeves that can't take one keep their own hem.
    expect(draftSleeve(b, arms, { ...style, length: 'short', shape: 'puff', fit: 'regular', cuff: 'shirt' }).cuff).toBeUndefined();
    expect(draftSleeve(b, arms, { ...style, length: 'long', shape: 'fitted', fit: 'regular', cuff: 'tie' }).cuff).toBeUndefined();
    expect(cuffAllowed('shirt', 'three_quarter', 'straight')).toBe(false);
  });

  it('gathers a ruffle onto the plain hem of a straight sleeve, any length, keeping where it ends', () => {
    const b = draftBodice(body);
    for (const length of ['short', 'elbow', 'three_quarter', 'long'] as const) {
      const plain = draftSleeve(b, arms, { ...style, length, shape: 'straight', fit: 'regular' });
      const sl = draftSleeve(b, arms, { ...style, length, shape: 'straight', fit: 'regular', cuff: 'ruffle' });
      const c = sl.cuff!;
      expect(c.kind).toBe('ruffle');
      expect(sl.lengthCm).toBeCloseTo(plain.lengthCm - c.depth, 0);
      expect(sl.gathers).toBeUndefined();
      const strip = sl.pieces.find((pc) => pc.name === 'Sleeve ruffle')!;
      expect(strip.meta.lengthCm).toBeCloseTo(c.round * CUFF.ruffle.ratio, 0);
      expect(checkPattern([...b.pieces, ...sl.pieces]).filter((x) => !x.ok)).toEqual([]);
      const g = bodiceGuide(b, { length: 'waist' }, 1.5, 1, { sleeve: sl });
      expect(g.steps.map((s) => s.title)).toContain('Attach the sleeve ruffles');
      expect(ascii(g)).toEqual([]);
      expect(bodiceFlat(b, 'binding', sl).views[0].sleeves?.length).toBe(4);
    }
    expect(cuffAllowed('ruffle', 'short', 'puff')).toBe(false);
  });

  it('is sewn, drawn, measured and named', () => {
    const b = draftBodice(body);
    for (const cuff of ['shirt', 'elastic', 'tie'] as const) {
      const sl = draftSleeve(b, arms, { ...style, length: 'long', shape: 'straight', fit: 'regular', cuff });
      for (const edges of ['binding', 'lined'] as const) {
        const g = bodiceGuide(b, { length: 'waist' }, 1.5, 1, { edges, sleeve: sl });
        const titles = g.steps.map((s) => s.title);
        expect(titles).toEqual([...new Set(titles)]);
        expect(ascii(g)).toEqual([]);
        expect(titles).toContain(cuff === 'shirt' ? 'Attach the cuffs' : cuff === 'tie' ? 'Attach the tie cuffs' : 'Make the elastic casings');
        expect(titles).not.toContain('Hem the sleeves');
        if (cuff === 'shirt') expect(titles.indexOf('Bind the plackets')).toBeLessThan(titles.indexOf('Sew the sleeve seams'));
        if (cuff === 'shirt') expect(g.notions.some((n) => /cuff buttons/.test(n))).toBe(true);
        if (cuff === 'elastic') expect(g.notions.some((n) => /elastic/.test(n))).toBe(true);
      }
      const flat = bodiceFlat(b, 'binding', sl);
      expect(flat.views[0].sleeves?.length).toBe(4);
      expect(sleeveSpec(arms, sl).some((r) => /cuff/i.test(r.label))).toBe(true);
    }
    expect(describeBodice({ ...DEFAULT_BODICE, sleeve: 'long', sleeveShape: 'bishop', sleeveCuff: 'shirt' })).toMatch(/long bishop sleeves with shirt cuffs/);
    expect(describeBodice({ ...DEFAULT_BODICE, sleeve: 'short', sleeveShape: 'straight', sleeveCuff: 'ruffle' })).toMatch(/short sleeves with ruffled hems/);
    // A cuff a short sleeve can't take isn't named.
    expect(describeBodice({ ...DEFAULT_BODICE, sleeve: 'short', sleeveShape: 'straight', sleeveCuff: 'tie' })).not.toMatch(/cuff/);
  });
});
