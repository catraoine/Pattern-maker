import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { taggedLength } from './geometry';
import { OUTER_EASE, OUTER_LENGTHS, OuterKind, draftOuter } from './outerwear';
import { outerFlat } from './flat';
import { outerGuide } from './outerGuide';
import { EXAMPLE_VALUES } from '../measurements';

const m = EXAMPLE_VALUES as Parameters<typeof draftOuter>[0];

describe('jackets and coats', () => {
  it('drafts a jacket with its collar, facings, pockets and lining', () => {
    const d = draftOuter(m, { kind: 'jacket' });
    const names = d.pieces.map((pc) => pc.name);
    expect(names).toEqual(['Jacket front', 'Jacket back', 'Top sleeve', 'Under sleeve', 'Collar', 'Front facing', 'Patch pocket', 'Front lining', 'Back lining', 'Top sleeve lining', 'Under sleeve lining']);
    expect(d.finishedBust).toBe(m.full_bust! + OUTER_EASE.jacket.regular);
    expect(d.lapel).toBeDefined();
    expect(d.buttons.at.length).toBeGreaterThanOrEqual(2);
    // The collar's neck edge is the back neck and the front neck seam to the gorge.
    const collar = d.pieces.find((pc) => pc.name === 'Collar')!;
    const back = d.pieces.find((pc) => pc.name === 'Jacket back')!;
    const front = d.pieces.find((pc) => pc.name === 'Jacket front')!;
    expect(taggedLength(collar.outline, 'neck')).toBeCloseTo(taggedLength(back.outline, 'neck') + taggedLength(front.outline, 'neck'), 0);
    // The gorge sews collar to lapel: the same length on both.
    expect(taggedLength(collar.outline, 'gorge')).toBeCloseTo(taggedLength(front.outline, 'gorge'), 1);
  });

  it('cuts the facing and the lining to meet along one line', () => {
    const d = draftOuter(m, { kind: 'jacket' });
    const facing = d.pieces.find((pc) => pc.name === 'Front facing')!;
    const lining = d.pieces.find((pc) => pc.name === 'Front lining')!;
    expect(taggedLength(facing.outline, 'lining')).toBeCloseTo(taggedLength(lining.outline, 'lining'), 0);
  });

  it('makes a coat longer than its jacket, and flares an A-line', () => {
    const jacket = draftOuter(m, { kind: 'jacket', length: 'hip' });
    const coat = draftOuter(m, { kind: 'coat', length: 'knee', flare: 'straight' });
    const swing = draftOuter(m, { kind: 'coat', length: 'knee', flare: 'a_line' });
    expect(coat.lengthCm).toBeGreaterThan(jacket.lengthCm + 30);
    expect(swing.finishedHem).toBeGreaterThan(coat.finishedHem + 8);
  });

  it('cuts a two-piece sleeve whose seams match and whose crown fits the armhole', () => {
    const one = draftOuter(m, { kind: 'jacket', sleeve: 'fitted' });
    const two = draftOuter(m, { kind: 'jacket', sleeve: 'tailored' });
    const [top, under] = two.sleeve.pieces;
    expect([top.name, under.name]).toEqual(['Top sleeve', 'Under sleeve']);
    for (const seam of ['front-seam', 'back-seam']) expect(taggedLength(top.outline, seam)).toBeCloseTo(taggedLength(under.outline, seam), 1);
    // The two crowns together are the one-piece crown: the armhole and its ease are unchanged.
    expect(taggedLength(top.outline, 'armhole') + taggedLength(under.outline, 'armhole')).toBeCloseTo(taggedLength(one.sleeve.pieces[0].outline, 'armhole'), 0);
    expect(two.sleeve.elbowDart).toBeUndefined();
  });

  it('raises the shoulders and the sleeve crown for shoulder pads', () => {
    const none = draftOuter(m, { kind: 'jacket', pads: 'none' });
    const pads = draftOuter(m, { kind: 'jacket', pads: 'structured' });
    expect(pads.pads).toBe(1.2);
    // The shoulder points rise by the pad, front and back; the underarm stays where it was.
    expect(pads.base.armhole - none.base.armhole).toBeGreaterThan(1.6);
    expect(pads.base.armhole - none.base.armhole).toBeLessThan(3.2);
    expect(pads.sleeve.capHeight).toBeGreaterThan(none.sleeve.capHeight + 0.8);
  });

  it('cuts a vented back as a pair, with its lining to match, and no vent on a cropped jacket', () => {
    const d = draftOuter(m, { kind: 'coat', vent: 'centre' });
    const back = d.pieces.find((pc) => pc.name === 'Coat centre back')!;
    const lining = d.pieces.find((pc) => pc.name === 'Back lining')!;
    expect(back.cut).toBe('Cut 2 (1 pair)');
    expect(back.fold).toBeUndefined();
    expect(d.vent!.length).toBeGreaterThan(25);
    expect(taggedLength(lining.outline, 'vent')).toBeCloseTo(taggedLength(back.outline, 'vent'), 1);
    expect(lining.alternate?.label).toBe('RIGHT BACK LINING');
    expect(draftOuter(m, { kind: 'jacket', length: 'cropped', vent: 'centre' }).vent).toBeUndefined();
    expect(draftOuter(m, { kind: 'coat', vent: 'none' }).pieces.find((pc) => pc.name === 'Coat centre back')!.fold).toBeDefined();
  });

  it('makes welt pockets with their welt, facing and bags', () => {
    const d = draftOuter(m, { kind: 'jacket', pockets: 'welt' });
    const names = d.pieces.map((pc) => pc.name);
    expect(names).toEqual(expect.arrayContaining(['Welt', 'Pocket facing', 'Pocket bag']));
    expect(names).not.toContain('Patch pocket');
    expect(d.pocket?.kind).toBe('welt');
    const welt = d.pieces.find((pc) => pc.name === 'Welt')!;
    expect(taggedLength(welt.outline, 'welt') / 2).toBeCloseTo(d.pocket!.w, 1);
    expect(outerGuide(d, 2).steps.some((st) => st.title === 'Make the welt pockets')).toBe(true);
  });

  it('asks for the knee before making a coat', () => {
    const { waist_to_knee: _k, ...rest } = m;
    void _k;
    expect(() => draftOuter(rest, { kind: 'coat' })).toThrow(/waist to knee/);
  });

  it('drafts every style for 30 random bodies, passing every pattern check', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const r = rng(seed);
      const body = randomBody(r);
      const b = { ...body, ...randomArms(body, r), waist_to_knee: body.waist_to_knee ?? 58 };
      for (const kind of ['jacket', 'coat'] as OuterKind[]) {
        for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
          for (const shaping of ['darts', 'princess', 'boxy'] as const) {
            for (const front of ['single', 'double'] as const) {
              for (const collar of ['notched', 'stand', 'collarless'] as const) {
                const length = OUTER_LENGTHS[kind][(seed + collar.length) % 3];
                const k = seed + fit.length + shaping.length + front.length;
                const sleeve = (['tailored', 'fitted', 'straight'] as const)[k % 3];
                const pads = (['none', 'soft', 'structured'] as const)[(k + collar.length) % 3];
                const pockets = (['patch', 'welt', 'none'] as const)[(seed + collar.length + front.length) % 3];
                const vent = (['centre', 'none'] as const)[(seed + shaping.length) % 2];
                const style = { kind, fit, shaping, front, collar, length, sleeve, pads, pockets, vent };
                let d;
                try {
                  d = draftOuter(b, style);
                } catch (e) {
                  failures.push(`${seed} ${JSON.stringify(style)}: ${(e as Error).message}`);
                  continue;
                }
                const bad = checkPattern(d.pieces.filter((pc) => !pc.kind || pc.kind === 'collar')).filter((c) => !c.ok);
                if (bad.length) failures.push(`${seed} ${JSON.stringify(style)}: ${bad.map((c) => `${c.label} ${c.detail ?? ''}`).join('; ')}`);
                for (const pc of d.pieces) if (pc.outline.points().some((q) => !Number.isFinite(q.x + q.y))) failures.push(`${seed} ${pc.name} not finite`);
                if (sleeve === 'tailored') {
                  const [top, under] = d.sleeve.pieces;
                  for (const seam of ['front-seam', 'back-seam'])
                    if (Math.abs(taggedLength(top.outline, seam) - taggedLength(under.outline, seam)) > 0.1) failures.push(`${seed} ${JSON.stringify(style)}: sleeve ${seam} differs`);
                }
                if (d.vent) {
                  const back = d.pieces.find((pc) => pc.meta.vent)!;
                  const lining = d.pieces.find((pc) => pc.name === 'Back lining')!;
                  if (Math.abs(taggedLength(back.outline, 'vent') - taggedLength(lining.outline, 'vent')) > 0.1) failures.push(`${seed} ${JSON.stringify(style)}: vent lining differs`);
                }
                if (seed <= 5) {
                  expect(outerFlat(d).views).toHaveLength(2);
                  expect(outerGuide(d, 2).steps.length).toBeGreaterThan(10);
                }
              }
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
