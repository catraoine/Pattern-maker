import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng, sweep } from './randomBodies';
import { BOXY_EASE, TANK, draftTee, type Stretch, type TeeFit } from './tee';
import { teeGuide } from './teeGuide';
import { teeFlat } from './flat';
import { teeSpec } from './spec';
import { layPlans } from './layplan';
import { DROP } from './sleeveCut';
import { describeTee, DEFAULT_TEE_CHOICES } from '../garments';

const EX = { full_bust: 92, waist: 76, full_hip: 102, waist_to_hip: 20.5, neck: 35, shoulder_width: 38, nape_to_waist: 41, armscye: 40, arm_length: 59, upper_arm: 29, wrist: 16 };
const FITS: TeeFit[] = ['fitted', 'regular', 'relaxed'];
const STRETCHES: Stretch[] = ['low', 'medium', 'high'];

describe('tank and boxy drop-shoulder T-shirts', () => {
  it('cuts a tank with no sleeve, a strap shoulder and two armhole bands a little shorter than the armhole', () => {
    const plain = draftTee(EX);
    const d = draftTee(EX, { sleeve: 'none' });
    expect(d.sleeveless).toBe(true);
    expect(d.pieces.map((pc) => pc.name)).toEqual(['Tee front', 'Tee back', 'Neckband', 'Armhole band']);
    expect(d.pieces[3].cut).toBe('Cut 2 on fold');
    expect(taggedLength(d.pieces[0].outline, 'shoulder')).toBeCloseTo(TANK.strap, 1);
    expect(d.armholeDepth).toBeCloseTo(plain.armholeDepth - TANK.raise, 0);
    expect(d.armBand!.length).toBeCloseTo(d.armhole * TANK.bandRatio, 0);
    expect(d.finishedBust).toBe(plain.finishedBust);
    expect(describeTee({ ...DEFAULT_TEE_CHOICES, sleeve: 'none' })).toBe('Crew-neck tank');
  });

  it('drops the shoulder past the shoulder point on a boxy, straight body with a flat-crowned sleeve', () => {
    const plain = draftTee(EX);
    const d = draftTee(EX, { shoulder: 'dropped' });
    expect(d.shoulder).toBe('dropped');
    expect(d.sleeve.cut).toBe('drop');
    expect(taggedLength(d.pieces[0].outline, 'shoulder')).toBeGreaterThan(taggedLength(plain.pieces[0].outline, 'shoulder') + DROP.out * 0.9);
    expect(d.armholeDepth).toBeGreaterThanOrEqual(plain.armholeDepth + DROP.down - 0.1);
    expect(d.easePct).toBe(BOXY_EASE.medium);
    // Straight from the underarm: the waist no narrower than the bust, on the way out to the hem.
    expect(d.finishedWaist).toBeGreaterThanOrEqual(d.finishedBust);
    expect(d.finishedWaist).toBeLessThanOrEqual(d.finishedHem);
    expect(d.armhole).toBeGreaterThanOrEqual(EX.armscye + DROP.room - 0.3);
    // A tank has no sleeve to drop the shoulder to: it stays a tank.
    expect(draftTee(EX, { shoulder: 'dropped', sleeve: 'none' }).shoulder).toBeUndefined();
  });

  it('leaves the T-shirt as it was without them', () => {
    expect(JSON.stringify(draftTee(EX, { shoulder: 'set_in' }))).toBe(JSON.stringify(draftTee(EX)));
  });

  it('passes every check for random bodies, every fit and stretch', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(60); seed++) {
      const r = rng(seed + 47000);
      const b = randomBody(r);
      const body = { ...b, ...randomArms(b, r), ...(seed % 3 === 0 ? { armscye: undefined } : {}) };
      for (const fit of FITS)
        for (const stretch of STRETCHES)
          for (const extra of [{ sleeve: 'none' as const }, { shoulder: 'dropped' as const, sleeve: (['short', 'elbow', 'long'] as const)[seed % 3] }]) {
            const style = { fit, stretch, ...extra };
            const d = draftTee(body, style);
            for (const c of checkPattern(d.pieces)) if (!c.ok) failures.push(`seed ${seed} ${JSON.stringify(style)}: ${c.label} (${c.detail})`);
            // (Broad shoulders over a small bust widen the bust on every tee: that note is the plain tee's own.)
            if (d.warnings.some((w) => !/^bust widened/.test(w))) failures.push(`seed ${seed} ${JSON.stringify(style)}: ${d.warnings.join('; ')}`);
          }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('makes a guide, flat, spec and lay for each', () => {
    for (const style of [{ sleeve: 'none' as const }, { shoulder: 'dropped' as const }]) {
      const d = draftTee(EX, style);
      const g = teeGuide(d, 1.2);
      const titles = g.steps.map((s) => s.title);
      expect(titles.includes('Bind the armholes')).toBe(!!d.sleeveless);
      expect(titles.includes('Sew in the sleeves')).toBe(!d.sleeveless);
      expect(teeFlat(d).views[0].shapes.length).toBeGreaterThan(0);
      expect(teeSpec(EX, d).length).toBeGreaterThan(5);
      expect(layPlans(d.pieces, 150, false, false, true)[0].metres).toBeGreaterThan(0.6);
    }
    expect(teeFlat(draftTee(EX, { sleeve: 'none' })).views[0].lines.length).toBeGreaterThan(teeFlat(draftTee(EX)).views[0].lines.length - 10);
  });
});
