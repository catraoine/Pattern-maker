import { describe, expect, it } from 'vitest';
import { P, len, sub, taggedLength } from './geometry';
import { draftBodice } from './bodice';
import { DraftError, draftSkirt } from './skirt';
import { bodiceFacings, liningPieces, waistbandPiece } from './finishing';
import { withAllowances } from './allowances';
import { Piece, cutLine } from './piece';
import { layout } from './export';
import { randomBody, rng } from './randomBodies';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

/** True when any two non-neighbouring edges of a closed polyline cross. */
function selfCrosses(pts: P[]): boolean {
  const n = pts.length;
  const hit = (a: P, b: P, c: P, d: P) => {
    const r = sub(b, a);
    const s = sub(d, c);
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return false;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
    const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (hit(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  return false;
}

/** The two ends of the run of edges carrying `tag`. */
function runEnds(pc: Piece, tag: string): P[] {
  const { pts, tags } = pc.outline.taggedPoints(24);
  return tags.flatMap((t, i) => (t === tag && tags[i - 1] !== tag ? [pts[i]] : t === tag && tags[i + 1] !== tag ? [pts[i + 1]] : []));
}

describe('seam allowance styles', () => {
  const [front] = draftSkirt(m).pieces;

  it('cuts 1 cm everywhere for industry, keeping the hem', () => {
    const pc = withAllowances(front, 'industry');
    expect(pc.seamAllowance).toBe(1);
    expect(pc.allowances.waist).toBe(1);
    expect(pc.allowances.hem).toBe(front.allowances.hem);
    expect(pc.allowances.fold).toBe(0);
  });

  it('cuts wide fitting allowances for couture and draws the stitching line to thread-trace', () => {
    // A straight skirt's 4 cm hem is deepened to 5 for couture; an A-line's narrower hem is kept.
    const [straight] = draftSkirt(m, { silhouette: 'straight' }).pieces;
    expect(withAllowances(front, 'couture').allowances.hem).toBe(front.allowances.hem);
    const pc = withAllowances(straight, 'couture');
    expect(pc.seamAllowance).toBe(2.5);
    expect(pc.allowances.hem).toBe(5);
    expect(pc.meta.threadTrace).toBe(true);
    const sheet = layout([pc], 'Skirt', []);
    expect(sheet.prims.some((pr) => pr.kind === 'poly' && pr.style === 'stitchSolid' && pr.pts.length > 20)).toBe(true);
    expect(sheet.prims.some((pr) => pr.kind === 'text' && pr.text === 'THREAD-TRACE THE STITCHING LINE')).toBe(true);
  });

  it('leaves home patterns as drafted', () => {
    expect(withAllowances(front, 'home')).toBe(front);
  });
});

describe('waistband', () => {
  const d = draftSkirt(m);
  const band = waistbandPiece(d, 1.5);

  it('is the finished waist long, twice the finished width wide, with notches on both edges', () => {
    expect(taggedLength(band.outline, 'waist')).toBeCloseTo(d.finishedWaist, 5);
    expect(taggedLength(band.outline, 'end')).toBeCloseTo(2 * 2 * 3, 5);
    expect(band.notches).toHaveLength(6);
    // Side seam notches land where the skirt's side seams meet the waist.
    expect(band.notches[0][0].y).toBeCloseTo(d.waistband.sideMark - 1.5, 5);
  });

  it('runs along the lengthwise grain', () => {
    const [a, b] = band.grain!;
    expect(a.x).toBeCloseTo(b.x, 9);
  });
});

describe('skirt lining', () => {
  it('is 2.5 cm shorter with a narrow hem, and keeps the darts as tucks', () => {
    const d = draftSkirt(m, { silhouette: 'straight' });
    const lining = liningPieces(draftSkirt(m, { silhouette: 'straight', lengthCm: d.lengthCm - 2.5 }));
    expect(lining.map((pc) => pc.name)).toEqual(['Lining front', 'Lining back']);
    const depth = (pc: Piece) => Math.max(...pc.outline.points().map((q) => q.y));
    expect(depth(d.pieces[0]) - depth(lining[0])).toBeCloseTo(2.5, 5);
    expect(lining[0].allowances.hem).toBe(2);
    expect(lining.every((pc) => pc.kind === 'lining' && pc.fabric === 'Lining')).toBe(true);
    expect(lining[0].labels.some((l) => l.text === 'SEW DARTS AS TUCKS')).toBe(true);
  });
});

describe('bodice facings', () => {
  it('follow the neck and armholes and end on the seams, for 300 random bodies and every neckline', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const body = randomBody(rng(seed));
      const neckline = (['crew', 'scoop', 'v', 'square', 'boat'] as const)[seed % 5];
      const length = (['waist', 'high_hip', 'hip'] as const)[(seed >> 1) % 3];
      let bd;
      try {
        bd = draftBodice(body, { neckline, length });
      } catch (e) {
        if (e instanceof DraftError) continue;
        throw e;
      }
      const [front, back] = bd.pieces;
      const facings = bodiceFacings(front, back);
      const fail = (s: string) => failures.push(`seed ${seed} ${neckline}: ${s}`);
      if (facings.length !== 4) fail(`${facings.length} facings`);
      for (const f of facings) {
        const parent = /front/i.test(f.name) ? front : back;
        const edge = /neck/i.test(f.name) ? 'neck' : 'armhole';
        // The facing's edge is the garment's edge, exactly.
        const diff = Math.abs(taggedLength(f.outline, edge) - taggedLength(parent.outline, edge));
        if (diff > 0.1) fail(`${f.name} ${edge} differs by ${diff.toFixed(2)} cm`);
        if (selfCrosses(f.outline.points().slice(0, -1))) fail(`${f.name} outline crosses itself`);
        if (selfCrosses(cutLine(f))) fail(`${f.name} cutting line crosses itself`);
        // The free edge stays a band's width in from the garment's edge, give or take the ends.
        const inner = runEnds(f, 'facing');
        if (inner.length < 2) fail(`${f.name} has no free edge`);
      }
      // Neck facings sew together at the shoulder: front and back shoulder edges within 2 mm.
      const [fn, bn, fa, ba] = facings;
      const shoulder = (pc: Piece) => taggedLength(pc.outline, 'shoulder');
      if (Math.abs(shoulder(fn) - shoulder(bn)) > 0.2) fail(`neck facing shoulders ${shoulder(fn).toFixed(2)} vs ${shoulder(bn).toFixed(2)}`);
      if (Math.abs(shoulder(fa) - shoulder(ba)) > 0.2) fail(`armhole facing shoulders ${shoulder(fa).toFixed(2)} vs ${shoulder(ba).toFixed(2)}`);
      const side = (pc: Piece) => taggedLength(pc.outline, 'side');
      if (Math.abs(side(fa) - side(ba)) > 0.2) fail(`armhole facing sides ${side(fa).toFixed(2)} vs ${side(ba).toFixed(2)}`);
      // Ends land on the garment's seams.
      for (const [f, parent] of [
        [fn, front],
        [bn, back],
        [fa, front],
        [ba, back],
      ] as const) {
        const seamPts = parent.outline.taggedPoints(48);
        for (const tag of ['shoulder', 'side', 'fold', 'centre']) {
          for (const q of runEnds(f, tag)) {
            const onSeam = seamPts.tags.some((t, i) => {
              if (t !== tag) return false;
              const a = seamPts.pts[i];
              const b = seamPts.pts[i + 1];
              const ab = sub(b, a);
              const l2 = ab.x ** 2 + ab.y ** 2;
              const k = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
              return len(sub(q, { x: a.x + ab.x * k, y: a.y + ab.y * k })) < 0.15;
            });
            if (!onSeam) fail(`${f.name} ${tag} end is off the garment's ${tag}`);
          }
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

describe('atelier view', () => {
  it('numbers the drafting points of every skirt and bodice piece and draws them on request', () => {
    const d = draftSkirt(m, { silhouette: 'a_line' });
    const bd = draftBodice({ ...randomBody(rng(3)) });
    for (const pc of [...d.pieces, ...bd.pieces]) {
      expect(pc.draft?.points.length).toBeGreaterThan(5);
      for (const pt of pc.draft!.points) expect(pt.note).toMatch(/\S/);
    }
    const plain = layout(d.pieces, 'Skirt', []);
    const atelier = layout(d.pieces, 'Skirt', [], undefined, { atelier: true });
    const numbers = (s: typeof plain) => s.prims.filter((pr) => pr.kind === 'text' && /^(\d|D\d)$/.test(pr.text)).length;
    expect(numbers(plain)).toBe(0);
    expect(numbers(atelier)).toBe(d.pieces.reduce((t, pc) => t + pc.draft!.points.length, 0));
  });

  it('circle skirts are drafted from the circle', () => {
    const d = draftSkirt(m, { silhouette: 'circle' });
    expect(d.pieces[0].draft!.points[0].note).toMatch(/radius/);
  });
});

describe('layout', () => {
  it('stacks small pieces under a taller one rather than widening the sheet', () => {
    const bd = draftBodice(randomBody(rng(5)), { neckline: 'scoop' });
    const facings = bodiceFacings(bd.pieces[0], bd.pieces[1]);
    const widths = facings.map((pc) => {
      const xs = cutLine(pc).map((q) => q.x);
      return Math.max(...xs) - Math.min(...xs);
    });
    const sideBySide = widths.reduce((t, w) => t + w + 4, 0);
    const alone = layout(bd.pieces, 'Bodice', []).width;
    const withFacings = layout([...bd.pieces, ...facings], 'Bodice', []).width;
    // At least one facing tucks under another instead of taking its own column.
    expect(withFacings - alone).toBeLessThan(sideBySide - Math.min(...widths));
  });
});
