import { describe, expect, it } from 'vitest';
import { HouseLook, lookFlat } from '../collection';
import { isBodice, isDress, isOuter, isTee, isTrousers } from '../garments';
import { EXAMPLE_VALUES } from '../measurements';
import { PIECE_KINDS, backMissing, backWords, choicesFor, mainPiece, pieceNote, piecesToPick, skirtChoices, withBack } from './garments';
import type { PhotoReading, TopReading } from './types';

const top: TopReading = {
  fit: { value: 'regular', confidence: 'medium' },
  neckline: 'v',
  sleeve: 'short',
  sleeveShape: 'puff',
  length: 'waist',
  seams: 'darts',
  opening: 'back',
  collar: 'none',
  peplum: 'none',
  boned: false,
  knit: false,
  waistSeam: true,
};

const dress: PhotoReading = {
  garment: 'dress',
  pieces: [{ garment: 'dress', x: 0.5, y: 0.5 }],
  silhouette: { value: 'a_line', confidence: 'high' },
  length: { value: 'knee', confidence: 'medium' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.56, hemFullness: 1.5, flareAt: null, confidence: 'medium' },
  extras: { volume: 'none', asymHem: 'none', pockets: true, elasticWaist: false },
  top,
  trousers: null,
  outer: null,
  details: '',
};

const outfit: PhotoReading = {
  ...dress,
  garment: 'jacket',
  pieces: [
    { garment: 'jacket', x: 0.5, y: 0.3 },
    { garment: 'trousers', x: 0.5, y: 0.75 },
    { garment: 'jacket', x: 0.4, y: 0.3 },
  ],
  top: { ...top, neckline: 'crew', knit: true, sleeve: 'long', sleeveShape: 'straight', length: 'hip' },
  trousers: { fit: { value: 'fitted', confidence: 'medium' }, leg: 'wide', length: 'ankle', elasticWaist: false, opening: 'side_zip', pockets: 'slant' },
  outer: { fit: { value: 'regular', confidence: 'high' }, length: 'knee', front: 'double', collar: 'notched', pockets: 'welt', shaping: 'princess', pads: 'structured', flare: 'straight' },
};

/** The garment drafts on the sample body, the way the collection checks its looks. */
const drafts = (r: PhotoReading, g: (typeof PIECE_KINDS)[number]) => lookFlat({ choices: choicesFor(r, g) } as HouseLook, EXAMPLE_VALUES) !== undefined;

describe('a photo read as any garment', () => {
  it('drafts every garment from a dress photo and from an outfit photo', () => {
    for (const r of [dress, outfit]) for (const g of PIECE_KINDS) expect(drafts(r, g), `${r.garment} as ${g}`).toBe(true);
  });

  it('drafts every garment from an older skirt-only reading', () => {
    const { pieces: _p, extras: _e, top: _t, trousers: _tr, outer: _o, ...old } = dress;
    for (const g of PIECE_KINDS) expect(drafts({ ...old, garment: 'skirt' }, g), g).toBe(true);
  });

  it('saves each garment under its own kind', () => {
    expect(isDress(choicesFor(dress, 'dress'))).toBe(true);
    expect(isBodice(choicesFor(dress, 'top'))).toBe(true);
    expect(isTee(choicesFor(dress, 'tee'))).toBe(true);
    expect(isTrousers(choicesFor(outfit, 'trousers'))).toBe(true);
    const coat = choicesFor(outfit, 'coat');
    expect(isOuter(coat) && coat.garment).toBe('coat');
  });

  it('carries the bodice, sleeves and skirt into a dress', () => {
    const c = choicesFor(dress, 'dress');
    if (!isDress(c)) throw new Error('not a dress');
    expect(c.bodice).toMatchObject({ neckline: 'v', sleeve: 'short', sleeveShape: 'puff', length: 'waist', peplum: 'none' });
    expect(c.skirt).toMatchObject({ silhouette: 'a_line', length: 'knee', pockets: 'inseam' });
  });

  it('reads a jacket length as the nearest coat length and back', () => {
    const coat = choicesFor(outfit, 'coat');
    const jacket = choicesFor(outfit, 'jacket');
    expect(isOuter(coat) && coat.length).toBe('knee');
    expect(isOuter(jacket) && jacket.length).toBe('long');
    expect(isOuter(coat) && coat.front).toBe('double');
  });

  it('starts fitted only when the photo clearly shows it', () => {
    const t = choicesFor(outfit, 'trousers');
    expect(isTrousers(t) && t.fit).toBe('regular');
  });

  it('keeps slant pockets only beside a fly', () => {
    const t = choicesFor(outfit, 'trousers');
    expect(isTrousers(t) && t.pockets).toBe('inseam');
  });

  it('labels the pieces only when the photo shows more than one, once each', () => {
    expect(piecesToPick(dress)).toEqual([]);
    expect(piecesToPick(outfit).map((p) => p.garment)).toEqual(['jacket', 'trousers']);
    expect(mainPiece({ ...dress, garment: 'other' })).toBeUndefined();
  });

  it('says when a dress has no waist seam', () => {
    expect(pieceNote({ ...dress, top: { ...top, waistSeam: false } }, 'dress')).toMatch(/no waist seam/);
    expect(pieceNote(dress, 'dress')).toBe('');
  });
});

