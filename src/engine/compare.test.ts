import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { randomBody, rng } from './randomBodies';
import { Fitting, carriedFitting, describeCarried, saveVersion, toFitting, versionsOf } from './fitting';
import { changeLabel, changeWords, compareEdges, runsOf } from './compare';
import { CARD_MM, distanceCm, edgeAt, pxPerMmOf, screenKey, snap } from './scale';
import { p } from './geometry';

const f = (issues: Record<string, number>, date: string, extra: Partial<Fitting> = {}): Fitting => ({ issues, sides: {}, round: 1, date, ...extra });

describe('fit carried across garments', () => {
  it('carries a sway back from the skirt toile into the dress', () => {
    const c = carriedFitting({ skirt: f({ 'skirt-sway-back': 1.5 }, '2026-10-01') }, 'dress');
    expect(c.fitting.issues).toEqual({ 'skirt-sway-back': 1.5 });
    expect(c.from).toEqual([{ id: 'skirt-sway-back', garment: 'skirt' }]);
    expect(describeCarried(c)).toEqual([expect.stringMatching(/^From your skirt toile: /)]);
  });

  it('carries the bodice toile into the dress and the dress toile back into the bodice, never skirt fixes into a bodice', () => {
    const bodice = f({ 'bodice-sloping': 2 }, '2026-10-01');
    expect(carriedFitting({ bodice }, 'dress').fitting.issues).toEqual({ 'bodice-sloping': 2 });
    const dress = f({ 'bodice-neck-gape': 1, 'skirt-sway-back': 1 }, '2026-10-02');
    expect(carriedFitting({ dress }, 'bodice').fitting.issues).toEqual({ 'bodice-neck-gape': 1 });
    expect(carriedFitting({ dress }, 'skirt').fitting.issues).toEqual({ 'skirt-sway-back': 1 });
  });

  it("keeps the garment's own corrections, and an opposite on its own toile wins", () => {
    const fittings = { bodice: f({ 'bodice-bust-tight': 2 }, '2026-10-05'), dress: f({ 'bodice-bust-loose': 1 }, '2026-10-01') };
    const c = carriedFitting(fittings, 'dress');
    expect(c.fitting.issues).toEqual({ 'bodice-bust-loose': 1 });
    expect(c.from).toEqual([]);
  });

  it('takes the more recent of two other toiles', () => {
    const fittings = { bodice: f({ 'bodice-sloping': 3 }, '2026-10-01'), dress: f({ 'bodice-square': 1 }, '2026-10-09') };
    const c = carriedFitting(fittings, 'bodice');
    expect(c.fitting.issues).toEqual({ 'bodice-sloping': 3 });
    const s = carriedFitting({ skirt: f({}, '2026-10-01'), dress: f({ 'bodice-square': 1 }, '2026-10-09'), bodice: undefined }, 'bodice');
    expect(s.fitting.issues).toEqual({ 'bodice-square': 1 });
  });

  it('does not carry back a correction the own toile cleared', () => {
    const skirt = f({ 'skirt-sway-back': 1.5 }, '2026-10-01');
    const shown = carriedFitting({ skirt }, 'dress');
    const cleared = saveVersion(undefined, { ...shown.fitting, issues: {} }, '2026-10-03', shown.from.map((x) => x.id));
    expect(cleared.checked).toContain('skirt-sway-back');
    expect(carriedFitting({ skirt, dress: cleared }, 'dress').fitting.issues).toEqual({});
  });

  it('drafts the dress with the carried corrections', () => {
    const r = rng(7);
    const m = randomBody(r);
    const fit = carriedFitting({ skirt: f({ 'skirt-sway-back': 2 }, '2026-10-01') }, 'dress').fitting;
    const style = { fit: 'regular' as const, neckline: 'crew' as const, sleeve: 'none' as const, darts: 'bust' as const, length: 'waist' as const };
    const plain = draftDress(m as never, style as never, { fit: 'regular', silhouette: 'a_line', length: 'knee' } as never);
    const swayed = draftDress(m as never, style as never, { fit: 'regular', silhouette: 'a_line', length: 'knee', fitting: toFitting(fit, 'skirt') } as never);
    const changes = compareEdges(plain.pieces, swayed.pieces).filter((c) => c.status === 'changed');
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((c) => /skirt/i.test(c.name))).toBe(true);
  });
});

