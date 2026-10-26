import { describe, expect, it } from 'vitest';
import { draftSkirt, Fit, Length, Silhouette } from './skirt';
import { draftDress } from './dress';
import { randomBody, rng, sweep } from './randomBodies';
import { checkPattern } from './qc';
import { layPlan } from './layplan';
import { sewingGuide, SewingGuide } from './instructions';
import { toCouture } from './couture';
import { DIAGRAMS } from './diagrams';
import { waistPieces } from './finishing';
import { cutAllowed, validCut } from './slip';
import { taggedLength } from "./geometry";
import type { AsymHem } from './asymHem';
import { describe as describeSkirt } from '../skirtChoices';
import { describePattern } from '../screens/describe';

const FITS: Fit[] = ['fitted', 'regular', 'relaxed'];
const HEMS: AsymHem[] = ['none', 'high_low', 'diagonal'];
const SLIP_LENGTHS: Length[] = ['knee', 'midi', 'maxi'];
const STRAIGHT: Silhouette[] = ['straight', 'pencil', 'a_line', 'trumpet', 'half_circle', 'circle'];
const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

const fails = (pieces: Parameters<typeof checkPattern>[0], finishedWaist?: number) =>
  checkPattern(pieces, { finishedWaist }).filter((c) => !c.ok).map((c) => `${c.label} ${c.detail ?? ''}`);

function sound(g: SewingGuide): string[] {
  const out: string[] = [];
  for (const s of g.steps) {
    if (/[^\x20-\x7e]/.test(s.title + s.text)) out.push(`${s.title}: not plain ASCII`);
    if (s.diagram && !DIAGRAMS[s.diagram]) out.push(`${s.title}: no diagram ${s.diagram}`);
    if (/\.\./.test(s.text)) out.push(`${s.title}: double full stop`);
  }
  if (new Set(g.steps.map((s) => s.title)).size !== g.steps.length) out.push('a step appears twice');
  return out;
}

const angle = (g: [{ x: number; y: number }, { x: number; y: number }]) => (Math.atan2(g[1].y - g[0].y, g[1].x - g[0].x) * 180) / Math.PI;

describe('the bias-cut slip skirt', () => {
  it('is cut whole, single layer, on the bias, with a faced waist and a side zip', () => {
    const d = draftSkirt(m, { silhouette: 'slip', length: 'midi' });
    expect(d.pieces.length).toBe(2);
    for (const pc of d.pieces) {
      expect(pc.cut).toBe('Cut 1, single layer, on the bias');
      expect(pc.meta.whole).toBeTruthy();
      expect(pc.meta.bias).toBe(true);
      expect(pc.meta.singleLayer).toBe(true);
      expect(Math.abs(angle(pc.grain!))).toBeCloseTo(45, 5);
    }
    expect(d.opening).toBe('left_side');
    expect(d.faced).toBe(true);
    expect(d.bias).toBe(true);
    // No darts: the shaping is in the side seams and the hem.
    expect(d.pieces.every((pc) => !pc.outline.taggedPoints(4).tags.some((t) => /dart/.test(t ?? '')))).toBe(true);
    const faces = waistPieces(d, 1.5);
    expect(faces.length).toBe(2);
    expect(faces.every((f) => /facing/i.test(f.name))).toBe(true);
  });

  it('has less hip ease than a straight skirt', () => {
    const slip = draftSkirt(m, { silhouette: 'slip', length: 'midi' });
    const straight = draftSkirt(m, { silhouette: 'straight', length: 'midi' });
    expect(slip.finishedHip).toBeLessThan(straight.finishedHip);
  });

  it('lays out rotated, unfolded, and takes more fabric than the straight grain', () => {
    const slip = draftSkirt(m, { silhouette: 'slip', length: 'midi' });
    const ls = layPlan([...slip.pieces, ...waistPieces(slip, 1.5)], 140)!;
    // The same pieces on the straight grain.
    const straight = slip.pieces.map((pc) => ({ ...pc, meta: { ...pc.meta, bias: false } }));
    const la = layPlan([...straight, ...waistPieces(slip, 1.5)], 140)!;
    expect(ls.bias).toBe(true);
    expect(ls.folded).toBe(false);
    expect(ls.metres).toBeGreaterThan(la.metres);
    expect(ls.metres).toBeLessThan(2.6);
  });

  it('falls back to knee at a short length, and drops a diagonal hem where it cannot be cut', () => {
    expect(validCut({ silhouette: 'slip', length: 'mini' }).length).toBe('knee');
    expect(validCut({ silhouette: 'circle', length: 'knee', asymHem: 'diagonal' }).asymHem).toBe('none');
    expect(validCut({ silhouette: 'pencil', length: 'knee', asymHem: 'diagonal' }).asymHem).toBe('none');
    expect(validCut({ silhouette: 'a_line', length: 'knee', asymHem: 'diagonal' }).asymHem).toBe('diagonal');
    expect(cutAllowed({ silhouette: 'slip', length: 'midi' }, 'asymHem', 'diagonal', 'dress')).toBe(false);
    expect(cutAllowed({ silhouette: 'slip', length: 'midi' }, 'length', 'mini')).toBe(false);
    // An invalid choice still drafts.
    expect(draftSkirt(m, { silhouette: 'slip', length: 'mini' }).pieces.length).toBe(2);
  });

  it('is sewn with stay-stitching, French seams, a hang before levelling and a rolled hem', () => {
    const d = draftSkirt(m, { silhouette: 'slip', length: 'midi', asymHem: 'high_low' });
    const g = sewingGuide(d, { silhouette: 'slip', length: 'midi' }, 1.7);
    const all = g.steps.map((s) => `${s.title} ${s.text}`).join(' ');
    expect(all).toMatch(/Stay-stitch/);
    expect(all).toMatch(/French seam/);
    expect(all).toMatch(/Hang the skirt up/);
    expect(all).toMatch(/rolled hem/i);
    expect(sound(g)).toEqual([]);
    for (const lined of [false, true]) {
      const c = toCouture(g, { garment: 'skirt', cloth: 'silk', lined, traced: true, zipCm: d.zipCm });
      expect(sound(c)).toEqual([]);
    }
  });

  it('is named plainly', () => {
    const base = { fit: 'regular' as Fit, silhouette: 'slip' as Silhouette, length: 'midi' as Length };
    expect(describeSkirt(base)).toBe('Midi bias-cut slip skirt');
    expect(describeSkirt({ ...base, asymHem: 'high_low' })).toBe('Midi bias-cut slip skirt with a high-low hem');
    expect(describeSkirt({ ...base, silhouette: 'a_line', length: 'knee', asymHem: 'diagonal' })).toMatch(/with a diagonal hem$/);
    expect(describePattern({ ...base, asymHem: 'high_low' })).toBe('Midi bias-cut slip skirt with a high-low hem');
  });
});

