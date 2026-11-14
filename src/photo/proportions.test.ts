// Proportions read off a photo (In testing, Nov 7): a jacket, top or trousers drafted to the photo's numbers.
import { describe, expect, it } from 'vitest';
import { HouseLook, lookFlat } from '../collection';
import { DEFAULT_JACKET_CHOICES, isBodice, isDress, isOuter, isTrousers } from '../garments';
import { draftOuter, outerDrop, type OuterMeasurements } from '../engine/outerwear';
import { draftTrousers } from '../engine/trousers';
import { EXAMPLE_VALUES } from '../measurements';
import { choicesFor, type PhotoBody } from './garments';
import type { PhotoMeasures, PhotoReading } from './types';

const body = EXAMPLE_VALUES as unknown as PhotoBody & OuterMeasurements;
const none: PhotoMeasures = { neckDepthCm: null, sleeveEndsAt: null, topHemAt: null, trouserHemAt: null };

/** Cat's SS27 Look 02 vest picture, as the Look 09 thread measured it by hand (Nov 7). */
const vest: PhotoReading = {
  garment: 'jacket',
  pieces: [{ garment: 'jacket', x: 0.5, y: 0.35 }],
  silhouette: { value: 'a_line', confidence: 'low' },
  length: { value: 'above_knee', confidence: 'low' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.45, hemFullness: 1.6, flareAt: null, confidence: 'low' },
  top: null,
  trousers: null,
  outer: { fit: { value: 'relaxed', confidence: 'high' }, length: 'hip', front: 'single', collar: 'notched', pockets: 'welt', shaping: 'boxy', pads: 'soft', flare: 'straight', sleeve: 'none' },
  worn: true,
  details: '',
  measures: { ...none, outerHemAt: 0.27, breakCm: 17, buttons: 3, buttonGapCm: 14, shoulderOutCm: 2, bustRoom: 1.2, outerHemFullness: 1.05 },
};

