import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { DraftError, draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { FIT_ISSUES, Fitting, describeFitting, setAmount, toFitting, toggleIssue } from './fitting';
import { layout, leaving } from './export';

const fitting = (issues: Record<string, number>, sides: Fitting['sides'] = {}): Fitting => ({ issues, sides, round: 1 });

/** A random set of issues for a garment, each at a random amount up to its most, never both of a pair. */
function randomIssues(garment: 'skirt' | 'bodice', r: () => number): Fitting {
  let f: Fitting = { issues: {}, sides: {}, round: 1 };
  for (const issue of FIT_ISSUES.filter((i) => i.garment === garment)) {
    if (r() < 0.35) {
      f = toggleIssue(f, issue.id);
      f = setAmount(f, issue.id, issue.step + r() * (issue.max - issue.step));
      if (issue.sided) f.sides![issue.id] = r() < 0.5 ? 'left' : 'right';
    }
  }
  return f;
}

describe('fitting corrections', () => {
  it('adds up the corrections each issue makes, and keeps the side', () => {
    const f = fitting({ 'bodice-sloping': 3, 'bodice-bust-tight': 2, 'bodice-low-shoulder': 1.5 }, { 'bodice-low-shoulder': 'left' });
    expect(toFitting(f, 'bodice')).toEqual({ frontSlope: 3, backSlope: 3, bustEase: 2, lowShoulder: { side: 'left', cm: 1.5 } });
    expect(toFitting(f, 'skirt')).toEqual({});
    expect(describeFitting(f, 'bodice')).toEqual(['shoulders 3 degrees more sloping', 'bust ease +2 cm', 'left shoulder 1.5 cm lower']);
  });

  it('replaces an issue with its opposite, and keeps amounts in range', () => {
    let f = toggleIssue(fitting({}), 'skirt-hip-tight');
    expect(f.issues).toEqual({ 'skirt-hip-tight': 2 });
    f = toggleIssue(f, 'skirt-hip-loose');
    expect(f.issues).toEqual({ 'skirt-hip-loose': 2 });
    expect(setAmount(f, 'skirt-hip-loose', 40).issues['skirt-hip-loose']).toBe(4);
    expect(toggleIssue(f, 'skirt-hip-loose').issues).toEqual({});
  });
});

const body = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

describe('skirt corrections', () => {
  it('changes the ease and the centre waists as asked', () => {
    const base = draftSkirt(body, { silhouette: 'straight' });
    const d = draftSkirt(body, { silhouette: 'straight', fitting: toFitting(fitting({ 'skirt-hip-tight': 2, 'skirt-waist-loose': 1, 'skirt-sway-back': 1.5, 'skirt-tummy': 1 }), 'skirt') });
    expect(d.finishedHip).toBeCloseTo(base.finishedHip + 2, 6);
    expect(d.finishedWaist).toBeCloseTo(base.finishedWaist - 1, 6);
    expect(d.pieces[1].outline.start.y).toBeCloseTo(base.pieces[1].outline.start.y + 1.5, 6);
    expect(d.pieces[0].outline.start.y).toBeCloseTo(base.pieces[0].outline.start.y - 1, 6);
  });

  it('raises the high hip side at the side seam only, front and back alike', () => {
    const d = draftSkirt(body, { fitting: toFitting(fitting({ 'skirt-high-hip': 1.5 }, { 'skirt-high-hip': 'left' }), 'skirt') });
    for (const pc of d.pieces) {
      const alt = pc.alternate!;
      expect(alt.label).toBe('LEFT HIP');
      expect(alt.outline.start).toEqual(pc.outline.start);
      const { pts, tags } = pc.outline.taggedPoints();
      const altPts = alt.outline.points();
      const side = tags.indexOf('side');
      expect(pts[side].y - altPts[side].y).toBeCloseTo(1.5, 6);
    }
    const sheet = layout(d.pieces, 'test', [], { pattern: 'test' });
    expect(sheet.prims.some((pr) => pr.kind === 'text' && pr.text === 'LEFT HIP LINE')).toBe(true);
  });

  it('passes the seam check with any mix of corrections, 200 bodies, every block shape', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed * 31337);
      const b = randomBody(rng(seed));
      const f = randomIssues('skirt', r);
      for (const silhouette of ['straight', 'pencil', 'a_line', 'trumpet', 'circle'] as const) {
        let d;
        try {
          d = draftSkirt(b, { silhouette, length: 'knee', fitting: toFitting(f, 'skirt') });
        } catch (e) {
          if (e instanceof DraftError) continue;
          throw e;
        }
        for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist }))
          if (!c.ok) failures.push(`seed ${seed} ${silhouette} ${JSON.stringify(f.issues)}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

describe('bodice corrections', () => {
  const b = randomBody(rng(5));

  it('closes a neck gape into the bust dart', () => {
    const base = draftBodice(b);
    const d = draftBodice(b, { fitting: toFitting(fitting({ 'bodice-neck-gape': 1.5 }), 'bodice') });
    const neck = (pc: (typeof d.pieces)[0]) => taggedLength(pc.outline, 'neck');
    expect(neck(base.pieces[0]) - neck(d.pieces[0])).toBeGreaterThan(1);
    expect(neck(base.pieces[0]) - neck(d.pieces[0])).toBeLessThan(2.5);
    expect(d.bustDart).toBeGreaterThan(base.bustDart + 0.5);
    expect(d.shoulder).toEqual(base.shoulder);
    expect(d.armhole).toBeCloseTo(base.armhole, 0);
  });

  it('slopes or squares the shoulders by the degrees asked', () => {
    const base = draftBodice(b);
    const d = draftBodice(b, { fitting: toFitting(fitting({ 'bodice-square': 4 }), 'bodice') });
    expect(d.shoulderSlope.back).toBeCloseTo(base.shoulderSlope.back - 4, 1);
    expect(d.shoulderSlope.front).toBeCloseTo(base.shoulderSlope.front - 4, 1);
  });

  it('drops one shoulder on a second line, with the armhole lowered to match', () => {
    const d = draftBodice(b, { fitting: toFitting(fitting({ 'bodice-low-shoulder': 1.5 }), 'bodice') });
    const alt = d.lowShoulder!;
    expect(alt.side).toBe('right');
    for (const [i, pc] of d.pieces.entries()) {
      expect(pc.alternate!.label).toBe('RIGHT SHOULDER');
      // The shoulder point is 1.5 cm lower and the shoulder keeps its length.
      const sp = (o: typeof pc.outline) => {
        const { pts, tags } = o.taggedPoints();
        return pts[tags.indexOf('shoulder') + 1];
      };
      expect(sp(alt.pieces[i].outline).y - sp(pc.outline).y).toBeCloseTo(1.5, 1);
      expect(taggedLength(alt.pieces[i].outline, 'shoulder')).toBeCloseTo(taggedLength(pc.outline, 'shoulder'), 1);
      expect(Math.abs(taggedLength(alt.pieces[i].outline, 'armhole') - taggedLength(pc.outline, 'armhole'))).toBeLessThan(1);
    }
    // The second lines sew together as the first do.
    expect(checkPattern(alt.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
  });

  it('passes the seam check with any mix of corrections, 300 bodies, every style', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed * 7703);
      const body = randomBody(rng(seed));
      const f = randomIssues('bodice', r);
      const style = {
        neckline: (['crew', 'scoop', 'v', 'square', 'boat'] as const)[seed % 5],
        length: (['waist', 'high_hip', 'hip'] as const)[(seed >> 1) % 3],
        darts: (['bust_waist', 'bust', 'none'] as const)[(seed >> 2) % 3],
        fit: (['fitted', 'regular', 'relaxed'] as const)[(seed >> 3) % 3],
      };
      const d = draftBodice(body, { ...style, fitting: toFitting(f, 'bodice') });
      const sets = [d.pieces, ...(d.lowShoulder ? [d.lowShoulder.pieces] : [])];
      for (const pieces of sets)
        for (const c of checkPattern(pieces, { finishedWaist: d.finishedWaist }))
          if (!c.ok) failures.push(`seed ${seed} ${JSON.stringify(style)} ${JSON.stringify(f.issues)}: ${c.label} (${c.detail})`);
      // A lower shoulder's line leaves the main one only above the bust: the shoulder, the armhole
      // and the top of the side seam.
      if (d.lowShoulder) {
        const below = Math.max(d.front.apex.y, d.armholeDepth + d.lowShoulder.cm + 3);
        for (const [i, pc] of d.pieces.entries()) {
          const far = leaving(d.lowShoulder.pieces[i].outline.points(), pc.outline.points()).flatMap((run) => run.slice(1, -1)).filter((q) => q.y > below);
          if (far.length) failures.push(`seed ${seed}: ${pc.name} second line strays below the armhole`);
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
