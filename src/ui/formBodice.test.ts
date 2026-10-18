import { describe, expect, it } from 'vitest';
import { draftBodice } from '../engine/bodice';
import type { P } from '../engine/geometry';
import { checkPattern } from '../engine/qc';
import { DEFAULT_BODICE } from '../garments';
import { bodiceHemLine, readBodiceHemShape, readUnevenNeckline, unevenNecklineLines } from './formBodice';
import { landmarks } from './formLines';
import { drapedOutline, worn } from './BodiceShape';

const m = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40, full_hip: 98, waist_to_hip: 20 };
const d = draftBodice(m);
const L = landmarks(d);

/** A line through the given points, a point every half centimetre or so. */
const line = (...at: P[]) =>
  at.slice(1).flatMap((b, i) => {
    const a = at[i];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    return Array.from({ length: n + (i === at.length - 2 ? 1 : 0) }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n }));
  });
/** A hem across the body: `side` cm below the waist at the side seams, `centre` at the centre. */
const hem = (waistY: number, side: number, centre: number) => line({ x: -24, y: waistY + side }, { x: -12, y: waistY + (side + centre) / 2 }, { x: 0, y: waistY + centre }, { x: 12, y: waistY + (side + centre) / 2 }, { x: 24, y: waistY + side });

describe('a hem drawn on the bodice', () => {
  it('sets the length from the side seams and keeps a level hem level', () => {
    const read = readBodiceHemShape(hem(L.waistY, 20, 20), d, m, DEFAULT_BODICE);
    expect(read.choices).toMatchObject({ length: 'hip' });
    expect(read.choices?.hem).toBeUndefined();
    expect(read.said).toMatch(/level all round/);
  });

  it('reads a dip at the centre front', () => {
    const read = readBodiceHemShape(hem(L.waistY, 14, 21), d, m, DEFAULT_BODICE);
    const c = read.choices!;
    expect(c.dropCm).toBeCloseTo(14, 0);
    expect(c.hem!.front[0]).toBeGreaterThan(4);
    expect(read.said).toMatch(/14 cm below the waist.*centre front/);
    // Drafted, the centre front hangs lower than the side seam, and the pattern still walks.
    const shaped = draftBodice(m, c);
    expect(shaped.front.hemCentre.y - shaped.front.hemSide.y).toBeGreaterThan(4);
    expect(checkPattern(shaped.pieces.filter((pc) => !pc.kind), { finishedWaist: shaped.finishedWaist }).filter((k) => !k.ok)).toEqual([]);
    // Its tape follows it, lowest at the centre.
    const tape = bodiceHemLine(shaped, 'front');
    const lowest = tape.reduce((a, b) => (b.y > a.y ? b : a));
    expect(Math.abs(lowest.x)).toBeLessThan(1);
    expect(tape[0].x).toBeLessThan(0);
    expect(tape[tape.length - 1].x).toBeGreaterThan(0);
  });

  it('reads a back drawn lower than the front as longer at the back', () => {
    const hip = draftBodice(m, { length: 'hip' });
    const back = landmarks(hip, 'back');
    const read = readBodiceHemShape(hem(back.waistY, 20, 29), hip, m, { ...DEFAULT_BODICE, length: 'hip' }, 'back');
    expect(read.choices?.length).toBe('hip');
    expect(read.choices!.hem!.back[0]).toBeGreaterThan(6);
    expect(read.said).toMatch(/longer at the back/);
  });

  it('keeps a waist-length bodice level at the waist', () => {
    const read = readBodiceHemShape(hem(L.waistY, 0, 6), d, m, { ...DEFAULT_BODICE, length: 'hip', hem: { front: [5, 4, 3, 2, 1, 0, 0, 0, 0], back: new Array(9).fill(0) } });
    expect(read.choices).toMatchObject({ length: 'waist' });
    expect(read.choices?.hem).toBeUndefined();
    expect(read.said).toMatch(/level waist/);
  });

  it('draws the current hem as tape: level at the waist on a waist-length bodice', () => {
    const tape = bodiceHemLine(d, 'front');
    expect(tape.every((q) => Math.abs(q.y - L.waistY) < 1e-6)).toBe(true);
  });

  it('needs the hip measurements', () => {
    const { full_hip: _h, ...short } = m;
    expect(readBodiceHemShape(hem(L.waistY, 14, 20), d, short, DEFAULT_BODICE).choices).toBeUndefined();
  });
});

