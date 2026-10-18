import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { cutLine } from './piece';
import { checkPattern } from './qc';
import { rng } from './randomBodies';
import { CROTCH_SHARE, GUSSET, LENGTH_REDUCTION, LINGERIE_EASE, LegCut, LingeriePiece, draftLingerie, isSwim } from './lingerie';

const EX = { full_bust: 92, underbust: 76, apex_separation: 18, bust_depth: 25, waist: 76, full_hip: 102, waist_to_hip: 20.5, crotch_length: 70, nape_to_waist: 41, neck: 35, shoulder_width: 38 };
const PIECES: LingeriePiece[] = ['brief', 'bralette', 'bodysuit', 'swimsuit', 'bikini'];
const LEGS: LegCut[] = ['classic', 'high'];

describe('soft lingerie and swimwear', () => {
  it('cuts every piece smaller than the body, swimwear closest', () => {
    for (const piece of PIECES) {
      const d = draftLingerie(EX, { piece });
      expect(d.finishedHip).toBeLessThan(EX.full_hip);
      expect(d.easePct).toBe(isSwim(piece) ? LINGERIE_EASE.high : LINGERIE_EASE.medium);
      if (d.finishedBust) expect(d.finishedBust).toBeLessThan(EX.full_bust);
      if (d.finishedBand) expect(d.finishedBand).toBeLessThan(EX.underbust);
    }
    expect(draftLingerie(EX, { piece: 'swimsuit' }).finishedHip).toBeLessThan(draftLingerie(EX, { piece: 'bodysuit' }).finishedHip);
    expect(draftLingerie(EX, { piece: 'brief', stretch: 'high' }).finishedHip).toBeLessThan(draftLingerie(EX, { piece: 'brief', stretch: 'medium' }).finishedHip);
  });

  it('shortens swimwear down the body more than jersey', () => {
    const body = draftLingerie(EX, { piece: 'bodysuit' });
    const swim = draftLingerie(EX, { piece: 'swimsuit' });
    expect(swim.lengthReduction).toBe(LENGTH_REDUCTION.swim);
    expect(body.lengthReduction).toBe(LENGTH_REDUCTION.knit);
    const height = (pcs: typeof body.pieces) => {
      const ys = pcs[0].outline.points().map((q) => q.y);
      return Math.max(...ys);
    };
    expect(height(swim.pieces)).toBeLessThan(height(body.pieces) - 3);
  });

  it('shares the crotch length out between front, gusset and back, and the gusset meets both', () => {
    for (const piece of ['brief', 'bodysuit', 'swimsuit', 'bikini'] as LingeriePiece[])
      for (const leg of LEGS) {
        const d = draftLingerie(EX, { piece, leg });
        const front = d.pieces.find((pc) => / front$/.test(pc.name))!;
        const back = d.pieces.find((pc) => / back$/.test(pc.name))!;
        const gusset = d.pieces.find((pc) => pc.name === 'Gusset')!;
        expect(taggedLength(front.outline, 'gusset')).toBeCloseTo(GUSSET.front / 2, 5);
        expect(taggedLength(back.outline, 'gusset')).toBeCloseTo(GUSSET.back / 2, 5);
        const ends = gusset.outline.points().filter((q) => q.x < 1e-6).map((q) => q.y);
        const len = Math.max(...ends) - Math.min(...ends);
        expect(len).toBeCloseTo(EX.crotch_length * CROTCH_SHARE.gusset * (1 - d.lengthReduction), 5);
        expect(gusset.cut).toMatch(/Cut 2/);
      }
  });

  it('sews front to back at the same side and shoulder lengths', () => {
    for (const piece of ['brief', 'bodysuit', 'swimsuit'] as LingeriePiece[])
      for (const leg of LEGS) {
        const d = draftLingerie(EX, { piece, leg });
        const bad = checkPattern(d.pieces).filter((c) => !c.ok);
        expect(bad, `${piece} ${leg}: ${bad.map((c) => c.detail).join('; ')}`).toEqual([]);
      }
  });

  it('cuts a high leg higher at the side, with a longer leg opening', () => {
    for (const piece of ['brief', 'swimsuit'] as LingeriePiece[]) {
      const classic = draftLingerie(EX, { piece, leg: 'classic' });
      const high = draftLingerie(EX, { piece, leg: 'high' });
      const sideOf = (d: typeof classic) => taggedLength(d.pieces.find((pc) => / front$/.test(pc.name))!.outline, 'side');
      expect(sideOf(high)).toBeLessThan(sideOf(classic));
      const legOf = (d: typeof classic) => d.elastic.find((e) => e.edge === 'Each leg')!.length;
      expect(legOf(high)).toBeGreaterThan(legOf(classic));
    }
  });

  it('works out elastic shorter than every edge it is sewn to', () => {
    for (const piece of PIECES) {
      const d = draftLingerie(EX, { piece });
      expect(d.elastic.length).toBeGreaterThan(0);
      for (const e of d.elastic) expect(e.length).toBeGreaterThan(5);
      const band = d.elastic.find((e) => e.edge === 'Under the band');
      if (band) expect(band.length).toBeLessThan(EX.underbust);
      const waist = d.elastic.find((e) => e.edge === 'Waist');
      if (waist) expect(waist.length).toBeLessThan(EX.waist);
    }
  });

  it('sizes the bralette cup from the bust over the underbust', () => {
    const cupOf = (m: typeof EX) => {
      const cup = draftLingerie(m, { piece: 'bralette' }).pieces.find((pc) => /cup/i.test(pc.name))!;
      const pts = cup.outline.points();
      return { w: Math.max(...pts.map((q) => q.x)), h: Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y)) };
    };
    const small = cupOf({ ...EX, full_bust: 84 });
    const big = cupOf({ ...EX, full_bust: 104 });
    expect(big.w).toBeGreaterThan(small.w + 3);
    expect(big.h).toBeGreaterThan(small.h + 6);
    const longline = draftLingerie(EX, { piece: 'bralette', cup: 'longline' }).pieces.find((pc) => /band/i.test(pc.name))!;
    const triangle = draftLingerie(EX, { piece: 'bralette', cup: 'triangle' }).pieces.find((pc) => /band/i.test(pc.name))!;
    expect(taggedLength(longline.outline, 'cb')).toBeGreaterThan(taggedLength(triangle.outline, 'cb'));
  });

  it('says what is missing, and drafts closed, sensible outlines for many bodies', () => {
    expect(() => draftLingerie({ ...EX, underbust: undefined }, { piece: 'bralette' })).toThrow(/missing/);
    expect(() => draftLingerie({ ...EX, crotch_length: undefined }, { piece: 'brief' })).toThrow(/missing/);
    expect(() => draftLingerie({ ...EX, underbust: undefined }, { piece: 'brief' })).not.toThrow();
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const hip = 86 + r() * 40;
      const waist = hip - 12 - r() * 22;
      const bust = 80 + r() * 40;
      const m = { ...EX, full_hip: hip, waist, full_bust: bust, underbust: bust - 6 - r() * 20, crotch_length: 60 + r() * 22, nape_to_waist: 37 + r() * 8 };
      for (const piece of PIECES)
        for (const leg of LEGS) {
          const d = draftLingerie(m, { piece, leg });
          for (const pc of d.pieces) {
            expect(pc.outline.closed).toBe(true);
            for (const q of [...pc.outline.points(), ...cutLine(pc)]) {
              expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
              expect(q.x).toBeGreaterThan(-1.5);
            }
          }
        }
    }
  });
});
