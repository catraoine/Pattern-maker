import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { draftDress } from './dress';
import { dressGuide, sewingGuide } from './instructions';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { dressFlat, skirtFlat } from './flat';
import { skirtSpec } from './spec';
import { SLIT, slitOf } from './slit';
import { describePattern } from '../screens/describe';
import { DEFAULT_BODICE } from '../garments';

const marked = (pcs: { labels: { text: string }[] }[]) => pcs.filter((pc) => pc.labels.some((l) => l.text === 'SLIT ENDS')).length;
const ascii = (g: { steps: { title: string; text: string }[] }) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text));

describe('slit', () => {
  it('goes at the back, the side or the front, on 30 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let s = 1; s <= 30; s++) {
      const m = randomBody(rng(s));
      const silhouette = (['pencil', 'straight', 'a_line'] as const)[s % 3];
      const length = (['knee', 'midi', 'maxi'] as const)[s % 3];
      for (const slit of ['back', 'side', 'front'] as const) {
        const d = draftSkirt(m, { silhouette, length, slit, slitCm: 25 });
        expect(d.slit?.at).toBe(slit);
        expect(d.slit!.cm).toBeLessThanOrEqual(d.lengthCm - m.waist_to_hip - SLIT.belowHip);
        const [front, back] = d.pieces;
        expect(marked([front, back])).toBe(slit === 'side' ? 2 : 1);
        if (slit === 'front') expect(front.cut).toBe('Cut 2 (1 pair)');
        else expect(front.cut).toMatch(/on fold/i);
        for (const c of checkPattern(d.pieces.filter((pc) => !pc.kind), { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${s} ${silhouette} ${slit}: ${c.label} ${c.detail}`);
        const dress = draftDress(m, { fit: 'regular' }, { silhouette, length, slit, slitCm: 25 });
        expect(dress.skirt.slit?.at).toBe(slit);
        for (const c of checkPattern(dress.pieces.filter((pc) => !pc.kind), { finishedWaist: dress.finishedWaist })) if (!c.ok) failures.push(`${s} dress ${slit}: ${c.label} ${c.detail}`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('keeps the walking slit unasked, and can be left out or set to a height', () => {
    const m = randomBody(rng(2));
    expect(draftSkirt(m, { silhouette: 'pencil', length: 'knee' }).slit).toMatchObject({ at: 'back', cm: SLIT.walking });
    expect(draftSkirt(m, { silhouette: 'a_line', length: 'knee' }).slit).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'pencil', length: 'knee', slit: 'none' }).slit).toBeUndefined();
    const high = draftSkirt(m, { silhouette: 'straight', length: 'maxi', slit: 'side', slitCm: 500 });
    expect(high.slit!.cm).toBe(high.slit!.range.max);
    expect(draftSkirt(m, { silhouette: 'straight', length: 'maxi', slit: 'side', slitCm: 1 }).slit!.cm).toBe(SLIT.min);
    // Fuller skirts, uneven hems and wraps take none.
    expect(slitOf({ silhouette: 'circle', length: 'knee', slit: 'side' })).toBeUndefined();
    expect(slitOf({ silhouette: 'straight', length: 'knee', slit: 'side', pleats: 'knife' })).toBeUndefined();
    expect(slitOf({ silhouette: 'straight', length: 'knee', slit: 'side', wrap: true })).toBeUndefined();
    // An elastic skirt's back is cut as a pair for a back slit.
    const elastic = draftSkirt(m, { silhouette: 'straight', length: 'midi', waist: 'elastic', slit: 'back' });
    expect(elastic.pieces[1].fold).toBeUndefined();
    // A shirt dress has no centre seam for a slit: only the side opens.
    const shirt = { ...DEFAULT_BODICE, closure: 'front_buttons' as const };
    expect(draftDress(m, shirt, { silhouette: 'straight', length: 'midi', slit: 'back' }).skirt.slit).toBeUndefined();
    expect(draftDress(m, shirt, { silhouette: 'straight', length: 'midi', slit: 'side' }).skirt.slit?.at).toBe('side');
  });

  it('is sewn open below its notch, and drawn, named and measured', () => {
    const m = randomBody(rng(5));
    for (const slit of ['back', 'side', 'front'] as const) {
      const d = draftSkirt(m, { silhouette: 'straight', length: 'midi', slit, slitCm: 30 });
      for (const lined of [false, true]) {
        const g = sewingGuide(d, { silhouette: 'straight', length: 'midi' }, 1.5, lined ? { liningM: 1 } : {});
        const text = g.steps.map((st) => st.text).join(' ');
        expect(text).toMatch(/SLIT ENDS notch/);
        expect(text).toMatch(/30 cm slit/);
        expect(text).not.toMatch(/too wide|walking slit/);
        if (lined) expect(text).toMatch(/lining's .* open below its SLIT ENDS notch/);
        expect(g.steps.map((st) => st.title)).toEqual([...new Set(g.steps.map((st) => st.title))]);
        if (slit === 'front') expect(g.steps.map((st) => st.title)).toContain('Sew the centre front');
        expect(ascii(g)).toEqual([]);
      }
      const dress = draftDress(m, { fit: 'regular' }, { silhouette: 'straight', length: 'midi', slit, slitCm: 30 });
      const dg = dressGuide(dress, { silhouette: 'straight', length: 'midi' }, 2.5, 1, {});
      expect(dg.steps.map((st) => st.text).join(' ')).toMatch(/30 cm slit/);
      expect(dg.steps.map((st) => st.text).join(' ')).not.toMatch(/too wide/);
      expect(ascii(dg)).toEqual([]);
      // The flat shows the slit opening at the hem: two lines meeting at its top.
      for (const f of [skirtFlat(d), dressFlat(dress)]) {
        const lines = f.views.flatMap((v) => v.lines.filter((l) => l.kind === 'seam' && l.pts.length === 2));
        expect(lines.filter((l) => lines.some((k) => k !== l && Math.abs(k.pts[0].x - l.pts[0].x) < 1e-6 && Math.abs(k.pts[0].y - l.pts[0].y) < 1e-6)).length).toBeGreaterThanOrEqual(2);
      }
      expect(skirtSpec(m, d).some((r) => /^Slit/.test(r.label))).toBe(true);
    }
    expect(describePattern({ fit: 'regular', silhouette: 'straight', length: 'maxi', slit: 'side' } as never)).toMatch(/with a side slit/);
    expect(describePattern({ fit: 'regular', silhouette: 'pencil', length: 'knee' } as never)).not.toMatch(/slit/);
  });
});
