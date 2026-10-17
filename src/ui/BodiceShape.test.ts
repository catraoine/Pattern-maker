import { describe, expect, it } from 'vitest';
import { draftBodice } from '../engine/bodice';
import { DEFAULT_BODICE } from '../garments';
import { currentNeck, dragDrop, dragEase, drapedOutline, strokeToNeck, worn } from './BodiceShape';

const m = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40, full_hip: 98, waist_to_hip: 20 };

describe('shaping the bodice by hand', () => {
  it('snaps a dragged hem to the waist, high hip and hip, and keeps it in between', () => {
    expect(dragDrop(m, DEFAULT_BODICE, 1)).toEqual({ ...DEFAULT_BODICE, length: 'waist' });
    expect(dragDrop(m, DEFAULT_BODICE, 10.8)).toEqual({ ...DEFAULT_BODICE, length: 'high_hip' });
    expect(dragDrop(m, DEFAULT_BODICE, 19)).toEqual({ ...DEFAULT_BODICE, length: 'hip' });
    expect(dragDrop(m, DEFAULT_BODICE, 15.3).dropCm).toBe(15.5);
    expect(dragDrop(m, DEFAULT_BODICE, 80).dropCm).toBe(24);
  });

  it('snaps a dragged fit to the nearest fit, and brings darts back for a closer one', () => {
    expect(dragEase(DEFAULT_BODICE, 5.4)).toEqual({ ...DEFAULT_BODICE, fit: 'fitted' });
    const roomy = dragEase({ ...DEFAULT_BODICE, darts: 'bust' }, 3);
    expect(roomy).toMatchObject({ fit: 'fitted', darts: 'bust_waist', bustEase: 3 });
    expect(dragEase(DEFAULT_BODICE, 18)).toMatchObject({ fit: 'relaxed', bustEase: 18 });
  });

  it('reads a drawn front neckline: depth, width and fullness, from either half', () => {
    const d = draftBodice(m);
    const { neckY, neckX } = d.neckBlock.front;
    // A straight line from 3 cm out along the shoulder to 12 cm below the block neck is a V.
    const v = Array.from({ length: 11 }, (_, i) => ({ x: -(neckX + 3) * (1 - i / 10), y: -2 + (neckY + 12 + 2) * (i / 10) }));
    const neck = strokeToNeck(v, 'front', d, currentNeck(DEFAULT_BODICE))!;
    expect(neck.frontDepth).toBeCloseTo(12, 0);
    expect(neck.width).toBeCloseTo(3, 0);
    expect(neck.fullness).toBeLessThan(0.2);
    // A quarter circle is full and round.
    const round = Array.from({ length: 21 }, (_, i) => {
      const a = (i / 20) * (Math.PI / 2);
      return { x: (neckX + 3) * Math.cos(a), y: -2 + (neckY + 12 + 2) * Math.sin(a) };
    });
    expect(strokeToNeck(round, 'front', d, currentNeck(DEFAULT_BODICE))!.fullness).toBeGreaterThan(0.6);
    // Drawing on the back only changes the back depth.
    const back = strokeToNeck([{ x: 3, y: 0 }, { x: 1, y: 5 }, { x: 0, y: 8 }], 'back', d, neck)!;
    expect(back).toEqual({ ...neck, backDepth: 8 });
    // The drawn neckline drafts, pointed for the V and round for the curve.
    expect(draftBodice(m, { neck }).pieces[0].meta.pointedAtCentre).toEqual(['neck']);
  });
});

describe('sketching a draped bodice', () => {
  it('draws the one-shoulder with its shoulder on the left as worn, and the cowl hanging low at the front', () => {
    const os = draftBodice(m, { neckline: 'one_shoulder' });
    const tops = (path: string) => {
      const pts = path.replace(' Z', '').split(/[ML]/).filter(Boolean).map((q) => q.trim().split(' ').map(Number));
      const high = (right: boolean) => Math.min(...pts.filter(([x]) => (x > 40) === right).map(([, y]) => y));
      return { left: high(false), right: high(true) };
    };
    const front = tops(drapedOutline(os, 'front', worn(os, 'front'), 40)!);
    const back = tops(drapedOutline(os, 'back', worn(os, 'back'), 40)!);
    expect(front.right).toBeLessThan(front.left - 8);
    expect(back.left).toBeLessThan(back.right - 8);
    const cowl = draftBodice(m, { neckline: 'cowl' });
    expect(drapedOutline(cowl, 'front', worn(cowl, 'front'), 40)).toMatch(/^M/);
    expect(drapedOutline(cowl, 'back', worn(cowl, 'back'), 40)).toBeUndefined();
    expect(drapedOutline(draftBodice(m), 'front', worn(draftBodice(m), 'front'), 40)).toBeUndefined();
  });
});
