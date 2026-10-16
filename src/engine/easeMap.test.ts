import { describe, expect, it } from 'vitest';
import { draftSkirt, FIT_EASE } from './skirt';
import { draftBodice, BODICE_FIT_EASE } from './bodice';
import { draftTrousers, TROUSER_EASE } from './trousers';
import { draftDress } from './dress';
import { bodiceGroup, easeLevel, easeMap, garmentEase, skirtGroup, trousersGroup, widthAt } from './easeMap';
import { EXAMPLE_VALUES } from '../measurements';
import { taggedLength } from './geometry';

const M = EXAMPLE_VALUES as Record<string, number>;
// The bust's room: the most the bodice has over the bust, just under the underarm to a little below the apex.
const bustOf = (views: ReturnType<typeof easeMap>, name: string, apex: number) =>
  Math.max(...views.find((v) => v.name === name)!.bands.filter((b) => b.y0 >= apex - 1 && b.y1 <= apex + 5).map((b) => b.ease));
const at = (views: ReturnType<typeof easeMap>, name: string, y: number) => views.find((v) => v.name === name)!.bands.find((b) => b.y0 <= y && b.y1 > y)?.ease;

describe('princess seams', () => {
  it('blends both seams through the bust point, so the panels meet there and keep the bust room', () => {
    for (const princess of ['shoulder', 'armhole'] as const) {
      const d = draftBodice(M as never, { fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', princess } as never);
      const ax = d.front.apex;
      for (const pc of d.pieces.slice(0, 2)) {
        const near = Math.min(...pc.outline.points().map((q) => Math.hypot(q.x - ax.x, q.y - ax.y)));
        expect(near).toBeLessThan(0.15);
      }
    }
  });
});

describe('ease map', () => {
  it('reads the skirt’s own ease at the waist and the hip', () => {
    const d = draftSkirt(M as never, { fit: 'regular', silhouette: 'straight' });
    const v = easeMap([skirtGroup(d.pieces, M)!]);
    expect(at(v, 'Skirt front', M.waist_to_hip)).toBeCloseTo(FIT_EASE.regular.hip, 0);
    expect(at(v, 'Skirt back', M.waist_to_hip)).toBeCloseTo(FIT_EASE.regular.hip, 0);
    expect(at(v, 'Skirt front', 0.6)).toBeLessThan(5);
  });

  it('closes the darts: the waist width is the waist seam, not the open piece', () => {
    const d = draftSkirt(M as never, { fit: 'fitted', silhouette: 'pencil' });
    const front = d.pieces[0];
    expect(widthAt(front, 2)).toBeLessThan(Math.max(...front.outline.points().map((q) => q.x)) - 0.5);
    expect(2 * (widthAt(front, 0.3) + widthAt(d.pieces[1], 0.8))).toBeGreaterThan(taggedLength(front.outline, 'waist') * 2);
  });

  it('reads the bodice’s bust ease at the bust line', () => {
    for (const fit of ['fitted', 'regular', 'relaxed'] as const) {
      const d = draftBodice(M as never, { fit, neckline: 'crew', length: 'waist', darts: 'bust_waist' } as never);
      const v = easeMap([bodiceGroup(d.pieces, M, { bust: d.front.apex.y, waist: d.front.waistCentre.y })!]);
      expect(Math.abs(bustOf(v, 'Bodice front', d.front.apex.y) - BODICE_FIT_EASE[fit].bust)).toBeLessThan(1.5);
    }
  });

  it('maps princess panels and a button front the same as the plain bodice', () => {
    const base = { fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist' } as const;
    const plain = draftBodice(M as never, base as never);
    const lv = { bust: plain.front.apex.y, waist: plain.front.waistCentre.y };
    const e0 = bustOf(easeMap([bodiceGroup(plain.pieces, M, lv)!]), 'Bodice front', lv.bust);
    // Princess seams sew up to the same block, so they show the plain bodice's room, read from the block.
    for (const princess of ['shoulder', 'armhole'] as const) {
      const pr = draftBodice(M as never, { ...base, princess } as never);
      const v = garmentEase(pr.pieces, M, { ...lv, block: pr.block });
      expect(v.map((x) => x.name)).toEqual(expect.arrayContaining(['Bodice centre front', 'Bodice side front', 'Bodice side back']));
      expect(bustOf(v, 'Bodice centre front', lv.bust)).toBeCloseTo(e0, 0);
    }
    const bt = draftBodice(M as never, { ...base, closure: 'front_buttons' } as never);
    expect(bustOf(easeMap([bodiceGroup(bt.pieces, M, lv)!]), 'Bodice front', lv.bust)).toBeCloseTo(e0, 0);
  });

  it('maps trousers round the hip and each leg below the crotch', () => {
    const d = draftTrousers(M as never, { leg: 'tapered' });
    const v = easeMap([trousersGroup(d.pieces, M)!]);
    expect(at(v, 'Trousers front', M.waist_to_hip)).toBeCloseTo(TROUSER_EASE.regular.hip, 0);
    const hem = Math.max(...v[0].outline.map((q) => q.y));
    expect(at(v, 'Trousers front', hem - 1)).toBeGreaterThan(0);
    const wide = easeMap([trousersGroup(draftTrousers(M as never, { leg: 'wide' }).pieces, M)!]);
    expect(at(wide, 'Trousers front', hem - 10)!).toBeGreaterThan(at(v, 'Trousers front', hem - 10)!);
  });

  it('maps a dress as its bodice and its skirt', () => {
    const style = { fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist' };
    const d = draftDress(M as never, style as never, { fit: 'regular', silhouette: 'a_line', length: 'knee' } as never);
    const v = easeMap([bodiceGroup(d.pieces, M, { bust: d.bodice.front.apex.y, waist: d.bodice.front.waistCentre.y })!, skirtGroup(d.pieces, M)!]);
    expect(v.map((x) => x.name)).toEqual(expect.arrayContaining(['Bodice front', 'Skirt front']));
    expect(at(v, 'Skirt front', M.waist_to_hip)!).toBeGreaterThan(2);
  });

  it('names the levels', () => {
    expect(easeLevel(-1).label).toBe('Strains');
    expect(easeLevel(1).label).toBe('Snug');
    expect(easeLevel(4).label).toBe('Fitted');
    expect(easeLevel(30).label).toBe('Loose');
  });
});
