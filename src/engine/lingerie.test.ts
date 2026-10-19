import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { cutLine } from './piece';
import { checkPattern } from './qc';
import { rng } from './randomBodies';
import { CROTCH_SHARE, GUSSET, HOOK_TAPE, LENGTH_REDUCTION, LINGERIE_EASE, LOOP_OVERLAP, LegCut, LingeriePiece, SEAMED_CUP_GAP, SNAP_OVERLAP, draftLingerie, isSwim, lingerieMissing } from './lingerie';

const EX = { full_bust: 92, underbust: 76, apex_separation: 18, bust_depth: 25, waist: 76, full_hip: 102, waist_to_hip: 20.5, crotch_length: 70, nape_to_waist: 41, neck: 35, shoulder_width: 38, torso_loop: 152 };
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
        // Cut whole: its front end is the front's crotch width doubled, its back end the back's.
        const ys = gusset.outline.points().map((q) => q.y);
        expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(EX.crotch_length * CROTCH_SHARE.gusset * (1 - d.lengthReduction), 5);
        expect(taggedLength(gusset.outline, 'gusset')).toBeCloseTo(GUSSET.front + GUSSET.back, 5);
        expect(gusset.cut).toMatch(/Cut 2/);
      }
  });

  it('sews front to back at the same side and shoulder lengths', () => {
    const bodies = [
      EX,
      { ...EX, full_bust: 84, underbust: 70, waist: 64, full_hip: 90 },
      { ...EX, full_bust: 104, underbust: 78, waist: 80, full_hip: 108 },
      { ...EX, full_bust: 118, underbust: 96, waist: 98, full_hip: 124, torso_loop: 170 },
      { ...EX, full_bust: 96, underbust: 74, waist: 66, full_hip: 112 },
      { ...EX, full_bust: 82, underbust: 68, waist: 94, full_hip: 118 },
    ];
    for (const body of bodies)
      for (const piece of ['brief', 'bodysuit', 'swimsuit'] as LingeriePiece[])
        for (const leg of LEGS) {
          const d = draftLingerie(body, { piece, leg });
          const bad = checkPattern(d.pieces).filter((c) => !c.ok);
          expect(bad, `${body.full_bust}/${body.underbust} ${piece} ${leg}: ${bad.map((c) => c.detail).join('; ')}`).toEqual([]);
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
      if (band) expect(band.length).toBeLessThan(d.finishedBand! - HOOK_TAPE);
      const waist = d.elastic.find((e) => e.edge === 'Waist');
      if (waist) expect(waist.length).toBeLessThan(EX.waist);
    }
  });

  it('sizes the bralette cup from the bust over the underbust', () => {
    const cupOf = (m: typeof EX) => {
      const pts = draftLingerie(m, { piece: 'bralette' }).pieces.filter((pc) => /cup/i.test(pc.name)).flatMap((pc) => pc.outline.points());
      return { w: Math.max(...pts.map((q) => q.x)), h: Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y)) };
    };
    const small = cupOf({ ...EX, full_bust: 84 });
    const big = cupOf({ ...EX, full_bust: 90 });
    expect(big.w).toBeGreaterThan(small.w + 1.5);
    expect(big.h).toBeGreaterThan(small.h + 3);
    const longline = draftLingerie(EX, { piece: 'bralette', cup: 'longline' }).pieces.find((pc) => /band/i.test(pc.name))!;
    const triangle = draftLingerie(EX, { piece: 'bralette', cup: 'triangle' }).pieces.find((pc) => /band/i.test(pc.name))!;
    expect(taggedLength(longline.outline, 'cb')).toBeGreaterThan(taggedLength(triangle.outline, 'cb'));
  });

  it('says what is missing, and drafts closed, sensible outlines for many bodies', () => {
    expect(() => draftLingerie({ ...EX, underbust: undefined }, { piece: 'bralette' })).toThrow(/missing/);
    expect(() => draftLingerie({ ...EX, crotch_length: undefined }, { piece: 'brief' })).toThrow(/missing/);
    expect(() => draftLingerie({ ...EX, underbust: undefined }, { piece: 'brief' })).not.toThrow();
    expect(lingerieMissing({ waist: 70, full_hip: 96, waist_to_hip: 20 }, 'brief')).toEqual(['crotch_length']);
    expect(lingerieMissing({ ...EX, torso_loop: undefined }, 'swimsuit')).toEqual(['torso_loop']);
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const hip = 86 + r() * 40;
      const waist = hip - 12 - r() * 22;
      const bust = 80 + r() * 40;
      const nape = 37 + r() * 8;
      const crotch = 60 + r() * 22;
      const m = { ...EX, full_hip: hip, waist, full_bust: bust, underbust: bust - 6 - r() * 20, crotch_length: crotch, nape_to_waist: nape, torso_loop: 2 * nape + crotch - 4 + r() * 12 };
      for (const piece of PIECES)
        for (const leg of LEGS) {
          const d = draftLingerie(m, { piece, leg });
          for (const pc of d.pieces) {
            expect(pc.outline.closed).toBe(true);
            for (const q of [...pc.outline.points(), ...cutLine(pc)]) {
              expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
              if (!/Gusset/.test(pc.name)) expect(q.x).toBeGreaterThan(-1.5);
            }
          }
        }
    }
  });

  it('cuts a seamed cup for a fuller bust, with a strap tab, and warns past a soft cup', () => {
    const small = draftLingerie({ ...EX, full_bust: 88 }, { piece: 'bralette' });
    expect(small.seamedCup).toBe(false);
    expect(small.pieces.filter((pc) => /cup/i.test(pc.name))).toHaveLength(1);
    const full = draftLingerie({ ...EX, full_bust: EX.underbust + SEAMED_CUP_GAP + 6 }, { piece: 'bralette' });
    expect(full.seamedCup).toBe(true);
    const [centre, side] = full.pieces.filter((pc) => /cup/i.test(pc.name));
    expect(taggedLength(centre.outline, 'cupseam')).toBeCloseTo(taggedLength(side.outline, 'cupseam'), 5);
    for (const pc of [centre, side]) expect(taggedLength(pc.outline, 'tab')).toBeCloseTo(0.75, 5);
    // The seam bows out round the bust point rather than running straight to it, like a dart.
    const ends = centre.outline.segs.map((sg) => sg.to);
    const apex = centre.notches[0][0];
    const at = ends.findIndex((q) => q.x === apex.x && q.y === apex.y);
    const straight = Math.hypot(apex.x - ends[at - 1].x, apex.y - ends[at - 1].y) + Math.hypot(ends[at + 1].x - apex.x, ends[at + 1].y - apex.y);
    expect(centre.outline.segs[at].kind).toBe('C');
    expect(taggedLength(centre.outline, 'cupseam')).toBeGreaterThan(straight + 0.15);
    expect(full.warnings).toEqual([]);
    expect(draftLingerie({ ...EX, full_bust: 112 }, { piece: 'bralette' }).warnings).toContain('soft cup');
  });

  it('cuts the band short for the hook tape and marks the cup end and back strap', () => {
    const d = draftLingerie(EX, { piece: 'bralette' });
    const band = d.pieces.find((pc) => /band/i.test(pc.name))!;
    expect(taggedLength(band.outline, 'top') * 2 + HOOK_TAPE).toBeCloseTo(d.finishedBand!, 1);
    expect(band.notches).toHaveLength(3);
    expect(band.labels.map((l) => l.text)).toEqual(expect.arrayContaining(['CUP ENDS', 'STRAP']));
    expect(d.elastic.filter((e) => /cup/.test(e.edge))).toHaveLength(2);
  });

  it('gives a fuller bust extra front length and a shelf, and fits the torso loop', () => {
    const plain = draftLingerie({ ...EX, full_bust: 86, underbust: 76 }, { piece: 'swimsuit' });
    const full = draftLingerie({ ...EX, full_bust: 104, underbust: 76 }, { piece: 'swimsuit' });
    const cf = (d: typeof plain) => taggedLength(d.pieces.find((pc) => / front$/.test(pc.name))!.outline, 'fold');
    const cb = (d: typeof plain) => taggedLength(d.pieces.find((pc) => / back$/.test(pc.name))!.outline, 'fold');
    // The torso loop is taken over the bust, so the extra goes to the front at the back's expense.
    expect(cf(full) - cb(full) - (cf(plain) - cb(plain))).toBeGreaterThan(2.5);
    expect(full.pieces.some((pc) => /shelf/.test(pc.name))).toBe(true);
    expect(full.elastic.some((e) => e.edge === 'Under the shelf')).toBe(true);
    const long = draftLingerie({ ...EX, torso_loop: 162 }, { piece: 'swimsuit' });
    const foot = (d: typeof plain) => Math.max(...d.pieces.find((pc) => / back$/.test(pc.name))!.outline.points().map((q) => q.y));
    const base = draftLingerie(EX, { piece: 'swimsuit' });
    const k = 1 - LENGTH_REDUCTION.swim;
    // The whole loop grows by the extra; on this fuller bust 3 cm of it goes to the front, the rest to both.
    const frontFoot = (d: typeof plain) => Math.max(...d.pieces.find((pc) => / front$/.test(pc.name))!.outline.points().map((q) => q.y));
    expect(frontFoot(long) + foot(long) - frontFoot(base) - foot(base)).toBeCloseTo(10 * k, 1);
    expect(foot(long) - foot(base)).toBeLessThan((10 * k) / 2 - 1);
    // The front is wider than the back at the bust, and the side seams still match.
    const xmax = (d: typeof plain, re: RegExp) => Math.max(...d.pieces.find((pc) => re.test(pc.name))!.outline.points().filter((q) => q.y < 25).map((q) => q.x));
    expect(xmax(full, / front$/) - xmax(full, / back$/)).toBeGreaterThan(3);
    const side = (d: typeof plain, re: RegExp) => taggedLength(d.pieces.find((pc) => re.test(pc.name))!.outline, 'side');
    expect(Math.abs(side(full, / front$/) - side(full, / back$/))).toBeLessThan(0.1);
    expect(draftLingerie({ ...EX, torso_loop: 200 }, { piece: 'swimsuit' }).warnings).toContain('torso loop');
  });

  it('adds the overlap to every loop, and snaps the bodysuit gusset in two overlapping halves', () => {
    const d = draftLingerie(EX, { piece: 'brief' });
    const legs = d.elastic.find((e) => e.edge === 'Each leg')!;
    expect(legs.count).toBe(2);
    expect(d.elastic.find((e) => e.edge === 'Waist')!.width).toBe(2);
    expect(LOOP_OVERLAP).toBe(1);
    const snapped = draftLingerie(EX, { piece: 'bodysuit', closure: 'snaps' });
    const halves = snapped.pieces.filter((pc) => /Gusset/.test(pc.name));
    expect(halves).toHaveLength(2);
    const span = (pc: (typeof halves)[0]) => { const ys = pc.outline.points().map((q) => q.y); return Math.max(...ys) - Math.min(...ys); };
    expect(span(halves[0]) + span(halves[1]) - SNAP_OVERLAP).toBeCloseTo(EX.crotch_length * CROTCH_SHARE.gusset * (1 - snapped.lengthReduction), 5);
  });

  it('cuts two-way stretch at full length, and moves the draft for each fit answer', () => {
    expect(draftLingerie(EX, { piece: 'brief', way: 'two' }).lengthReduction).toBe(0);
    const base = draftLingerie(EX, { piece: 'brief' });
    const snug = draftLingerie(EX, { piece: 'brief', tried: { size: 'snug' } });
    expect(snug.finishedHip).toBeGreaterThan(base.finishedHip);
    expect(snug.fitNotes).toEqual(['cut 3% roomier all round']);
    const gapes = draftLingerie(EX, { piece: 'brief', tried: { leg: 'gapes' } });
    expect(gapes.elastic.find((e) => e.edge === 'Each leg')!.length).toBeLessThan(base.elastic.find((e) => e.edge === 'Each leg')!.length);
    const rides = draftLingerie(EX, { piece: 'brief', tried: { back: 'rides' } });
    const backLen = (d: typeof base) => taggedLength(d.pieces.find((pc) => / back$/.test(pc.name))!.outline, 'fold');
    expect(backLen(rides)).toBeGreaterThan(backLen(base) + 1);
    expect(checkPattern(rides.pieces).filter((c) => !c.ok)).toEqual([]);
    const cupFull = draftLingerie(EX, { piece: 'bralette', tried: { cup: 'full' } });
    expect(cupFull.finishedBust).toBe(draftLingerie(EX, { piece: 'bralette' }).finishedBust);
    // Long enough to reach from the cup over the shoulder to the band, with the slider loop-back.
    expect(draftLingerie(EX, { piece: 'bralette' }).strap!).toBeGreaterThan(EX.nape_to_waist * 0.9 + 5);
    expect(draftLingerie(EX, { piece: 'bralette', tried: { straps: 'slip' } }).strap).toBeLessThan(draftLingerie(EX, { piece: 'bralette' }).strap!);
  });
});
