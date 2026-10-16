import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { randomBody, rng } from './randomBodies';
import { bodiceGuide, sewingGuide } from './instructions';
import { SEAM_WIDTHS } from './allowances';
import { CLOTHS, Cloth, seamFinish, toCouture } from './couture';
import { DIAGRAMS } from './diagrams';
import { draftSleeve } from './sleeve';
import type { SewingGuide } from './instructions';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const text = (g: SewingGuide) => g.steps.map((s) => s.text).join(' ');

/** Plain ASCII (the PDF's font), every diagram drawn, and no step twice. */
function sound(g: SewingGuide): string[] {
  const out: string[] = [];
  for (const s of g.steps) {
    if (/[^\x20-\x7e]/.test(s.title + s.text)) out.push(`${s.title}: not plain ASCII`);
    if (s.diagram && !DIAGRAMS[s.diagram]) out.push(`${s.title}: no diagram ${s.diagram}`);
    if (/\.\./.test(s.text)) out.push(`${s.title}: double full stop`);
  }
  if (new Set(titles(g)).size !== g.steps.length) out.push('a step appears twice');
  return out;
}

describe('the couture route', () => {
  it('picks the seam finish for the cloth, and whether it is lined', () => {
    expect(seamFinish('silk', false)).toBe('french');
    expect(seamFinish('wool', false)).toBe('hongkong');
    expect(seamFinish('linen', false)).toBe('hongkong');
    expect(seamFinish('wool', true)).toBe('pinked');
    expect(seamFinish('cotton', true)).toBe('pinked');
    expect(seamFinish('silk', true)).toBe('overcast');
    expect(seamFinish('linen', true)).toBe('overcast');
  });

  it('sews a wool skirt the couture way: traced, staystitched, fitted, the zip picked by hand', () => {
    const d = draftSkirt(m, { silhouette: 'straight' });
    const quick = sewingGuide(d, { silhouette: 'straight', length: 'knee' }, 1.2, { seams: SEAM_WIDTHS.couture });
    const g = toCouture(quick, { garment: 'skirt', cloth: 'wool', lined: false, traced: true, zipCm: d.zipCm });
    expect(sound(g)).toEqual([]);
    const t = titles(g);
    expect(t.slice(1, 6)).toEqual(['Cut out', 'Cut the waistband', 'Thread-trace the lines', 'Staystitch the curves', 'Press as you go']);
    expect(t).not.toContain('Neaten the edges');
    expect(t).not.toContain('Put in the zip');
    // The seam below the zip is sewn first, then the zip set by hand, all after the fitting.
    expect(t.indexOf('Baste and fit')).toBeLessThan(t.indexOf('Close the centre back'));
    expect(t.indexOf('Close the centre back')).toBe(t.indexOf('Hand-pick the zip') - 1);
    expect(t.indexOf('Finish the seams')).toBe(t.indexOf('Sew the side seams') + 1);
    expect(g.steps.find((s) => s.title === 'Finish the seams')!.diagram).toBe('hongkong');
    expect(g.steps.find((s) => s.title === 'Hem')!.diagram).toBe('catch');
    expect(text(g)).toContain('slash a deep dart');
    expect(text(g)).toContain('2.5 cm bias strip');
    expect(text(g)).not.toMatch(/invisible|Fuse|Try the skirt on now/);
    expect(text(g)).toContain('wool (about 150 C)');
    expect(text(g)).not.toContain('chalk-mark');
    expect(g.notions).toContain(`${d.zipCm} cm regular zip, to set by hand`);
    expect(g.notions.some((n) => /fusible/.test(n))).toBe(false);
  });

  it('sews silk with French seams and a hand-rolled hem on a circle skirt', () => {
    const d = draftSkirt(m, { silhouette: 'circle' });
    const quick = sewingGuide(d, { silhouette: 'circle', length: 'knee' }, 2, {});
    const g = toCouture(quick, { garment: 'skirt', cloth: 'silk', lined: false, traced: false, zipCm: d.zipCm });
    expect(sound(g)).toEqual([]);
    const side = g.steps.find((s) => s.title === 'Sew the side seams')!;
    expect(side.diagram).toBe('french');
    expect(titles(g)).toContain('Finish the centre back');
    expect(g.steps.find((s) => s.title === 'Hem')!.text).toContain('hand-rolled');
    expect(text(g)).toContain('choose Couture seam allowances');
  });

  it('rewrites every bodice finish, in every cloth', () => {
    const d = draftBodice(randomBody(rng(4)), { length: 'hip' });
    for (const edges of ['binding', 'facings', 'lined'] as const)
      for (const { id } of CLOTHS) {
        const quick = bodiceGuide(d, { length: 'hip' }, 1.2, 2, { edges, seams: SEAM_WIDTHS.couture });
        const g = toCouture(quick, { garment: 'bodice', cloth: id as Cloth, lined: edges === 'lined', traced: true, zipCm: d.zipCm });
        expect(sound(g), `${edges} ${id}`).toEqual([]);
        const all = text(g);
        expect(all).not.toMatch(/invisible|Fuse the interfacing|stitch it down close|from fusible interfacing/);
        if (edges !== 'binding') expect(all).not.toMatch(/Trim to 0.5 cm|trim the seam to 0.5 cm/);
        if (edges === 'binding') expect(g.steps.find((s) => s.title === 'Bind the neckline')!.diagram).toBe('slipstitch');
        if (edges !== 'binding') expect(all).toMatch(/[Gg]rade the seam/);
        expect(titles(g).indexOf('Baste and fit')).toBeLessThan(titles(g).indexOf('Hand-pick the zip'));
        const shoulders = g.steps.find((s) => s.title === 'Sew the shoulders');
        if (shoulders && id === 'silk' && edges !== 'lined') expect(shoulders.diagram).toBe('french');
      }
  });

  it('sews set-in sleeves both ways, with every bodice finish and cloth', () => {
    const d = draftBodice(randomBody(rng(9)), { length: 'waist' });
    const arms = { arm_length: 59, upper_arm: 29, wrist: 16 };
    const base = { fit: 'regular' as const, seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 };
    for (const [length, shape] of [['long', 'fitted'], ['short', 'puff'], ['long', 'bishop'], ['elbow', 'straight']] as const) {
      const sleeve = draftSleeve(d, arms, { ...base, length, shape });
      for (const edges of ['binding', 'facings', 'lined'] as const) {
        const quick = bodiceGuide(d, { length: 'waist' }, 1.6, 1, { edges, sleeve });
        const qt = titles(quick);
        expect(sound(quick), `${length} ${shape} ${edges}`).toEqual([]);
        expect(qt).not.toContain('Bind the armholes');
        expect(qt).not.toContain('Face the armholes');
        expect(qt).not.toContain('Line the neck and armholes');
        expect(qt).toContain('Set in the sleeves');
        expect(qt).toContain(sleeve.gathers ? 'Attach the sleeve bands' : 'Hem the sleeves');
        expect(qt).toContain(shape === 'puff' ? 'Gather the sleeve heads' : 'Ease the sleeve heads');
        if (sleeve.elbowDart) expect(qt).toContain('Sew the elbow darts');
        // The bodice is closed and its neck finished before the sleeves go in.
        expect(qt.indexOf('Sew the shoulders')).toBeLessThan(qt.indexOf('Set in the sleeves'));
        expect(qt.indexOf('Sew the side seams')).toBeLessThan(qt.indexOf('Set in the sleeves'));
        if (edges === 'lined') expect(qt.indexOf('Baste the lining to the armholes')).toBeLessThan(qt.indexOf('Set in the sleeves'));
        for (const { id } of CLOTHS) {
          const g = toCouture(quick, { garment: 'bodice', cloth: id as Cloth, lined: edges === 'lined', traced: true, zipCm: d.zipCm });
          expect(sound(g), `${length} ${shape} ${edges} ${id}`).toEqual([]);
          const set = g.steps.find((s) => s.title === 'Set in the sleeves')!;
          expect(set.diagram).toBe('setsleeve');
          expect(set.text).toContain('Hand-baste the sleeve in');
          expect(g.steps.find((s) => /sleeve heads$/.test(s.title))!.diagram).toBe('easehead');
          expect(g.steps.find((s) => s.title === 'Finish the armhole seams')!.text).not.toMatch(/zigzag|overlock/);
          if (edges !== 'binding') expect(text(g)).toMatch(/[Gg]rade the seam/);
          expect(g.notions).toContain('A sleeve board or sleeve roll');
        }
      }
    }
  });
});
