import { describe, expect, it } from 'vitest';
import { draftBodice } from '../engine/bodice';
import { DEFAULT_BODICE } from '../garments';
import type { P } from '../engine/geometry';
import { APEX_REACH, edgeAt, landmarks } from './formLines';
import { readSeamLine, seamLines } from './formSeams';

const m = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40, full_hip: 98, waist_to_hip: 20 };
const d = draftBodice(m);
const L = landmarks(d);
const B = landmarks(d, 'back');

/** A line through the given points, a point every half centimetre or so. */
const line = (...at: P[]) =>
  at.slice(1).flatMap((b, i) => {
    const a = at[i];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    return Array.from({ length: n }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n }));
  });
/** Straight across the form at one height, from one side to the other. */
const across = (y: number, w: number) => line({ x: -w, y }, { x: w, y });
/** The point of the outline nearest a given way down the armhole, from the shoulder. */
const onArmhole = (side: 'front' | 'back', along: number) => {
  const pts = landmarks(d, side).edges.filter((e) => e.tag === 'armhole').map((e) => e.a);
  const off = (q: P) => Math.abs((edgeAt(d, q, side)?.along ?? 9) - along);
  return pts.reduce((best, q) => (off(q) < off(best) ? q : best));
};

describe('reading style seams drawn on the form', () => {
  it('reads a level line above the bust as a yoke, front or back', () => {
    const front = readSeamLine(across(L.neckPoint.y + 12, L.underarm.x - 1), d, DEFAULT_BODICE);
    expect(front.kind).toBe('yoke');
    expect(front.choices?.yoke).toEqual({ front: 12 });
    expect(front.said).toMatch(/Front yoke 12 cm/);
    // A back yoke drawn after keeps the front one.
    const back = readSeamLine(across(B.neckPoint.y + 14, B.underarm.x - 1), d, front.choices!, 'bodice', 'back');
    expect(back.choices?.yoke).toEqual({ front: 12, back: 14 });
    expect(draftBodice(m, back.choices!).styleSeams?.length).toBe(2);
  });

  it('reads a level line between the bust and the waist as an empire seam', () => {
    const r = readSeamLine(across(L.apex.y + 8, L.underarm.x - 1), d, { ...DEFAULT_BODICE, princess: 'shoulder', bustDart: 'neck' });
    expect(r.kind).toBe('empire');
    expect(r.choices).toMatchObject({ empire: 8, princess: 'none', bustDart: 'side' });
    expect(r.said).toMatch(/8 cm below the bust point/);
    expect(seamLines(draftBodice(m, r.choices!), 'front').length).toBe(2);
    expect(seamLines(draftBodice(m, r.choices!), 'back').length).toBe(2);
  });

  it('reads a line from the armhole down to the waist, clear of the bust, as side panels', () => {
    const top = onArmhole('front', 0.7);
    const stroke = line(top, { x: top.x + 1, y: L.waistY });
    expect(Math.min(...stroke.map((q) => Math.hypot(q.x - L.apex.x, q.y - L.apex.y)))).toBeGreaterThan(APEX_REACH);
    const r = readSeamLine(stroke, d, DEFAULT_BODICE);
    expect(r.kind).toBe('panel');
    expect(r.choices?.panel?.at).toBeCloseTo(0.7, 1);
    expect(draftBodice(m, r.choices!).pieces.map((pc) => pc.name)).toContain('Bodice side front');
  });

  it('leaves darts and princess seams to the seam reader', () => {
    const shoulderMid = { x: (L.neckPoint.x + L.shoulderTip.x) / 2, y: (L.neckPoint.y + L.shoulderTip.y) / 2 };
    expect(readSeamLine(line(shoulderMid, L.apex, { x: L.apex.x, y: L.waistY }), d, DEFAULT_BODICE).kind).toBeUndefined();
    expect(readSeamLine(line({ x: L.underarm.x, y: L.apex.y + 2 }, L.apex), d, DEFAULT_BODICE).kind).toBeUndefined();
    expect(readSeamLine(line({ x: 2, y: L.apex.y }, { x: 4, y: L.apex.y + 0.5 }), d, DEFAULT_BODICE).kind).toBeUndefined();
  });

  it('says why a seam cannot go with the rest', () => {
    const v = readSeamLine(across(L.neckPoint.y + 12, L.underarm.x - 1), d, { ...DEFAULT_BODICE, neckline: 'v' });
    expect(v.kind).toBe('yoke');
    expect(v.choices).toBeUndefined();
    expect(v.said).toMatch(/high neckline/);
    const peplum = readSeamLine(across(L.apex.y + 8, L.underarm.x - 1), d, { ...DEFAULT_BODICE, peplum: 'flared' });
    expect(peplum.choices).toBeUndefined();
    expect(peplum.said).toMatch(/peplum/);
  });

  it('draws no seam lines on a plain bodice', () => {
    expect(seamLines(d, 'front')).toEqual([]);
  });
});
