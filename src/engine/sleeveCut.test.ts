import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { draftSleeve } from './sleeve';
import type { SleeveStyle } from './sleeve';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { DROP, KIMONO, sleeveCutBlocked } from './sleeveCut';
import { bodiceGuide, dressGuide } from './instructions';
import { edgesFor } from './corsetGuide';
import { bodiceFlat, dressFlat, wornShapes } from './flat';
import { DEFAULT_BODICE, describeBodice, detailAllowed, sleeveOf, validDetails } from '../garments';
import type { SewingGuide } from './instructions';

const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const ascii = (g: SewingGuide) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text)).map((s) => s.title);
const body = (seed: number) => {
  const b = randomBody(rng(seed));
  return { ...b, ...randomArms(b, rng(seed + 100)) };
};
const sleeveStyle = (length: SleeveStyle['length'], shape: SleeveStyle['shape'] = 'straight'): SleeveStyle => ({ length, shape, fit: 'regular', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });

describe('sleeve cuts', () => {
  it('drafts a dropped shoulder, raglan and kimono on 30 random bodies, every seam matching', () => {
    const failures: string[] = [];
    const cases = [
      ['drop', 'long', 'straight'],
      ['drop', 'three_quarter', 'bishop'],
      ['raglan', 'elbow', 'straight'],
      ['raglan', 'long', 'bishop'],
      ['kimono', 'short', 'straight'],
      ['kimono', 'three_quarter', 'straight'],
    ] as const;
    for (let seed = 1; seed <= 30; seed++) {
      const m = body(seed);
      for (const [cut, length, shape] of cases)
        for (const closure of ['back_zip', 'front_buttons'] as const) {
          const d = draftBodice(m, { fit: 'regular', closure, sleeve: length, sleeveShape: shape, sleeveCut: cut });
          expect(d.sleeveCut).toBe(cut);
          const sl = draftSleeve(d, m, sleeveStyle(length, shape));
          expect(sl.cut).toBe(cut);
          for (const c of checkPattern([...d.pieces, ...sl.pieces])) if (!c.ok) failures.push(`seed ${seed} ${cut} ${length} ${closure}: ${c.label} (${c.detail})`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('carries a dropped shoulder past the shoulder point, with a shorter, flatter sleeve', () => {
    const m = body(4);
    const plain = draftBodice(m, { fit: 'regular' });
    const d = draftBodice(m, { fit: 'regular', sleeve: 'long', sleeveCut: 'drop' });
    expect(d.shoulder.front).toBeCloseTo(plain.shoulder.front + DROP.out, 0);
    const set = draftSleeve(plain, m, sleeveStyle('long'));
    const sl = draftSleeve(d, m, sleeveStyle('long'));
    expect(sl.capHeight).toBeLessThan(set.capHeight - 3);
    expect(sl.lengthCm).toBeLessThan(set.lengthCm - 3);
    expect(sl.crownEase.front + sl.crownEase.back).toBeLessThan(1.5);
    const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { sleeve: sl });
    expect(titles(g)).toContain('Set in the sleeves');
    expect(titles(g)).not.toContain('Ease the sleeve heads');
    expect(ascii(g)).toEqual([]);
  });

  it('cuts a raglan shoulder off the bodice and onto the sleeve, in two halves', () => {
    const m = body(6);
    const plain = draftBodice(m, { fit: 'regular' });
    const d = draftBodice(m, { fit: 'regular', collar: 'mandarin', sleeve: 'elbow', sleeveCut: 'raglan' });
    const sl = draftSleeve(d, m, sleeveStyle('elbow'));
    expect(sl.pieces.map((pc) => pc.name)).toEqual(['Raglan sleeve front', 'Raglan sleeve back']);
    // The neckline is shared between the bodice and the sleeves, its length unchanged, so the collar fits.
    const neck = [...d.pieces, ...sl.pieces].filter((pc) => !pc.kind).reduce((t, pc) => t + taggedLength(pc.outline, 'neck'), 0);
    expect(neck).toBeCloseTo(plain.neck / 2, 1);
    expect(d.pieces.every((pc) => pc.kind || taggedLength(pc.outline, 'shoulder') === 0)).toBe(true);
    for (const side of [0, 1]) expect(taggedLength(sl.pieces[side].outline, 'raglan')).toBeCloseTo(taggedLength(d.pieces[side].outline, 'raglan'), 1);
    expect(checkPattern([...d.pieces, ...sl.pieces]).filter((c) => !c.ok)).toEqual([]);
    const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { sleeve: sl, edges: 'facings' });
    const t = titles(g);
    expect(t).not.toContain('Set in the sleeves');
    expect(t).not.toContain('Sew the shoulders');
    // The sleeves go on before the neck is finished.
    expect(t.indexOf('Sew the overarm seams')).toBeLessThan(t.indexOf('Sew the raglan seams'));
    expect(t.indexOf('Sew the raglan seams')).toBeLessThan(t.indexOf('Sew the side seams'));
    expect(t.indexOf('Sew the side seams')).toBeLessThan(t.indexOf('Attach the collar') >= 0 ? t.indexOf('Attach the collar') : t.indexOf('Hem the sleeves'));
    expect(ascii(g)).toEqual([]);
    // A lined raglan is faced instead: the lining would need sleeves of its own.
    expect(edgesFor(d, 'lined')).toBe('facings');
    // Drawn with each sleeve running up to the neck along its raglan line.
    const top = (pts: { y: number }[]) => Math.min(...pts.map((q) => q.y));
    const flat = bodiceFlat(d, 'binding', sl).views[0];
    const setIn = bodiceFlat(plain, 'binding', draftSleeve(plain, m, sleeveStyle('elbow'))).views[0];
    expect(top(flat.shapes[flat.sleeves![0]]) - top(flat.shapes[0])).toBeLessThan(0.5);
    expect(top(setIn.shapes[setIn.sleeves![0]]) - top(setIn.shapes[0])).toBeGreaterThan(2);
  });

  it('cuts a kimono sleeve on with the bodice, to three-quarter length at most', () => {
    const m = body(8);
    const d = draftBodice(m, { fit: 'regular', sleeve: 'elbow', sleeveCut: 'kimono' });
    const sl = draftSleeve(d, m, sleeveStyle('elbow'));
    expect(sl.pieces).toEqual([]);
    expect(d.kimono!.length).toBe('elbow');
    const [f, b] = d.pieces;
    expect(taggedLength(f.outline, 'overarm')).toBeCloseTo(taggedLength(b.outline, 'overarm'), 5);
    expect(taggedLength(f.outline, 'underarm')).toBeCloseTo(taggedLength(b.outline, 'underarm'), 1);
    expect(f.allowances['sleeve-hem']).toBe(KIMONO.hem);
    expect(draftBodice(m, { fit: 'regular', sleeve: 'long', sleeveCut: 'kimono' }).sleeveCut).toBeUndefined();
    const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { sleeve: sl });
    expect(titles(g)).not.toContain('Set in the sleeves');
    expect(titles(g)).toContain('Hem the sleeves');
    expect(g.steps.find((s) => s.title === 'Sew the side seams')!.text).toMatch(/stay tape/);
    expect(ascii(g)).toEqual([]);
    // Drawn as one with the bodice; on the form the body is drawn without them, the sleeves hanging on the arms.
    const flat = bodiceFlat(d, 'binding', sl);
    expect(flat.views[0].sleeves).toEqual([]);
    const width = (pts: { x: number }[]) => Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x));
    expect(width(wornShapes(flat)[0])).toBeLessThan(width(flat.views[0].shapes[0]) - 20);
  });

  it('works on a dress, the sleeves on before the neck is finished', () => {
    const m = body(10);
    for (const cut of ['drop', 'raglan', 'kimono'] as const) {
      const dr = draftDress(m, { fit: 'regular', sleeve: 'short', sleeveCut: cut }, { silhouette: 'a_line', length: 'knee' });
      const sl = draftSleeve(dr.bodice, m, sleeveStyle('short'));
      expect(checkPattern([...dr.pieces, ...sl.pieces]).filter((c) => !c.ok)).toEqual([]);
      const g = dressGuide(dr, { silhouette: 'a_line', length: 'knee' }, 2, 1, { sleeve: sl });
      const t = titles(g);
      expect(t).toEqual([...new Set(t)]);
      if (cut !== 'drop') expect(t.indexOf('Sew the side seams')).toBeLessThan(t.indexOf('Bind the neckline'));
      expect(ascii(g)).toEqual([]);
      expect(dressFlat(dr, 'binding', { sleeve: sl }).views.length).toBe(2);
    }
  });

  it('goes only with sleeves, shoulders and seams it would not cut across', () => {
    const c = { ...DEFAULT_BODICE, sleeve: 'elbow' as const };
    expect(sleeveCutBlocked({ ...c, sleeve: 'none' }, 'raglan')).toBeDefined();
    expect(sleeveCutBlocked({ ...c, princess: 'shoulder' }, 'drop')).toBeDefined();
    expect(sleeveCutBlocked({ ...c, closure: 'wrap' }, 'raglan')).toBeDefined();
    expect(sleeveCutBlocked({ ...c, closure: 'wrap' }, 'drop')).toBeUndefined();
    expect(sleeveCutBlocked({ ...c, sleeveShape: 'puff' }, 'raglan')).toBeDefined();
    expect(sleeveCutBlocked({ ...c, sleeveShape: 'puff' }, 'kimono')).toBeUndefined();
    expect(sleeveCutBlocked({ ...c, sleeve: 'long' }, 'kimono')).toBeDefined();
    expect(detailAllowed(c, 'sleeveCut', 'raglan')).toBe(true);
    expect(validDetails({ ...c, sleeveCut: 'kimono', sleeve: 'long' }).sleeveCut).toBeUndefined();
    expect(sleeveOf({ ...c, sleeveCut: 'kimono', sleeveCuff: 'elastic' })).toEqual({ length: 'elbow', shape: 'straight', cut: 'kimono' });
    expect(describeBodice({ ...c, sleeveCut: 'raglan' })).toMatch(/elbow-length raglan sleeves/);
    expect(describeBodice({ ...c, sleeveCut: 'drop' })).toMatch(/dropped-shoulder sleeves/);
  });
});
