import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { draftSkirt } from './skirt';
import { draftDress } from './dress';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { BUTTONS_STOP_ABOVE_HEM, buttonsBlocked, yokeBlocked } from './skirtFront';
import { sewingGuide } from './instructions';
import { waistPieces } from './finishing';
import { skirtFlat } from './flat';
import { skirtSpec } from './spec';
import type { SewingGuide } from './instructions';
import type { Piece } from './piece';

const titles = (g: SewingGuide) => g.steps.map((s) => s.title);
const ascii = (g: SewingGuide) => g.steps.filter((s) => /[^\x20-\x7e]/.test(s.title + s.text)).map((s) => s.title);
const waist = (ps: Piece[]) => ps.reduce((t, pc) => t + taggedLength(pc.outline, 'waist'), 0);

describe('skirt yoke', () => {
  it('cuts a yoke through the dart points on 30 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const m = randomBody(rng(seed));
      for (const silhouette of ['pencil', 'straight', 'a_line', 'trumpet'] as const)
        for (const length of ['mini', 'knee', 'maxi'] as const) {
          const k = draftSkirt(m, { silhouette, length, yoke: true });
          if (!k.yoke) failures.push(`seed ${seed} ${silhouette} ${length}: no yoke`);
          for (const c of checkPattern(k.pieces)) if (!c.ok) failures.push(`seed ${seed} ${silhouette} ${length}: ${c.label} (${c.detail})`);
          // The waist keeps its length, so the waistband is the same.
          expect(waist(k.pieces)).toBeCloseTo(waist(draftSkirt(m, { silhouette, length }).pieces), 1);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('closes the darts into the yokes, the skirt below with none', () => {
    const m = randomBody(rng(5));
    const k = draftSkirt(m, { silhouette: 'a_line', length: 'knee', yoke: true });
    expect(k.pieces.map((pc) => `${pc.name}: ${pc.cut}`)).toEqual(['Skirt front: Cut 1 on fold', 'Skirt back: Cut 2 (1 pair)', 'Skirt front yoke: Cut 1 on fold', 'Skirt back yoke: Cut 2 (1 pair)']);
    for (const pc of k.pieces) expect(taggedLength(pc.outline, 'dart')).toBe(0);
    expect(k.dartsPerSide).toEqual({ front: 0, back: 0 });
    // One notch on the front yoke seam, two on the back.
    const onSeam = (pc: Piece) => pc.notches.filter(([q]) => k.yoke![/back/i.test(pc.name) ? 'back' : 'front'].some((s) => Math.hypot(s.x - q.x, s.y - q.y) < 0.6)).length;
    expect(k.pieces.slice(0, 2).map(onSeam)).toEqual([1, 2]);
    const g = sewingGuide(k, { silhouette: 'a_line', length: 'knee' }, 1.5);
    const t = titles(g);
    expect(t).not.toContain('Sew the 4 darts');
    expect(t.indexOf('Sew on the yokes')).toBeLessThan(t.indexOf('Put in the zip'));
    expect(ascii(g)).toEqual([]);
    // The flat shows the yoke seam, not the darts.
    expect(skirtFlat(k).views[0].lines.filter((l) => l.kind === 'dart')).toEqual([]);
    expect(skirtSpec(m, k).some((r) => /Yoke, centre front/.test(r.label))).toBe(true);
  });

  it('goes only on a plain darted skirt with a waistband and a back zip, never on a dress', () => {
    const m = randomBody(rng(7));
    expect(yokeBlocked({ silhouette: 'circle' })).toBeDefined();
    expect(yokeBlocked({ silhouette: 'a_line', pleats: 'knife' })).toBeDefined();
    expect(yokeBlocked({ silhouette: 'a_line', waist: 'elastic' })).toBeDefined();
    expect(yokeBlocked({ silhouette: 'a_line', pockets: 'inseam' })).toBeDefined();
    expect(yokeBlocked({ silhouette: 'a_line' })).toBeUndefined();
    expect(draftSkirt(m, { silhouette: 'circle', length: 'knee', yoke: true }).yoke).toBeUndefined();
    const dr = draftDress(m as never, { fit: 'regular' }, { silhouette: 'a_line', length: 'knee', yoke: true });
    expect(dr.skirt.yoke).toBeUndefined();
  });
});

describe('button-front skirt', () => {
  it('opens the front for buttons on 30 random bodies, every seam matching', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const m = randomBody(rng(seed));
      for (const silhouette of ['straight', 'a_line', 'gathered', 'trumpet'] as const)
        for (const length of ['mini', 'knee', 'maxi'] as const) {
          const k = draftSkirt(m, { silhouette, length, buttons: true });
          if (!k.buttons) failures.push(`seed ${seed} ${silhouette} ${length}: no buttons`);
          for (const c of checkPattern(k.pieces)) if (!c.ok) failures.push(`seed ${seed} ${silhouette} ${length}: ${c.label} (${c.detail})`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('buttons from the band to 15 cm above the hem, the back on the fold, with no zip', () => {
    const m = randomBody(rng(9));
    const k = draftSkirt(m, { silhouette: 'a_line', length: 'knee', buttons: true });
    expect(k.zipCm).toBe(0);
    expect(k.pieces.map((pc) => pc.name)).toEqual(['Skirt front', 'Skirt back', 'Skirt front facing']);
    expect(k.pieces[0].cut).toBe('Cut 2 (1 pair)');
    expect(k.pieces[1].fold).toBeDefined();
    const b = k.buttons!;
    expect(b.at[b.at.length - 1]).toBeCloseTo(k.lengthCm - BUTTONS_STOP_ABOVE_HEM, 0);
    // The band runs across both extensions.
    const [band] = waistPieces(k, 1.5);
    expect(band.meta.lengthCm).toBeCloseTo(k.finishedWaist + 3, 1);
    expect(band.labels.map((l) => l.text)).toEqual(expect.arrayContaining(['BUTTONHOLE', 'BUTTON', 'CENTRE BACK']));
    const g = sewingGuide(k, { silhouette: 'a_line', length: 'knee' }, 1.5);
    const t = titles(g);
    expect(t).not.toContain('Put in the zip');
    expect(t).not.toContain('Sew the centre front');
    expect(t).toContain('Face the front edges');
    expect(t.indexOf('Make the buttonholes')).toBeGreaterThan(t.indexOf('Hem'));
    expect(g.notions.join(' ')).not.toMatch(/zip|Hook/);
    expect(g.notions).toContain(`${b.count + 1} buttons, 1.5 cm`);
    expect(ascii(g)).toEqual([]);
    // A straight maxi keeps its centre back seam for the walking slit, with no zip in it.
    const maxi = draftSkirt(m, { silhouette: 'straight', length: 'maxi', buttons: true });
    expect(maxi.slit?.at).toBe('back');
    expect(maxi.pieces[1].fold).toBeUndefined();
    expect(maxi.pieces[1].labels.some((l) => l.text === 'ZIP ENDS')).toBe(false);
  });

  it('goes only on a skirt with a straight front and a waistband', () => {
    expect(buttonsBlocked({ silhouette: 'pencil' })).toBeDefined();
    expect(buttonsBlocked({ silhouette: 'a_line', asymHem: 'high_low' })).toBeDefined();
    expect(buttonsBlocked({ silhouette: 'a_line', slit: 'front' })).toBeDefined();
    expect(buttonsBlocked({ silhouette: 'gathered', waist: 'elastic' })).toBeDefined();
    expect(buttonsBlocked({ silhouette: 'gathered' })).toBeUndefined();
    expect(yokeBlocked({ silhouette: 'a_line', buttons: true })).toBeDefined();
  });
});
