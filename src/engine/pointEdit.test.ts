import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { taggedLength } from './geometry';
import { applyPointEdits, handlesOf, measureAt, pointOnEdge } from './pointEdit';
import { checkPattern } from './qc';
import { draftSkirt } from './skirt';

const bm = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40 };
const sm = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };

const failing = (pcs: Parameters<typeof checkPattern>[0]) =>
  checkPattern(pcs)
    .filter((c) => !c.ok && c.group !== 'Corners')
    .map((c) => c.label);

describe('dragging points on the flat pattern', () => {
  const bodice = draftBodice(bm, { fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist' });
  const front = bodice.pieces.find((pc) => /front/i.test(pc.name))!;
  const back = bodice.pieces.find((pc) => /back/i.test(pc.name))!;
  const underarm = handlesOf([front]).find((h) => h.tags.includes('side') && h.tags.includes('armhole'))!;

  it('finds the corners and dart points to grab', () => {
    const hs = handlesOf(bodice.pieces);
    expect(hs.some((h) => h.kind === 'dart')).toBe(true);
    expect(underarm).toBeDefined();
    // Dart legs are not grabbed: the dart point is moved instead.
    expect(hs.every((h) => !h.tags.includes('dart') || h.kind === 'dart')).toBe(true);
  });

  it('walks the side seam on the back with the front', () => {
    const moved = applyPointEdits(bodice.pieces, [{ piece: front.name, at: underarm.at, by: { x: 1.5, y: 0.5 } }]);
    const f = moved.find((pc) => pc.name === front.name)!;
    const b = moved.find((pc) => pc.name === back.name)!;
    expect(taggedLength(f.outline, 'side')).not.toBeCloseTo(taggedLength(front.outline, 'side'), 1);
    expect(Math.abs(taggedLength(f.outline, 'side') - taggedLength(b.outline, 'side')) - Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.05);
    expect(failing(moved)).toEqual(failing(bodice.pieces));
  });

  it('keeps the back shoulder ease when the shoulder point moves', () => {
    const tip = handlesOf([front]).find((h) => h.tags.includes('shoulder') && h.tags.includes('armhole'))!;
    const moved = applyPointEdits(bodice.pieces, [{ piece: front.name, at: tip.at, by: { x: 1, y: -0.4 } }]);
    expect(failing(moved)).toEqual(failing(bodice.pieces));
    const f = moved.find((pc) => pc.name === front.name)!;
    expect(taggedLength(f.outline, 'shoulder')).toBeGreaterThan(taggedLength(front.outline, 'shoulder') + 0.5);
  });

  it('keeps the dart trued when its point moves', () => {
    const dart = handlesOf([front]).find((h) => h.kind === 'dart')!;
    const dir = measureAt(bodice.pieces, dart)!.dir;
    // Dragged out past its point and a little to one side: it lengthens along its own centre line.
    const moved = applyPointEdits(bodice.pieces, [{ piece: front.name, at: dart.at, by: { x: dir.x * 2 + dir.y, y: dir.y * 2 - dir.x } }]);
    expect(failing(moved)).toEqual(failing(bodice.pieces));
    const before = measureAt(bodice.pieces, dart)!.value;
    const after = measureAt(moved, handlesOf(moved).find((h) => h.piece === front.name && h.at === dart.at)!)!.value;
    expect(after).toBeGreaterThan(before + 1);
  });

  it('slides a point on the fold only along the fold', () => {
    const cf = handlesOf([front]).find((h) => h.tags.includes('fold') && h.tags.includes('neck'))!;
    const moved = applyPointEdits(bodice.pieces, [{ piece: front.name, at: cf.at, by: { x: 2, y: 3 } }]);
    const h = handlesOf(moved).find((x) => x.piece === front.name && x.at === cf.at)!;
    expect(h.pos.x).toBeCloseTo(cf.pos.x, 5);
    expect(h.pos.y).toBeCloseTo(cf.pos.y + 3, 5);
  });

  it('adds a point to the side seam on both pieces and curves it in', () => {
    const skirt = draftSkirt(sm, { silhouette: 'a_line' });
    const sf = skirt.pieces[0];
    const { pts, tags } = sf.outline.taggedPoints(48);
    const onSide = pts.filter((_, i) => tags[i] === 'side');
    const side = onSide[Math.floor(onSide.length / 2)];
    const at = pointOnEdge(sf, side, 1);
    expect(at).toMatch(/^\+side0@/);
    const moved = applyPointEdits(skirt.pieces, [{ piece: sf.name, at: at!, by: { x: -1, y: 0 } }]);
    const hs = handlesOf(moved);
    expect(hs.filter((h) => h.at === at)).toHaveLength(2);
    expect(failing(moved)).toEqual(failing(skirt.pieces));
  });

  it('keeps every check that passed, whichever corner of a bodice or skirt is dragged', () => {
    const skirt = draftSkirt(sm, { silhouette: 'a_line' });
    for (const d of [bodice, skirt]) {
      const was = new Map(checkPattern(d.pieces).map((c) => [c.label, c.ok]));
      for (const pc of d.pieces.slice(0, 2)) {
        for (const h of handlesOf([pc]))
          for (const by of [{ x: 1.5, y: 0.6 }, { x: -1, y: -1 }]) {
            const moved = applyPointEdits(d.pieces, [{ piece: pc.name, at: h.at, by }]);
            const broken = checkPattern(moved).filter((c) => !c.ok && was.get(c.label) !== false);
            expect(broken.map((c) => `${pc.name} ${h.at}: ${c.label}`)).toEqual([]);
          }
      }
    }
  });

  it('ignores moves for points the pattern no longer has', () => {
    const moved = applyPointEdits(bodice.pieces, [{ piece: front.name, at: 'nothing|here#0', by: { x: 1, y: 1 } }]);
    expect(failing(moved)).toEqual(failing(bodice.pieces));
  });
});
