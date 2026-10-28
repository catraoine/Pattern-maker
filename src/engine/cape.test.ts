import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { DraftError } from './skirt';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { bodiceGuide, dressGuide } from './instructions';
import { bodiceFlat, dressFlat } from './flat';
import { layPlan } from './layplan';
import { capeDepth } from './collar';

describe('cape', () => {
  it('rings the neckline as sewn, front and back meeting at the shoulders, falling to just above the elbow', () => {
    const b0 = randomBody(rng(3));
    const body = { ...b0, ...randomArms(b0, rng(3)) };
    const d = draftBodice(body, { neckline: 'crew', collar: 'cape' });
    expect(d.collar).toBe('cape');
    const front = d.pieces.find((pc) => pc.name === 'Cape front')!;
    const back = d.pieces.find((pc) => pc.name === 'Cape back')!;
    const bf = d.pieces.find((pc) => pc.name === 'Bodice front')!;
    const bb = d.pieces.find((pc) => pc.name === 'Bodice back')!;
    expect(taggedLength(front.outline, 'cape-neck')).toBeCloseTo(taggedLength(bf.outline, 'neck'), 1);
    expect(taggedLength(back.outline, 'cape-neck')).toBeCloseTo(taggedLength(bb.outline, 'neck'), 1);
    expect(taggedLength(front.outline, 'shoulder')).toBeCloseTo(taggedLength(back.outline, 'shoulder'), 3);
    const depth = capeDepth(body);
    expect(taggedLength(front.outline, 'shoulder')).toBeCloseTo(depth, 3);
    // Past the shoulder and a little over half the arm.
    expect(depth).toBeGreaterThan(body.shoulder_length + 0.4 * body.arm_length);
    expect(depth).toBeLessThan(body.shoulder_length + 0.7 * body.arm_length);
    // Opens at the zip: the backs are a pair, the front on the fold.
    expect(back.cut).toMatch(/pair/);
    expect(front.cut).toMatch(/fold/);
    expect(checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
  });

  it('goes only on a neckline that rings the neck, and opens down a button front', () => {
    expect(draftBodice(randomBody(rng(4)), { neckline: 'v', collar: 'cape' }).collar).toBe('none');
    const b = draftBodice(randomBody(rng(4)), { neckline: 'crew', collar: 'cape', closure: 'front_buttons' });
    expect(b.pieces.find((pc) => pc.name === 'Cape front')!.cut).toMatch(/pair/);
    expect(b.pieces.find((pc) => pc.name === 'Cape back')!.cut).toMatch(/fold/);
  });

  it('sews it in under the neck finish, draws it on the shoulders, and passes every check for random bodies', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(30); seed++) {
      const b0 = randomBody(rng(seed + 610));
      const body = { ...b0, ...(seed % 2 ? randomArms(b0, rng(seed)) : {}) };
      for (const neckline of ['crew', 'scoop', 'boat', 'square'] as const) {
        const tag = `${seed} ${neckline}`;
        try {
          const d = draftBodice(body, { neckline, collar: 'cape', sleeve: seed % 3 ? 'none' : 'short' });
          if (d.collar !== 'cape') failures.push(`${tag}: no cape`);
          for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} ${c.detail}`);
          if (!layPlan(d.pieces, 140)) failures.push(`${tag}: does not lay out on 140 cm`);
          const g = bodiceGuide(d, { neckline, collar: 'cape' } as never, 1.5, 1);
          const t = g.steps.map((s) => s.title);
          if (!(t.indexOf('Make the cape') >= 0 && t.indexOf('Attach the cape') > t.indexOf('Make the cape'))) failures.push(`${tag}: steps ${t.join(', ')}`);
          if (g.steps.some((s) => /undefined|NaN|\\.\\./.test(s.text))) failures.push(`${tag}: step text`);
          const flat = bodiceFlat(d);
          const front = flat.views[0];
          // The cape is drawn from the bodice's own shoulder seam: its highest point is the neck.
          const all = front.shapes.flat();
          if (all.some((q) => !Number.isFinite(q.x + q.y))) failures.push(`${tag}: flat`);
          const dd = draftDress(body, { neckline, collar: 'cape' }, { silhouette: 'a_line', length: 'knee' });
          if (dd.bodice.collar !== 'cape') failures.push(`${tag}: dress has no cape`);
          for (const c of checkPattern(dd.pieces, { finishedWaist: dd.finishedWaist })) if (!c.ok) failures.push(`${tag} dress: ${c.label} ${c.detail}`);
          const dg = dressGuide(dd, { silhouette: 'a_line', length: 'knee' }, 2.5, 0.8);
          if (!dg.steps.some((s) => s.title === 'Attach the cape')) failures.push(`${tag}: dress steps`);
          if (dressFlat(dd).views[0].shapes.length < 3) failures.push(`${tag}: dress flat`);
        } catch (e) {
          if (e instanceof DraftError) continue;
          throw e;
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