describe('an uneven neckline drawn on the form', () => {
  const N = L.neckPoint;
  const top = d.neckBlock.front.neckY;

  it('reads an asymmetric V, its point toward the wearer’s left (your right)', () => {
    const v = line({ x: -N.x, y: N.y + 0.5 }, { x: 3, y: top + 12 }, { x: N.x, y: N.y + 0.5 });
    const read = readUnevenNeckline(v, d, DEFAULT_BODICE);
    const u = read.choices!.unevenNeck!;
    expect(u.x).toBeCloseTo(3, 0);
    expect(u.depth).toBeCloseTo(12, 0);
    expect(u.left).toBeLessThan(0.2);
    expect(read.said).toMatch(/asymmetric V.*toward your left/);
    const drafted = draftBodice(m, read.choices!);
    expect(drafted.drape?.kind).toBe('uneven');
    expect(unevenNecklineLines(drafted)).toHaveLength(1);
    expect(checkPattern(drafted.pieces.filter((pc) => !pc.kind), { finishedWaist: drafted.finishedWaist }).filter((k) => !k.ok)).toEqual([]);
  });

  it('reads a neckline scooped lower on one side', () => {
    const scoop = (k: number, depth: number) =>
      Array.from({ length: 30 }, (_, i) => {
        const t = i / 29;
        return { x: k * N.x * Math.sin((t * Math.PI) / 2), y: top + depth - (top + depth - N.y) * (1 - Math.cos((t * Math.PI) / 2)) };
      });
    // Lower on the wearer's right (your left, x < 0): the deep side drawn down to 13 cm, the other to 7.
    const right = scoop(-1, 13).reverse();
    const left = scoop(1, 13).map((q) => ({ x: q.x, y: Math.min(q.y, top + 7 + (q.x / N.x) * 0.1) }));
    const read = readUnevenNeckline([...right, ...left], d, DEFAULT_BODICE);
    expect(read.choices?.unevenNeck).toBeDefined();
    expect(read.choices!.unevenNeck!.x).toBeLessThan(0);
    expect(read.said).toMatch(/toward your right/);
  });

  it('draws the whole front on the sketch', () => {
    const drafted = draftBodice(m, { unevenNeck: { depth: 12, x: -4, left: 0.6, right: 0.6 } });
    const path = drapedOutline(drafted, 'front', worn(drafted, 'front'), 40)!;
    expect(path).toMatch(/^M.* Z$/);
    expect(drapedOutline(drafted, 'back', worn(drafted, 'back'), 40)).toBeUndefined();
  });

  it('leaves an even neckline to the neckline reader', () => {
    const v = line({ x: -N.x, y: N.y + 0.5 }, { x: 0, y: top + 12 }, { x: N.x, y: N.y + 0.5 });
    const read = readUnevenNeckline(v, d, DEFAULT_BODICE);
    expect(read.choices).toBeUndefined();
    expect(read.said).toMatch(/even neckline/);
    expect(unevenNecklineLines(d)).toEqual([]);
  });

  it('is drawn on the front, across the centre, on a bodice with shoulders', () => {
    const v = line({ x: -N.x, y: N.y }, { x: 3, y: top + 12 }, { x: N.x, y: N.y });
    expect(readUnevenNeckline(v, d, DEFAULT_BODICE, 'bodice', 'back').choices).toBeUndefined();
    expect(readUnevenNeckline(line({ x: 1.5, y: top + 12 }, { x: N.x, y: N.y }), d, DEFAULT_BODICE).choices).toBeUndefined();
    expect(readUnevenNeckline(v, d, { ...DEFAULT_BODICE, neckline: 'strapless' }).choices).toBeUndefined();
  });

  it('lets go of what a whole front can’t have, and says so', () => {
    const v = line({ x: -N.x, y: N.y + 0.5 }, { x: -3, y: top + 10 }, { x: N.x, y: N.y + 0.5 });
    const read = readUnevenNeckline(v, d, { ...DEFAULT_BODICE, princess: 'shoulder', closure: 'front_buttons' });
    expect(read.choices).toMatchObject({ princess: 'none', closure: 'back_zip' });
    expect(read.said).toMatch(/princess seams, the front buttons/);
  });
});
