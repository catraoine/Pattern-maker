import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { DraftError } from './skirt';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { bodiceGuide, dressGuide } from './instructions';
import { toCouture } from './couture';
import { bodiceFlat, dressFlat } from './flat';
import { bodiceSpec, dressSpec } from './spec';
import { layPlans } from './layplan';
import { withAllowances } from './allowances';
import { garmentEase } from './easeMap';
import { bodiceFabrics, checkFabric, dressFabrics } from './fabrics';
import { BONE_STOP, GRIP_CM, TOP_NECKLINES } from './corset';
import { edgesFor, topNotes } from './corsetGuide';
import { DEFAULT_BODICE, describeBodice, detailAllowed, topAllowed, validDetails } from '../garments';
import { describePattern } from '../screens/describe';
import type { SewingGuide } from './instructions';

const ascii = (g: SewingGuide) => [...g.notions, ...g.steps.flatMap((s) => [s.title, s.text])].filter((t) => /[^\x20-\x7e]/.test(t));
const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const order = (g: SewingGuide, names: string[]) => names.map((n) => titles(g).indexOf(n));
const STRUCTURES = ['none', 'boned'] as const;
const FITS = ['fitted', 'regular', 'relaxed'] as const;

describe('boned and strapless tops', () => {
  it('drafts every top neckline and structure on random bodies, passing QC', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 120; seed++) {
      const body = randomBody(rng(seed));
      for (const neckline of TOP_NECKLINES)
        for (const structure of STRUCTURES) {
          const fit = FITS[seed % 3];
          const d = draftBodice(body, { neckline, structure, fit, darts: fit === 'relaxed' ? 'bust' : 'bust_waist' });
          for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${seed} ${neckline} ${structure}: ${c.label} ${c.detail}`);
          // A halter hangs from the neck, so it is never boned.
          const boned = neckline !== 'halter' && (structure === 'boned' || neckline !== 'cami');
          expect(d.top?.boned).toBe(boned);
          expect(d.armhole).toBe(0);
          for (const pc of d.pieces) for (const q of pc.outline.points()) expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
          if (boned) {
            expect(d.pieces.map((pc) => pc.name)).toEqual(['Bodice centre front', 'Bodice side front', 'Bodice centre back', 'Bodice side back']);
            expect(d.pieces.every((pc) => /coutil/.test(pc.fabric ?? ''))).toBe(true);
            // Close fit: 2 cm over the bust, 2 cm under the waist.
            expect(d.finishedWaist).toBeCloseTo(body.waist - 2, 0);
            expect(d.top!.waistStay!.lengthCm).toBeCloseTo(d.finishedWaist + 5, 1);
            expect(d.top!.bones.length).toBeGreaterThanOrEqual(5);
            const tallest = Math.max(...d.pieces.map((pc) => { const ys = pc.outline.points().map((q) => q.y); return Math.max(...ys) - Math.min(...ys); }));
            for (const b of d.top!.bones) {
              expect(b.lengthCm).toBeGreaterThan(5);
              expect(b.lengthCm).toBeLessThan(tallest - BONE_STOP.top - BONE_STOP.waist + 1); // along a curved seam
            }
            // The CF bone stops short of the top edge and the waist.
            const cf = d.top!.bones.find((b) => /centre front/i.test(b.where))!;
            expect(cf.lengthCm).toBeLessThan(d.front.waistCentre.y - Math.min(...d.pieces[0].outline.points().map((q) => q.y)) - BONE_STOP.top - BONE_STOP.waist + 0.3);
            expect(d.top!.grip).toBe(neckline === 'cami' ? 0 : GRIP_CM);
          }
          // The top edge falls smoothly to the side seam on the front, and rises to it on the back:
          // no dip below the side and flick back up at the underarm.
          for (const pc of d.pieces) {
            const { pts, tags } = pc.outline.taggedPoints(4);
            const top = pts.filter((_, i) => tags[i] === 'neck');
            const front = !/back/i.test(pc.name);
            const from = front ? top.reduce((k, q, i) => (q.y < top[k].y ? i : k), 0) : 0;
            for (let i = from + 1; i < top.length; i++)
              if (front ? top[i].y < top[i - 1].y - 0.05 : top[i].y > top[i - 1].y + 0.05) failures.push(`${seed} ${neckline} ${structure}: ${pc.name} top edge turns back at x ${top[i].x.toFixed(1)}`);
          }
          if (neckline === 'cami') {
            expect(d.top!.straps!.lengthCm).toBeGreaterThan(10);
            expect(d.top!.straps!.cutLengthCm).toBeGreaterThan(d.top!.straps!.lengthCm);
          } else expect(d.top!.straps).toBeUndefined();
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('drafts a boned or strapless dress with every skirt shape, passing QC', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const body = randomBody(rng(seed + 300));
      for (const neckline of TOP_NECKLINES)
        for (const silhouette of ['straight', 'pencil', 'a_line', 'trumpet', 'half_circle', 'circle'] as const) {
          const fit = FITS[seed % 3];
          let d;
          try {
            d = draftDress(body, validDetails({ ...DEFAULT_BODICE, neckline, structure: seed % 2 ? 'boned' : 'none', fit }, 'dress'), { fit, silhouette, length: seed % 2 ? 'knee' : 'maxi' });
          } catch (e) {
            if (e instanceof DraftError) continue;
            throw e;
          }
          for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${seed} ${neckline} ${silhouette}: ${c.label} ${c.detail}`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('writes the boned bodice in couture corsetry order, quick and couture, in ASCII', () => {
    const body = randomBody(rng(7));
    for (const neckline of TOP_NECKLINES.filter((n) => n !== 'halter')) {
      const d = draftBodice(body, { neckline, structure: 'boned' });
      const g = bodiceGuide(d, { length: 'waist' }, 1.2, 1, { edges: edgesFor(d, 'binding'), liningM: 0.8, coutilM: 0.8 });
      expect(ascii(g)).toEqual([]);
      const o = order(g, ['Flat-line the panels', 'Sew the princess seams', 'Put in the zip', 'Sew the side seams', 'Press the seams', 'Sew the boning channels', 'Insert the boning', 'Attach the waist stay', 'Stay the top edge', 'Line the top edge', 'Finish']);
      expect(o.every((i) => i >= 0)).toBe(true);
      expect([...o].sort((a, b) => a - b)).toEqual(o);
      expect(titles(g)).not.toContain('Sew the shoulders');
      expect(titles(g)).not.toContain('Bind the armholes');
      expect(g.notions.some((n) => /coutil/.test(n))).toBe(true);
      expect(g.notions.some((n) => /spiral steel boning/.test(n))).toBe(true);
      expect(g.notions.some((n) => /grosgrain/.test(n))).toBe(true);
      expect(titles(g).includes('Make the straps')).toBe(neckline === 'cami');
      const text = g.steps.map((s) => s.text).join(' ');
      for (const b of d.top!.bones) expect(text).toContain(`${b.lengthCm} cm`);
      if (neckline !== 'cami') expect(text).toMatch(/grips/);

      const c = toCouture(g, { garment: 'bodice', cloth: 'silk', lined: true, traced: true, zipCm: d.zipCm });
      expect(ascii(c)).toEqual([]);
      expect(titles(c)).toContain('Insert the boning');
      expect(titles(c)).toContain('Thread-trace the lines');
      expect(c.steps.find((s) => s.title === 'Baste and fit')!.text).not.toMatch(/shoulders/);
      expect(c.steps.find((s) => s.title === 'Staystitch the curves')!.text).toMatch(/top edge/);
    }
  });

  it('writes a soft cami with straps in place of shoulders, for every edge finish', () => {
    const body = randomBody(rng(9));
    const d = draftBodice(body, { neckline: 'cami', structure: 'none' });
    for (const edges of ['binding', 'facings', 'lined'] as const) {
      const e = edgesFor(d, edges);
      expect(e).not.toBe('facings');
      const g = bodiceGuide(d, { length: 'waist' }, 1, 1, { edges: e });
      expect(ascii(g)).toEqual([]);
      const t = titles(g);
      expect(t).not.toContain('Sew the shoulders');
      expect(t).not.toContain('Bind the armholes');
      expect(t).not.toContain('Insert the boning');
      expect(t).toContain('Make the straps');
      expect(t).toContain(e === 'binding' ? 'Bind the top edge' : 'Line the top edge');
      expect(g.notions.some((n) => /loop turner/.test(n))).toBe(true);
      const c = toCouture(g, { garment: 'bodice', cloth: 'silk', lined: e === 'lined', traced: false, zipCm: d.zipCm });
      expect(ascii(c)).toEqual([]);
    }
  });

  it('writes the boned dress in order, with one waist stay that carries the skirt', () => {
    const body = randomBody(rng(5));
    for (const silhouette of ['pencil', 'circle'] as const) {
      const d = draftDress(body, validDetails({ ...DEFAULT_BODICE, neckline: 'sweetheart', structure: 'boned' }, 'dress'), { silhouette, length: 'midi' });
      const g = dressGuide(d, { silhouette, length: 'midi' }, 2.5, 1, { edges: 'lined', liningM: 1, coutilM: 0.8 });
      expect(ascii(g)).toEqual([]);
      const o = order(g, ['Flat-line the panels', 'Sew the princess seams', 'Join the bodice to the skirt', 'Put in the zip', 'Sew the side seams', 'Insert the boning', 'Attach the waist stay', 'Line the top edge', 'Hem', 'Finish']);
      expect(o.every((i) => i >= 0)).toBe(true);
      expect([...o].sort((a, b) => a - b)).toEqual(o);
      const c = toCouture(g, { garment: 'dress', cloth: 'silk', lined: true, traced: true, zipCm: d.zipCm });
      expect(ascii(c)).toEqual([]);
      expect(titles(c)).not.toContain('Stay the waist');
      expect(c.notions.filter((n) => /grosgrain/.test(n)).length).toBe(1);
      expect(c.steps.find((s) => s.title === 'Join the bodice to the skirt')!.text).toMatch(/Baste along the traced lines, machine on them/);
    }
  });

  it('draws the flat with boning channels and straps, all finite', () => {
    const body = randomBody(rng(3));
    for (const neckline of TOP_NECKLINES)
      for (const structure of STRUCTURES) {
        const d = draftBodice(body, { neckline, structure });
        const f = bodiceFlat(d, edgesFor(d, 'binding'));
        const pts = f.views.flatMap((v) => [...v.shapes.flat(), ...v.lines.flatMap((l) => l.pts)]);
        expect(pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
        const stitched = f.views[0].lines.filter((l) => l.kind === 'stitch').length;
        if (d.top!.boned) expect(stitched).toBeGreaterThanOrEqual(4);
        if (neckline === 'cami') expect(f.views[0].shapes.length).toBeGreaterThan(1);
        const dress = draftDress(body, { neckline, structure }, { silhouette: 'a_line', length: 'knee' });
        const df = dressFlat(dress, edgesFor(dress.bodice, 'lined'));
        expect(df.views.flatMap((v) => v.shapes.flat()).every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
      }
  });

  it('lists the top edge, bones, stay and straps in the spec, with no armhole', () => {
    const body = randomBody(rng(4));
    const boned = draftBodice(body, { neckline: 'strapless' });
    const rows = bodiceSpec(body, boned, 'waist').map((r) => r.label);
    expect(rows).not.toContain('Armhole');
    expect(rows).toContain('Top edge, round');
    expect(rows).toContain('Top edge, taken in to grip');
    expect(rows.some((r) => /^Bone, /.test(r))).toBe(true);
    expect(rows.some((r) => /^Waist stay/.test(r))).toBe(true);
    const cami = draftBodice(body, { neckline: 'cami' });
    expect(bodiceSpec(body, cami, 'waist').map((r) => r.label)).toContain('Strap, finished (each)');
    const dress = draftDress(body, { neckline: 'sweetheart', structure: 'boned' }, { silhouette: 'straight', length: 'knee' });
    const dr = dressSpec(body, dress).map((r) => r.label);
    expect(dr).toContain('Top edge, round');
    expect(dr.filter((r) => /zip/i.test(r)).length).toBe(1);
    expect(topNotes(boned).join(' ')).toMatch(/grips/);
    expect(topNotes(cami).join(' ')).toMatch(/Straps/);
  });

  it('cuts the panels again from coutil, in their own lay', () => {
    const body = randomBody(rng(6));
    const d = draftBodice(body, { neckline: 'sweetheart', structure: 'boned' });
    const lays = layPlans(d.pieces.map((pc) => withAllowances(pc, 'home')), 140);
    expect(lays.map((l) => l.fabric).sort()).toEqual(['interlining', 'lining', 'self']);
    for (const l of lays) expect(l.metres).toBeGreaterThan(0);
  });

  it('reads negative waist ease on the ease map', () => {
    const body = randomBody(rng(8));
    const d = draftBodice(body, { neckline: 'strapless' });
    const views = garmentEase(d.pieces, body, { bust: d.front.apex.y, waist: d.front.waistCentre.y, block: d.block });
    expect(views.length).toBeGreaterThan(0);
    for (const v of views) for (const b of v.bands) expect(Number.isFinite(b.ease ?? 0)).toBe(true);
  });

  it('keeps the choices valid: strapless is boned, boning needs a top, no sleeves or collars', () => {
    const strapless = validDetails({ ...DEFAULT_BODICE, neckline: 'strapless', sleeve: 'short', collar: 'peter_pan', fit: 'relaxed', length: 'hip', princess: 'shoulder' } as never);
    expect(strapless.structure).toBe('boned');
    expect(strapless.sleeve).toBe('none');
    expect(strapless.collar ?? 'none').toBe('none');
    expect(strapless.fit).toBe('fitted');
    expect(strapless.length).toBe('waist');
    expect(strapless.princess ?? 'none').toBe('none');
    expect(validDetails({ ...DEFAULT_BODICE, neckline: 'crew', structure: 'boned' }).structure).toBe('none');
    expect(detailAllowed({ ...DEFAULT_BODICE, neckline: 'crew' }, 'structure', 'boned')).toBe(false);
    expect(detailAllowed({ ...DEFAULT_BODICE, neckline: 'strapless' }, 'structure', 'none')).toBe(false);
    expect(detailAllowed({ ...DEFAULT_BODICE, neckline: 'cami' }, 'structure', 'none')).toBe(true);
    expect(detailAllowed({ ...DEFAULT_BODICE, neckline: 'cami' }, 'closure', 'front_buttons')).toBe(false);
    expect(topAllowed({ ...DEFAULT_BODICE, neckline: 'cami' }, 'sleeve', 'short')).toBe(false);
    expect(topAllowed({ ...DEFAULT_BODICE, neckline: 'sweetheart', structure: 'boned' }, 'fit', 'relaxed')).toBe(false);
    // An invalid combination still drafts: draftBodice cleans it up.
    const d = draftBodice(randomBody(rng(2)), { neckline: 'crew', structure: 'boned' });
    expect(d.top).toBeUndefined();
  });

  it('names the tops', () => {
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'sweetheart', structure: 'boned' })).toMatch(/boned strapless sweetheart bodice/);
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'strapless' })).toMatch(/boned strapless bodice/);
    expect(describeBodice({ ...DEFAULT_BODICE, neckline: 'cami' })).toMatch(/cami/);
    expect(describePattern({ garment: 'dress', fit: 'fitted', bodice: { ...DEFAULT_BODICE, neckline: 'strapless' }, skirt: { fit: 'fitted', silhouette: 'a_line', length: 'midi' } } as never)).toMatch(/strapless/);
  });

  it('suggests firm cloth for a boned bodice and warns off fluid ones', () => {
    const a = bodiceFabrics({ fit: 'fitted', neckline: 'strapless', structure: 'boned' });
    expect(a.picks.map((p) => p.name).join(' ')).toMatch(/duchess satin/);
    expect(a.picks.map((p) => p.name).join(' ')).toMatch(/taffeta/);
    expect(a.avoid).toMatch(/[Ss]tretch/);
    expect(a.note).toMatch(/coutil/);
    expect(dressFabrics({ fit: 'fitted', neckline: 'sweetheart', structure: 'boned', silhouette: 'circle', length: 'midi' }).picks[0].name).toMatch(/duchess/);
    const warn = checkFabric({ garment: 'bodice', fit: 'fitted', neckline: 'strapless', structure: 'boned' }, { drape: 'fluid' });
    expect(warn.some((n) => n.level === 'warn' && /firm/.test(n.text))).toBe(true);
    expect(bodiceFabrics({ fit: 'regular', neckline: 'cami' }).picks[0].name).toMatch(/crepe de chine/);
  });
});