describe('skirt details from a photo', () => {
  const skirt = (extras: Partial<NonNullable<PhotoReading['extras']>>, more: Partial<PhotoReading> = {}) =>
    skirtChoices({ ...dress, garment: 'skirt', ...more, extras: { volume: 'none', asymHem: 'none', pockets: false, elasticWaist: false, ...extras } });

  it('adds pleats in place of the exact proportions', () => {
    const c = skirt({ volume: 'box' });
    expect(c.pleats).toBe('box');
    expect(c.shape).toBeUndefined();
  });

  it('drops details the shape does not allow', () => {
    expect(skirt({ volume: 'knife' }, { silhouette: { value: 'circle', confidence: 'high' } }).pleats).toBeUndefined();
    expect(skirt({ elasticWaist: true }, { silhouette: { value: 'pencil', confidence: 'high' } }).waist).toBeUndefined();
    expect(skirt({ volume: 'knife', pockets: true }).pockets).toBeUndefined();
  });

  it('adds an elastic waist, pockets and a high-low hem', () => {
    expect(skirt({ elasticWaist: true, pockets: true })).toMatchObject({ waist: 'elastic', pockets: 'inseam' });
    expect(skirt({ asymHem: 'high_low' }).asymHem).toBe('high_low');
  });
});

describe("a photo's exact sizes", () => {
  const body = { waist_to_floor: 104, arm_length: 60 };
  const measures = { neckDepthCm: 22, sleeveEndsAt: 0.4, topHemAt: 0.18, trouserHemAt: 0.8 };
  const read = { ...outfit, top: { ...top, length: 'hip' as const }, measures };

  it('deepens an open neckline, and sets the sleeve, top hem and trouser length on the wearer', () => {
    const c = choicesFor(read, 'top', body);
    expect(isBodice(c) && c.neck?.frontDepth).toBe(22);
    expect(isBodice(c) && c.sleeveCm).toBe(24);
    expect(isBodice(c) && c.dropCm).toBe(19);
    const t = choicesFor(read, 'trousers', body);
    expect(isTrousers(t) && t.lengthCm).toBe(83);
    for (const g of ['top', 'dress', 'trousers'] as const) expect(lookFlat({ choices: choicesFor(read, g, body) } as HouseLook, EXAMPLE_VALUES), g).toBeDefined();
  });

  it('keeps the named choice when the size is close to it, or without the measurements', () => {
    const plain = choicesFor({ ...read, measures: { ...measures, neckDepthCm: 15 } }, 'top', body);
    expect(isBodice(plain) && plain.neck).toBeUndefined();
    const noBody = choicesFor(read, 'trousers');
    expect(isTrousers(noBody) && noBody.lengthCm).toBeUndefined();
  });

  it('leaves a neckline with a collar alone', () => {
    const c = choicesFor({ ...read, top: { ...read.top, neckline: 'scoop', collar: 'peter_pan' } }, 'top', body);
    expect(isBodice(c) && c.neck).toBeUndefined();
  });
});

describe('a back photo', () => {
  const back = { shown: true, backNeck: 'v' as const, opening: 'zip' as const, slit: 'back' as const, vent: false, confidence: 'high' as const, missing: [] };

  it('adds a low back and a slit to a dress, and drafts', () => {
    const before = choicesFor(dress, 'dress');
    const after = withBack(before, back);
    expect(isDress(after) && after.bodice.back).toBe('v');
    expect(isDress(after) && after.skirt.slit).toBe('back');
    expect(backWords(before, after)).toBe('V back, back slit');
    expect(lookFlat({ choices: after } as HouseLook, EXAMPLE_VALUES)).toBeDefined();
  });

  it("takes a jacket's vent away, and changes nothing when the photo isn't the back", () => {
    const jacket = choicesFor(outfit, 'jacket');
    const after = withBack(jacket, back);
    expect(isOuter(after) && after.vent).toBe('none');
    expect(withBack(jacket, { ...back, shown: false })).toEqual(jacket);
  });

  it('lists a back the app has no option for', () => {
    expect(backMissing({ ...back, opening: 'lace_up', missing: ['back bow'] })).toEqual(['lace-up back', 'back bow']);
    expect(backMissing({ ...back, shown: false, opening: 'lace_up' })).toEqual([]);
  });
});