describe('proportions read off a photo', () => {
  it('drafts the vest to the measured break, buttons, length and shoulder', () => {
    const c = choicesFor(vest, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect(c.sleeve).toBe('none');
    expect(c.buttons).toBe(3);
    expect(c.breakCm).toBeGreaterThan(14);
    expect(c.breakCm).toBeLessThan(20);
    const plain = draftOuter(body, { ...c, kind: 'jacket', breakCm: undefined, buttons: undefined, buttonGapCm: undefined, dropCm: undefined, shoulderCm: undefined, easeCm: undefined });
    const d = draftOuter(body, { ...c, kind: 'jacket' });
    expect(d.sleeveless).toBe(true);
    // Three buttons, the first at the break, 14 cm apart (scaled to her front).
    expect(d.buttons.at).toHaveLength(3);
    const gap = d.buttons.at[1] - d.buttons.at[0];
    expect(gap).toBeGreaterThan(11);
    expect(gap).toBeLessThan(17);
    expect(d.buttons.at[0]).toBeLessThan(plain.buttons.at[0]);
    // Longer than a hip-length jacket: the hem at the low hip.
    expect(d.drop).toBeGreaterThan(outerDrop(body, 'hip'));
    expect(Math.abs(d.drop - 0.27 * body.waist_to_floor!)).toBeLessThan(1);
    expect(lookFlat({ choices: c } as HouseLook, EXAMPLE_VALUES)).toBeDefined();
  });

  it('keeps a measured hem within a jacket or a coat', () => {
    const c = choicesFor({ ...vest, measures: { ...vest.measures!, outerHemAt: 0.9 } }, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect(c.length).toBe('long');
    expect(draftOuter(body, { ...c, kind: 'jacket' }).drop).toBeLessThanOrEqual(outerDrop(body, 'long') + 16);
  });

  it('goes oversized when the photo shows a lot of room, and drafts', () => {
    const c = choicesFor({ ...vest, outer: { ...vest.outer!, sleeve: 'set_in' }, measures: { ...vest.measures!, bustRoom: 1.4, shoulderOutCm: 6 } }, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect(c.fit).toBe('oversized');
    // Its sleeve drops the shoulder 5 cm already; the photo's 6 adds 1.
    expect(c.shoulderCm).toBe(1);
    expect(() => draftOuter(body, { ...c, kind: 'jacket' })).not.toThrow();
  });

  it('cuts a roomy waistcoat oversized too, its set-in shoulder moved out as far as the photo shows', () => {
    const c = choicesFor({ ...vest, measures: { ...vest.measures!, bustRoom: 1.35, shoulderOutCm: 4 } }, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect([c.fit, c.shaping, c.sleeve, c.shoulderCm]).toEqual(['oversized', 'boxy', 'none', 5]);
  });

  it('leaves the named choices alone without the wearer’s measurements or the numbers', () => {
    const c = choicesFor(vest, 'jacket');
    if (!isOuter(c)) throw new Error('not a jacket');
    expect(c.dropCm).toBeUndefined();
    expect(c.easeCm).toBeUndefined();
    const old = choicesFor({ ...vest, measures: none }, 'jacket', body);
    if (!isOuter(old)) throw new Error('not a jacket');
    expect([old.breakCm, old.buttons, old.dropCm, old.shoulderCm]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('cuts trousers to the measured knee and hem widths', () => {
    const r: PhotoReading = {
      ...vest,
      garment: 'trousers',
      outer: null,
      trousers: { fit: { value: 'regular', confidence: 'high' }, leg: 'wide', length: 'full', elasticWaist: false, opening: 'fly', pockets: 'slant' },
      measures: { ...none, trouserHemAt: 0.97, kneeRoom: 0.55, legHemRoom: 0.72 },
    };
    const c = choicesFor(r, 'trousers', body);
    if (!isTrousers(c)) throw new Error('not trousers');
    expect(c.legCm).toBeDefined();
    expect(c.legCm!.hem).toBeGreaterThan(c.legCm!.knee);
    expect(() => draftTrousers(EXAMPLE_VALUES as never, c)).not.toThrow();
  });

  it('sets a woven top’s room at the bust', () => {
    const r: PhotoReading = {
      ...vest,
      garment: 'top',
      outer: null,
      top: { fit: { value: 'regular', confidence: 'high' }, neckline: 'crew', sleeve: 'short', sleeveShape: 'straight', length: 'hip', seams: 'none', opening: 'back', collar: 'none', peplum: 'none', boned: false, knit: false, waistSeam: false },
      measures: { ...none, bustRoom: 1.16 },
    };
    const c = choicesFor(r, 'top', body);
    if (!isBodice(c)) throw new Error('not a top');
    expect(c.fit).toBe('relaxed');
    expect(lookFlat({ choices: c } as HouseLook, EXAMPLE_VALUES)).toBeDefined();
  });
});

describe('a jacket or coat cut to proportions read off a photo, on random bodies', () => {
  it('drafts sound patterns at the extremes of every measured number', async () => {
    const { randomArms, randomBody, rng, sweep } = await import('../engine/randomBodies');
    const { checkPattern } = await import('../engine/qc');
    const { outerFlat } = await import('../engine/flat');
    const failures: string[] = [];
    const extremes = [
      { outerHemAt: 0.02, breakCm: 6, buttons: 8, buttonGapCm: 5, shoulderOutCm: -3, bustRoom: 1.04, outerHemFullness: 1 },
      { outerHemAt: 0.9, breakCm: 44, buttons: 1, buttonGapCm: null, shoulderOutCm: 10, bustRoom: 1.75, outerHemFullness: 1.6 },
      { outerHemAt: 0.28, breakCm: 17, buttons: 3, buttonGapCm: 14, shoulderOutCm: 15, bustRoom: 1.55, outerHemFullness: 1.1 },
      { outerHemAt: 0.3, breakCm: 17, buttons: 3, buttonGapCm: 20, shoulderOutCm: 4, bustRoom: 1.3, outerHemFullness: 1.1 },
    ];
    for (let seed = 1; seed <= sweep(15); seed++) {
      const r = rng(seed);
      const b0 = randomBody(r);
      const b = { ...b0, ...randomArms(b0, r), waist_to_knee: b0.waist_to_knee ?? 58 };
      for (const kind of ['jacket', 'coat'] as const)
        for (const sleeve of ['set_in', 'none'] as const)
          for (const front of ['single', 'double'] as const)
            for (const m of extremes) {
              if (kind === 'coat' && sleeve === 'none') continue;
              const reading: PhotoReading = { ...vest, garment: kind, outer: { ...vest.outer!, front, sleeve, length: kind === 'coat' ? 'knee' : 'hip' }, measures: { ...none, ...m } };
              const c = choicesFor(reading, kind, b as unknown as PhotoBody);
              const tag = `${seed} ${kind} ${sleeve} ${front} ${JSON.stringify(m)}`;
              try {
                if (!isOuter(c)) throw new Error('not outer');
                const d = draftOuter(b as never, { ...c, kind });
                const bad = checkPattern(d.pieces.filter((pc) => !pc.kind || pc.kind === 'collar')).filter((x) => !x.ok);
                if (bad.length) failures.push(`${tag}: ${bad.map((x) => `${x.label} ${x.detail ?? ''}`).join('; ')}`);
                for (const pc of d.pieces) if (pc.outline.points().some((q) => !Number.isFinite(q.x + q.y))) failures.push(`${tag} ${pc.name} not finite`);
                if (d.buttons.at.some((y, i) => i > 0 && y <= d.buttons.at[i - 1])) failures.push(`${tag}: buttons out of order`);
                outerFlat(d);
              } catch (e) {
                failures.push(`${tag}: ${(e as Error).message}`);
              }
            }
    }
    expect(failures.slice(0, 8)).toEqual([]);
  }, 120_000);
});

describe('the ratio check against the photo', () => {
  it('an oversized vest comes out as roomy as the picture, its shoulders as far out', async () => {
    const { outerRatios } = await import('./ratios');
    // Cat's picture measured against the model's head (22 cm): the vest about 52 cm across the front, so about 1.32
    // times her bust, its shoulders about 5.5 cm past hers, the sides straight down from them.
    const r: PhotoReading = { ...vest, measures: { ...vest.measures!, bustRoom: 1.32, shoulderOutCm: 5.5, outerHemAt: 0.28 } };
    const c = choicesFor(r, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect(c.fit).toBe('oversized');
    expect(c.sleeve).toBe('none');
    const d = draftOuter(body, { ...c, kind: 'jacket' });
    const rows = outerRatios(r, c, d, body);
    expect(rows.filter((x) => !x.ok)).toEqual([]);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it('an oversized jacket with sleeves gets its dropped shoulder and the room the photo shows', async () => {
    const { outerRatios } = await import('./ratios');
    const r: PhotoReading = { ...vest, outer: { ...vest.outer!, sleeve: 'set_in' }, measures: { ...vest.measures!, bustRoom: 1.6, shoulderOutCm: 8 } };
    const c = choicesFor(r, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    const d = draftOuter(body, { ...c, kind: 'jacket' });
    expect(outerRatios(r, c, d, body).filter((x) => !x.ok)).toEqual([]);
  });
});

describe('an oversized waistcoat from a photo sews cleanly on the form (All round quality)', () => {
  it('passes for the vest picture and for roomier and wider readings', async () => {
    const { sewDesign } = await import('../drapeSweep');
    const failures: string[] = [];
    for (const [bustRoom, shoulderOutCm] of [[1.32, 5.5], [1.5, 3], [1.75, 10], [1.3, 0]] as const)
      for (const crisp of [false, true]) {
        const c = choicesFor({ ...vest, measures: { ...vest.measures!, bustRoom, shoulderOutCm } }, 'jacket', body);
        if (!isOuter(c)) throw new Error('not a jacket');
        const r = sewDesign({ garment: 'jacket', saved: { garment: 'jacket', jacket: c } as never, fibre: 'wool', crisp });
        const q = r.quality as { ok: boolean; problems: { check: string; part: string }[] } | undefined;
        if (r.error || !q?.ok) failures.push(`${bustRoom} ${shoulderOutCm} crisp=${crisp}: ${r.error ?? q!.problems.map((p) => `${p.check} ${p.part}`).join(', ')}`);
      }
    expect(failures).toEqual([]);
  }, 300_000);
});

describe('the pieces read off a photo (Nov 7)', () => {
  // Cat's vest picture, read piece by piece: a seam across the chest at the underarm, small flat buttons with
  // sideways buttonholes, a big collar over a small lapel with a tight notch, and black edging.
  const pieces: PhotoReading = {
    ...vest,
    outer: { ...vest.outer!, buttonStyle: 'flat', buttonholes: 'horizontal', edging: 'contrast', lapel: 'classic', chestPocket: false },
    measures: { ...vest.measures!, yokeAtCm: 20, buttonSizeCm: 1.5, collarPointCm: 11, lapelWidthCm: 5, notchCm: 1.5 },
  };

  it('carries each piece into the choices, scaled to her front', () => {
    const c = choicesFor(pieces, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect(c.yokeCm).toBeGreaterThan(16);
    expect(c.yokeCm).toBeLessThan(24);
    expect(c.buttonSizeCm).toBe(1.5);
    expect([c.buttonStyle, c.buttonholes, c.edging]).toEqual(['flat', 'horizontal', 'contrast']);
    expect(c.collarPointCm).toBeGreaterThan(c.lapelWidthCm!);
    expect(c.notchCm).toBeLessThan(2.5);
  });

  it('leaves the pattern its own pieces when the photo shows none, or the reading is from before', () => {
    const c = choicesFor(vest, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect([c.yokeCm, c.buttonSizeCm, c.collarPointCm, c.lapelWidthCm, c.notchCm, c.buttonStyle, c.buttonholes, c.edging]).toEqual(Array(8).fill(undefined));
  });

  it('drops collar and lapel sizes, buttons and buttonholes where the front has none', () => {
    const zip: PhotoReading = { ...pieces, outer: { ...pieces.outer!, front: 'zip', collar: 'stand' } };
    const c = choicesFor(zip, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect([c.buttonSizeCm, c.buttonStyle, c.buttonholes, c.collarPointCm, c.lapelWidthCm, c.notchCm]).toEqual(Array(6).fill(undefined));
    expect(c.yokeCm).toBeDefined();
  });

  it('reads a peak lapel, a wide lapel and a chest pocket', () => {
    const peak: PhotoReading = { ...pieces, outer: { ...pieces.outer!, collar: 'peak', lapel: 'wide', chestPocket: true, pockets: 'flap' } };
    const c = choicesFor(peak, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect([c.collar, c.lapel, c.chest, c.pockets]).toEqual(['peak', 'wide', 'welt', 'flap']);
  });
});

describe('options the reader names since Nov 12', () => {
  const dressTop = { fit: { value: 'regular', confidence: 'medium' }, neckline: 'v', sleeve: 'short', sleeveShape: 'straight', length: 'waist', seams: 'darts', opening: 'back', collar: 'none', peplum: 'none', boned: false, knit: false, waistSeam: false, waistSeamAt: 'none', belt: 'none' } as const;
  const dress = (top: Partial<NonNullable<PhotoReading['top']>>, sil: PhotoReading['silhouette']['value'] = 'straight'): PhotoReading => ({
    ...vest,
    garment: 'dress',
    outer: null,
    silhouette: { value: sil, confidence: 'high' },
    top: { ...dressTop, ...top },
    measures: { ...none },
  });

  it('cuts a shift, a sheath or a bias dress as read, with no waist seam', () => {
    for (const cut of ['shift', 'sheath', 'bias'] as const) {
      const c = choicesFor(dress({ dressCut: cut }), 'dress', body);
      if (!isDress(c)) throw new Error('not a dress');
      expect(c.skirt.noSeam).toBe(cut);
      expect(c.waistSeam).toBeUndefined();
    }
    const seam = choicesFor(dress({ dressCut: 'seam', waistSeamAt: 'dropped' }), 'dress', body);
    if (!isDress(seam)) throw new Error('not a dress');
    expect([seam.skirt.noSeam, seam.waistSeam]).toEqual([undefined, 'dropped']);
  });

  it('reads a wrap front, a gathered skirt, a sleeve cut and a cuff', () => {
    const c = choicesFor(dress({ opening: 'wrap', dressCut: 'seam', waistSeamAt: 'natural', sleeve: 'long', sleeveCut: 'drop', cuff: 'shirt' }, 'gathered'), 'dress', body);
    if (!isDress(c)) throw new Error('not a dress');
    expect(c.bodice.closure).toBe('wrap');
    expect(c.skirt.silhouette).toBe('gathered');
    expect([c.bodice.sleeveCut, c.bodice.sleeveCuff]).toEqual(['drop', 'shirt']);
  });

  it('places a jacket on a hanger on her body from its own proportions', () => {
    const hanger: PhotoReading = { ...vest, worn: false, measures: { ...none, outerHemAt: 0.02 } };
    const c = choicesFor(hanger, 'jacket', body);
    if (!isOuter(c)) throw new Error('not a jacket');
    expect(c.length).toBe('cropped');
  });
});

describe('the photo page names the pieces the pattern draws', () => {
  it('says where the chest seam sits and how big the buttons are', async () => {
    const { proportionWords } = await import('./garments');
    const words = proportionWords({ ...DEFAULT_JACKET_CHOICES, yokeCm: 19, buttonSizeCm: 1.5, buttonholes: 'horizontal' }, (cm) => `${cm} cm`);
    expect(words).toContain('Seam across the chest 19 cm below the neck');
    expect(words).toContain('Buttons 1.5 cm across, horizontal buttonholes');
  });
});

describe('room read off a hanger', () => {
  it('takes clearly more room to be the oversized cut when the jacket is not worn', () => {
    const at = (worn: boolean, bustRoom: number) => choicesFor({ ...vest, worn, measures: { ...none, bustRoom } }, 'jacket', body);
    expect((at(false, 1.35) as { fit: string }).fit).not.toBe('oversized');
    expect((at(true, 1.35) as { fit: string }).fit).toBe('oversized');
    expect((at(false, 1.5) as { fit: string }).fit).toBe('oversized');
  });
});