describe('versions', () => {
  it('keeps every saved version, oldest first, with version 1 the first draft', () => {
    let fit = saveVersion(undefined, { issues: { 'skirt-hip-tight': 1 }, round: 0 }, '2026-10-01');
    expect(fit.round).toBe(1);
    fit = saveVersion(fit, { ...fit, issues: { 'skirt-hip-tight': 2 } }, '2026-10-04');
    fit = saveVersion(fit, { ...fit, issues: { 'skirt-hip-tight': 2, 'skirt-sway-back': 1 } }, '2026-10-08');
    const vs = versionsOf(fit);
    expect(vs.map((v) => v.version)).toEqual([1, 2, 3, 4]);
    expect(vs.map((v) => v.fitting.date)).toEqual([undefined, '2026-10-01', '2026-10-04', '2026-10-08']);
    expect(vs[2].fitting.issues).toEqual({ 'skirt-hip-tight': 2 });
    expect(vs.every((v) => !v.fitting.history?.length || v.fitting === fit)).toBe(true);
  });
});

describe('compare versions', () => {
  const m = randomBody(rng(3));
  const style = { fit: 'regular', silhouette: 'a_line', length: 'knee' } as never;

  it('finds nothing changed between a draft and itself', () => {
    const a = draftSkirt(m as never, style).pieces;
    expect(compareEdges(a, a).every((c) => c.status === 'same')).toBe(true);
  });

  it('marks the hip let out on the side seam, in millimetres', () => {
    const a = draftSkirt(m as never, style).pieces;
    const fit = { issues: { 'skirt-hip-tight': 2 }, round: 1 };
    const b = draftSkirt(m as never, { ...(style as object), fitting: toFitting(fit, 'skirt') } as never).pieces;
    const ch = compareEdges(a, b);
    const side = ch.flatMap((c) => c.edges).filter((e) => e.tag === 'side');
    expect(side.length).toBeGreaterThan(0);
    // 2 cm more round the hip is 5 mm on each of four side seam edges.
    expect(Math.max(...side.map((e) => e.movedMm))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...side.map((e) => e.movedMm))).toBeLessThanOrEqual(7);
    expect(changeWords(side[0])).toMatch(/^side seam .*mm/);
    expect(changeLabel(side[0])).toMatch(/mm$/);
  });

  it('notes pieces only in one version', () => {
    const a = draftSkirt(m as never, style).pieces;
    const ch = compareEdges(a, a.slice(1));
    expect(ch.find((c) => c.name === a[0].name)?.status).toBe('removed');
    expect(compareEdges(a.slice(1), a).find((c) => c.name === a[0].name)?.status).toBe('added');
  });

  it('splits an outline into its edges, joining one that wraps round the start', () => {
    const b = draftBodice(randomBody(rng(5)) as never, { fit: 'regular', neckline: 'crew', sleeve: 'none', darts: 'bust', length: 'waist' } as never);
    for (const pc of b.pieces) {
      const runs = runsOf(pc.outline);
      const total = runs.reduce((t, r) => t + r.length, 0);
      expect(total).toBeCloseTo(pc.outline.length(), 0);
      const keys = runs.map((r) => `${r.tag}#${r.nth}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('true size', () => {
  it('works out the scale from the card', () => {
    expect(pxPerMmOf(CARD_MM.w * 4)).toBeCloseTo(4);
    expect(screenKey(800, 400, 2)).toBe(screenKey(400, 800, 2));
  });

  it('measures, snaps to corners and finds the edge tapped', () => {
    expect(distanceCm(p(0, 0), p(3, 4))).toBe(5);
    expect(snap(p(1.1, 0.1), [p(1, 0), p(5, 5)], 0.4)).toEqual(p(1, 0));
    expect(snap(p(2, 2), [p(1, 0)], 0.4)).toEqual(p(2, 2));
    const pc = draftSkirt(m2 as never, { fit: 'regular', silhouette: 'a_line', length: 'knee' } as never).pieces[0];
    const run = runsOf(pc.outline).find((r) => r.tag === 'hem')!;
    const mid = run.pts[Math.floor(run.pts.length / 2)];
    expect(edgeAt(pc, p(mid.x, mid.y + 0.3), 1)?.tag).toBe('hem');
    expect(edgeAt(pc, p(mid.x, mid.y + 30), 1)).toBeUndefined();
  });
});

const m2 = randomBody(rng(11));