describe('stress: every cut and hem on random bodies', () => {
  it('passes QC for slips and asymmetric hems, every fit', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(12); seed++) {
      const body = randomBody(rng(seed * 7919));
      for (const fit of FITS) {
        const runs: { silhouette: Silhouette; length: Length; asymHem: AsymHem }[] = [];
        for (const length of SLIP_LENGTHS) for (const asymHem of HEMS) runs.push({ silhouette: 'slip', length, asymHem });
        for (const silhouette of STRAIGHT) for (const asymHem of ['high_low', 'diagonal'] as AsymHem[]) runs.push({ silhouette, length: seed % 2 ? 'knee' : 'midi', asymHem });
        for (const s of runs) {
          const tag = `${seed} ${fit} ${s.silhouette} ${s.length} ${s.asymHem}`;
          let d;
          try {
            d = draftSkirt(body, { fit, ...s });
          } catch (e) {
            failures.push(`${tag}: threw ${(e as Error).message}`);
            continue;
          }
          for (const f of fails(d.pieces, d.finishedWaist)) failures.push(`${tag}: ${f}`);
          const v = validCut(s);
          const whole = v.silhouette === 'slip' || v.asymHem === 'diagonal';
          if (whole !== d.pieces.every((pc) => !!pc.meta.whole)) failures.push(`${tag}: whole pieces wrong`);
          if (v.silhouette === 'slip' && !d.pieces.every((pc) => Math.abs(Math.abs(angle(pc.grain!)) - 45) < 0.01)) failures.push(`${tag}: grain not at 45`);
          for (const w of [115, 140, 150] as const) {
            const lay = layPlan([...d.pieces, ...waistPieces(d, 1.5)], w);
            // Only a piece about as wide as the cloth (turned to the bias for a slip, allowances added) leaves no lay.
            const across = Math.max(...d.pieces.map((pc) => {
              const xs = pc.outline.taggedPoints(8).pts.map((q) => (pc.meta.bias ? (q.x - q.y) / Math.SQRT2 : q.x));
              return (Math.max(...xs) - Math.min(...xs)) * (pc.fold ? 2 : 1);
            }));
            if (!lay && w !== 115 && across < w - 10) failures.push(`${tag}: no lay at ${w} (${across.toFixed(0)} across)`);
            if (lay && whole && lay.folded) failures.push(`${tag}: whole pieces laid on a fold at ${w}`);
          }
          const g = sewingGuide(d, v, 2);
          for (const f of sound(g)) failures.push(`${tag}: ${f}`);
          for (const f of sound(toCouture(g, { garment: 'skirt', cloth: 'silk', lined: seed % 2 === 0, traced: true, zipCm: d.zipCm }))) failures.push(`${tag} couture: ${f}`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 120_000);

  it('drafts a slip dress and high-low dresses that pass QC with the skirt matching the bodice', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= sweep(8); seed++) {
      const body = randomBody(rng(seed * 104729));
      for (const fit of FITS) {
        const runs: { silhouette: Silhouette; length: Length; asymHem: AsymHem }[] = [
          { silhouette: 'slip', length: 'midi', asymHem: 'none' },
          { silhouette: 'slip', length: 'maxi', asymHem: 'high_low' },
          { silhouette: 'slip', length: 'knee', asymHem: 'diagonal' },
          { silhouette: 'a_line', length: 'knee', asymHem: 'high_low' },
        ];
        for (const s of runs) {
          const tag = `${seed} ${fit} ${s.silhouette} ${s.length} ${s.asymHem}`;
          try {
            const d = draftDress(body, { fit }, { fit, ...s });
            for (const f of fails(d.pieces, d.finishedWaist)) failures.push(`${tag}: ${f}`);
            const bodiceWaist = taggedLength(d.bodice.pieces[0].outline, 'waist') + taggedLength(d.bodice.pieces[1].outline, 'waist');
            const sk = d.skirt.pieces.map((pc) => taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1));
            if (s.silhouette === 'slip' && Math.abs(sk[0] + sk[1] - bodiceWaist) > 4) failures.push(`${tag}: waist seams ${sk[0] + sk[1]} vs ${bodiceWaist}`);
          } catch (e) {
            failures.push(`${tag}: threw ${(e as Error).message}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
