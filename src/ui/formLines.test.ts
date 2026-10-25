import { describe, expect, it } from 'vitest';
import { draftBodice } from '../engine/bodice';
import { draftSkirt } from '../engine/skirt';
import { DEFAULT_BODICE } from '../garments';
import type { P } from '../engine/geometry';
import { bodiceLines, edgeAt, landmarks, readBodiceHem, readDrape, readDressSide, readFit, readNeckline, readSeam, readSkirtHem, readSkirtSide, skirtLines } from './formLines';

const m = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40, full_hip: 98, waist_to_hip: 20 };
const d = draftBodice(m);
const L = landmarks(d);

/** A line through the given points, a point every half centimetre or so. */
const line = (...at: P[]) =>
  at.slice(1).flatMap((b, i) => {
    const a = at[i];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    return Array.from({ length: n }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n }));
  });
const mid = (a: P, b: P) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const shoulderMid = mid(L.neckPoint, L.shoulderTip);
const waistAtApex = { x: L.apex.x, y: L.waistY };

describe('reading lines drawn on the form', () => {
  it('finds the edges of the front', () => {
    expect(edgeAt(d, shoulderMid)?.edge).toBe('shoulder');
    expect(edgeAt(d, shoulderMid)?.along).toBeCloseTo(0.5, 1);
    expect(edgeAt(d, L.underarm)?.edge).toMatch(/armhole|side/);
    expect(edgeAt(d, { x: 12, y: L.waistY })?.edge).toBe('waist');
    expect(edgeAt(d, L.apex)).toBeUndefined();
  });

  it('reads a neckline, from either half of the form', () => {
    const v = line({ x: -(L.neckPoint.x + 2), y: L.neckPoint.y }, { x: 0, y: d.neckBlock.front.neckY + 10 });
    const read = readNeckline(v, d, DEFAULT_BODICE);
    expect(read.choices?.neck?.frontDepth).toBeCloseTo(10, 0);
    expect(read.said).toMatch(/10 cm/);
  });

  it('turns a line from the shoulder or armhole through the bust to the waist into princess seams', () => {
    const fromShoulder = readSeam(line(shoulderMid, L.apex, waistAtApex), d, DEFAULT_BODICE);
    expect(fromShoulder.choices).toMatchObject({ princess: 'shoulder', darts: 'bust_waist' });
    const armhole = d.pieces[0].outline.taggedPoints(16);
    const onArmhole = armhole.pts[armhole.tags.indexOf('armhole') + 10];
    expect(readSeam(line(onArmhole, L.apex, waistAtApex), d, DEFAULT_BODICE).choices).toMatchObject({ princess: 'armhole' });
    // Drawn upwards, from the waist, it reads the same.
    expect(readSeam(line(waistAtApex, L.apex, shoulderMid), d, DEFAULT_BODICE).choices).toMatchObject({ princess: 'shoulder' });
  });

  it('turns a line from an edge that stops at the bust into a moved bust dart', () => {
    const toBust = (from: P) => readSeam(line(from, L.apex), d, { ...DEFAULT_BODICE, princess: 'shoulder' }).choices;
    expect(toBust(shoulderMid)).toMatchObject({ bustDart: 'shoulder', princess: 'none' });
    const side = d.pieces[0].outline.taggedPoints(16);
    const sidePts = side.pts.filter((_, i) => side.tags[i] === 'side');
    expect(toBust(sidePts[sidePts.length - 1])).toMatchObject({ bustDart: 'french' });
    expect(toBust({ x: 12, y: L.waistY })).toMatchObject({ bustDart: 'waist' });
  });

  it('explains a line it cannot use, and changes nothing', () => {
    const missesBust = readSeam(line(shoulderMid, { x: 20, y: 12 }), d, DEFAULT_BODICE);
    expect(missesBust.choices).toBeUndefined();
    expect(missesBust.said).toMatch(/bust point/);
    const strapless = readNeckline(line({ x: 8, y: 0 }, { x: 0, y: 12 }), d, { ...DEFAULT_BODICE, neckline: 'strapless' });
    expect(strapless.choices).toBeUndefined();
  });

  it('reads a hem as the bodice length, or the dress skirt length', () => {
    const hem = (below: number) => line({ x: -20, y: L.waistY + below }, { x: 20, y: L.waistY + below });
    expect(readBodiceHem(hem(19.5), d, m, DEFAULT_BODICE).choices).toMatchObject({ length: 'hip' });
    expect(readBodiceHem(hem(0.5), d, m, { ...DEFAULT_BODICE, length: 'hip' }).choices).toMatchObject({ length: 'waist' });
    const legs = { ...m, waist_to_knee: 58, waist_to_floor: 104 };
    const skirt = { fit: 'regular', silhouette: 'a_line', length: 'mini' } as const;
    const sd = draftSkirt(legs, skirt);
    expect(readSkirtHem(hem(58), L.waistY, sd, legs, skirt).choices).toMatchObject({ length: 'knee' });
    expect(readSkirtHem(hem(70), L.waistY, sd, legs, skirt).choices?.lengthCm).toBe(70);
  });

  it('starts a princess seam or moved dart where it was drawn along the edge', () => {
    const near = (k: number) => ({ x: L.neckPoint.x + (L.shoulderTip.x - L.neckPoint.x) * k, y: L.neckPoint.y + (L.shoulderTip.y - L.neckPoint.y) * k });
    const inner = readSeam(line(near(0.3), L.apex, waistAtApex), d, DEFAULT_BODICE).choices!;
    const outer = readSeam(line(near(0.7), L.apex, waistAtApex), d, DEFAULT_BODICE).choices!;
    expect(inner.lineAt).toBeCloseTo(0.3, 1);
    expect(outer.lineAt).toBeCloseTo(0.7, 1);
    // The seam really moves on the pattern: the side front's shoulder is longer when it starts further in.
    const shoulderOf = (c: typeof inner) => {
      const pc = draftBodice(m, c).pieces.find((p) => /side front/i.test(p.name))!;
      const t = pc.outline.taggedPoints(8);
      // Each tag names the edge from its point to the next.
      return t.pts.reduce((sum, q, i) => (t.tags[i] === 'shoulder' ? sum + Math.hypot(t.pts[(i + 1) % t.pts.length].x - q.x, t.pts[(i + 1) % t.pts.length].y - q.y) : sum), 0);
    };
    expect(shoulderOf(inner)).toBeGreaterThan(shoulderOf(outer) + 1);
    const dart = readSeam(line(near(0.7), L.apex), d, DEFAULT_BODICE).choices!;
    expect(dart).toMatchObject({ bustDart: 'shoulder' });
    expect(dart.lineAt).toBeCloseTo(0.7, 1);
  });

  it('reads the back: a back neckline, and princess seams only', () => {
    const B = landmarks(d, 'back');
    const back = readNeckline(line({ x: B.neckPoint.x, y: B.neckPoint.y }, { x: 0, y: d.neckBlock.back.neckY + 12 }), d, DEFAULT_BODICE, 'bodice', 'back');
    expect(back.said).toMatch(/Back neckline/);
    expect(back.choices?.neck?.backDepth).toBeGreaterThan(8);
    const bmid = mid(B.neckPoint, B.shoulderTip);
    expect(readSeam(line(bmid, B.apex, { x: B.apex.x, y: B.waistY }), d, DEFAULT_BODICE, 'bodice', 'back').choices).toMatchObject({ princess: 'shoulder' });
    expect(readSeam(line(bmid, B.apex), d, DEFAULT_BODICE, 'bodice', 'back').choices).toBeUndefined();
  });

  it('drapes a cowl as deep as it was drawn, a one-shoulder edge, and a peplum', () => {
    const top = d.neckBlock.front.neckY;
    const cowl = (depth: number) =>
      readDrape(line({ x: -L.neckPoint.x, y: L.neckPoint.y }, { x: 0, y: top + depth }, { x: L.neckPoint.x, y: L.neckPoint.y }), d, DEFAULT_BODICE).choices;
    expect(cowl(9)).toMatchObject({ neckline: 'cowl', cowlDepth: 9 });
    expect(cowl(14)?.cowlDepth).toBe(14);
    expect(cowl(20)?.cowlDepth).toBe(16);
    // The drawn depth reaches the pattern.
    expect(draftBodice(m, cowl(14)!).drape?.depthCm).toBeGreaterThan(draftBodice(m, cowl(9)!).drape!.depthCm! + 3);
    const one = readDrape(line({ x: L.neckPoint.x, y: L.neckPoint.y }, { x: 0, y: L.apex.y - 6 }, { x: -L.underarm.x, y: L.underarm.y + 2 }), d, DEFAULT_BODICE);
    expect(one.choices).toMatchObject({ neckline: 'one_shoulder' });
    const flare = readDrape(line({ x: L.apex.x + 4, y: L.waistY }, { x: L.apex.x + 10, y: L.waistY + 12 }), d, { ...DEFAULT_BODICE, length: 'hip' });
    expect(flare.choices).toMatchObject({ peplum: 'flared', length: 'waist' });
    const wavy = Array.from({ length: 40 }, (_, i) => ({ x: -15 + i * 0.75, y: L.waistY + 10 + 1.5 * Math.sin(i * 0.9) }));
    expect(readDrape(wavy, d, DEFAULT_BODICE).choices).toMatchObject({ peplum: 'gathered' });
    expect(readDrape(wavy, d, DEFAULT_BODICE, 'dress').choices).toBeUndefined();
  });

  it('pins the fit at the side', () => {
    const at = (x: number) => readFit(line({ x, y: L.apex.y - 2 }, { x, y: L.waistY - 5 }), d, m, DEFAULT_BODICE).choices!;
    const close = at(m.full_bust / 4 + 0.5);
    const loose = at(m.full_bust / 4 + 3);
    expect(close.fit).toBe('fitted');
    expect(['regular', 'relaxed']).toContain(loose.fit);
  });

  it('shapes a skirt hem: curved, longer at the back, diagonal on a skirt only, and the side sets fit and flare', () => {
    const legs = { ...m, waist_to_knee: 58, waist_to_floor: 104 };
    const skirt = { fit: 'regular', silhouette: 'a_line', length: 'knee' } as const;
    const sd = draftSkirt(legs, skirt);
    const curve = Array.from({ length: 30 }, (_, i) => ({ x: -30 + i * 2, y: 58 + 0.012 * (-30 + i * 2) ** 2 }));
    const curved = readSkirtHem(curve, 0, sd, legs, skirt);
    expect(curved.choices?.hem?.front.some((v) => Math.abs(v) > 2)).toBe(true);
    const lowBack = readSkirtHem(line({ x: -30, y: 68 }, { x: 30, y: 68 }), 0, sd, legs, skirt, 'back');
    expect(lowBack.said).toMatch(/high-low/);
    const shaped = draftSkirt(legs, lowBack.choices!);
    expect(skirtLines(shaped, lowBack.choices!, legs, 'back', 0).hem![0][4].y).toBeGreaterThan(64);
    const slant = line({ x: -25, y: 50 }, { x: 25, y: 70 });
    expect(readSkirtHem(slant, 0, sd, legs, skirt, 'front', 'skirt').choices).toMatchObject({ asymHem: 'diagonal' });
    expect(readSkirtHem(slant, 0, sd, legs, skirt, 'front', 'dress').choices).toBeUndefined();
    const hipQ = legs.full_hip / 4;
    const sideLine = readSkirtSide(line({ x: hipQ + 1, y: 12 }, { x: hipQ + 1, y: 20 }, { x: hipQ + 12, y: 56 }), 0, sd, legs, skirt);
    expect(sideLine.choices?.fit).toBe('fitted');
    expect(sideLine.said).toMatch(/flare|shape/);
  });

  it("flares a dress's skirt from its side line, keeping the dress's one fit", () => {
    const legs = { ...m, waist_to_knee: 58, waist_to_floor: 104 };
    const skirt = { fit: 'regular', silhouette: 'straight', length: 'knee' } as const;
    const sd = draftSkirt(legs, skirt);
    const hipQ = legs.full_hip / 4;
    const seamY = L.waistY;
    const out = readDressSide(line({ x: hipQ + 1, y: seamY + 20 }, { x: hipQ + 14, y: seamY + 57 }), d, m, DEFAULT_BODICE, seamY, sd, legs, skirt);
    expect(out.choices?.skirt.silhouette).toBe('a_line');
    expect(out.choices?.skirt.fit).toBe('regular');
    expect(out.said).toMatch(/flare|A-line/);
    const both = readDressSide(line({ x: m.full_bust / 4 + 0.5, y: L.apex.y - 2 }, { x: m.full_bust / 4 + 0.5, y: L.waistY - 5 }, { x: hipQ + 14, y: seamY + 57 }), d, m, DEFAULT_BODICE, seamY, sd, legs, skirt);
    expect(both.choices?.bodice.fit).toBe('fitted');
    expect(both.choices?.skirt).toMatchObject({ fit: 'fitted', silhouette: 'a_line' });
  });

  it('draws the lines a bodice already has', () => {
    const princess = draftBodice(m, { ...DEFAULT_BODICE, princess: 'shoulder' });
    expect(bodiceLines(princess, 'front').seam.length).toBeGreaterThan(0);
    expect(bodiceLines(princess, 'back').seam.length).toBeGreaterThan(0);
    expect(bodiceLines(d, 'front').neckline.length).toBe(2);
  });
});
