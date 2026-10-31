import { describe, expect, it } from 'vitest';
import { BodiceStyle, PLUNGE, draftBodice } from './bodice';
import { draftDress } from './dress';
import type { P } from './geometry';
import { taggedLength } from './geometry';
import { dartsOf } from './marks';
import type { Piece } from './piece';
import { checkPattern } from './qc';
import { randomBody, rng, sweep } from './randomBodies';
import { DEFAULT_BODICE, detailAllowed } from '../garments';

/** Even-odd test: is q inside the closed outline? */
function inside(pts: P[], q: P) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** The front's centre-front neck point and centre-front waist, as their heights. */
function cfDepths(front: Piece) {
  const pts = front.outline.points();
  const cf = pts.filter((q) => Math.abs(q.x) < 0.01);
  return { top: Math.min(...cf.map((q) => q.y)), bottom: Math.max(...cf.map((q) => q.y)) };
}

describe('the plunging V (In testing)', () => {
  it('runs past the bust, nearly to the waist, on narrow straps', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(40); seed++) {
      const b = randomBody(rng(seed));
      for (const fit of ['fitted', 'regular', 'relaxed'] as const)
        for (const back of ['plain', 'v'] as const) {
          const style: Partial<BodiceStyle> = { ...DEFAULT_BODICE, fit, neckline: 'plunge', sleeve: 'none', back, length: 'waist' } as Partial<BodiceStyle>;
          const tag = `${seed} ${fit} ${back}`;
          let d;
          try {
            d = draftBodice(b, style);
          } catch (e) {
            failures.push(`${tag}: ${(e as Error).message}`);
            continue;
          }
          const front = d.pieces.find((pc) => /front/i.test(pc.name) && !pc.kind)!;
          const v = draftBodice(b, { ...style, neckline: 'v' }).pieces.find((pc) => /front/i.test(pc.name) && !pc.kind)!;
          const { top } = cfDepths(front);
          if (!(top > cfDepths(v).top + 10)) failures.push(`${tag}: plunge ${top.toFixed(1)} not well below the V ${cfDepths(v).top.toFixed(1)}`);
          const strap = taggedLength(front.outline, 'shoulder');
          if (strap > PLUNGE.strap + 3 || strap < PLUNGE.strap - 0.1) failures.push(`${tag}: strap ${strap.toFixed(1)} cm`);
          const pts = front.outline.points();
          for (const dt of dartsOf(front)) if (!inside(pts, dt.tip)) failures.push(`${tag}: dart point outside the front`);
          const bad = checkPattern(d.pieces.filter((pc) => !pc.kind)).filter((c) => !c.ok);
          if (bad.length) failures.push(`${tag}: ${bad.map((c) => `${c.label} ${c.detail ?? ''}`).join('; ')}`);
          for (const pc of d.pieces) if (pc.outline.points().some((q) => !Number.isFinite(q.x + q.y))) failures.push(`${tag} ${pc.name} not finite`);
        }
    }
    expect(failures).toEqual([]);
  });

  it('cuts as a slip dress', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(20); seed++) {
      const b = { ...randomBody(rng(seed)) };
      const body = { ...b, waist_to_knee: b.waist_to_knee ?? 58, waist_to_floor: b.waist_to_floor ?? 105 };
      try {
        const d = draftDress(body, { neckline: 'plunge', sleeve: 'none', back: 'v' }, { silhouette: 'slip', length: 'maxi' });
        const bad = checkPattern(d.pieces.filter((pc) => !pc.kind)).filter((c) => !c.ok);
        if (bad.length) failures.push(`${seed}: ${bad.map((c) => `${c.label} ${c.detail ?? ''}`).join('; ')}`);
      } catch (e) {
        failures.push(`${seed}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('opens at the back, leaving no front to button', () => {
    const c = { ...DEFAULT_BODICE, neckline: 'plunge' as const };
    expect(detailAllowed(c, 'closure', 'front_buttons')).toBe(false);
    expect(detailAllowed(c, 'closure', 'back_zip')).toBe(true);
  });
});
