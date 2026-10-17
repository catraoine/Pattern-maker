import { describe, expect, it } from 'vitest';
import { draftBodice } from '../engine/bodice';
import { DEFAULT_BODICE } from '../garments';
import type { P } from '../engine/geometry';
import { edgeAt, landmarks, readBodiceHem, readNeckline, readSeam, readSkirtHem } from './drawOnForm';

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
    expect(edgeAt(d, shoulderMid)).toBe('shoulder');
    expect(edgeAt(d, L.underarm)).toMatch(/armhole|side/);
    expect(edgeAt(d, { x: 12, y: L.waistY })).toBe('waist');
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
    expect(readSkirtHem(hem(58), d, legs, skirt).choices).toMatchObject({ length: 'knee' });
    expect(readSkirtHem(hem(70), d, legs, skirt).choices?.lengthCm).toBe(70);
  });
});
