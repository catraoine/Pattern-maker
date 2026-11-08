import { describe, expect, it } from 'vitest';
import { draftBodice } from './bodice';
import { len, sub, taggedLength } from './geometry';
import { cutLine } from './piece';
import { toDxf } from './dxf';
import { layout, labelCollisions } from './export';
import { importDxf } from './importDxf';
import { EDITED, applyCut, applyPatternEdits, cutEnds, cutMark, hasNewPieces, sewnForAllRound } from './pieceEdit';
import { handlesOf } from './pointEdit';
import { pairs } from './qc';
import { draftSkirt } from './skirt';

const sm = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const bm = { full_bust: 92, high_bust: 86, waist: 74, neck: 35, shoulder_width: 38, shoulder_length: 12, across_back: 35, across_front: 32, nape_to_waist: 41, front_hps_to_waist: 44, bust_depth: 26, apex_separation: 18, armscye: 40 };

const skirt = draftSkirt(sm, { silhouette: 'pencil', length: 'knee' });
const front = skirt.pieces.find((pc) => /front/i.test(pc.name))!;
const box = (pts: { x: number; y: number }[]) => ({ x0: Math.min(...pts.map((q) => q.x)), x1: Math.max(...pts.map((q) => q.x)), y0: Math.min(...pts.map((q) => q.y)), y1: Math.max(...pts.map((q) => q.y)) });
const b = box(front.outline.points());
const midX = (b.x0 + b.x1) / 2;
// A line drawn from the waist down to the hem, started a little inside the piece as a finger would.
const down = [{ x: midX, y: b.y0 + 3 }, { x: midX + 0.3, y: (b.y0 + b.y1) / 2 }, { x: midX, y: b.y1 - 3 }];
const hemOf = (pc: typeof front) => taggedLength(pc.outline, 'hem');
const waistOf = (pc: typeof front) => taggedLength(pc.outline, 'waist');

describe('cutting the flat pattern with a drawn line', () => {
  it('finds where a drawn line meets the edges, and turns about where it was started', () => {
    const ends = cutEnds(front, down)!;
    expect(ends).toBeDefined();
    expect(ends.hinge.y).toBeLessThan(ends.far.y);
    expect(Math.abs(ends.hinge.y - b.y0)).toBeLessThan(2);
    expect(Math.abs(ends.far.y - b.y1)).toBeLessThan(3);
    expect(cutEnds(front, [{ x: b.x1 + 5, y: b.y0 }, { x: b.x1 + 6, y: b.y1 }])).toBeUndefined();
  });

  it('spreads a skirt open at the hem for flare, keeping its waist and side seam', () => {
    const [out] = applyCut([front], { cut: 'spread', piece: front.name, line: down, by: 10 }).filter((pc) => pc.name === front.name);
    expect(hemOf(out) - hemOf(front)).toBeGreaterThan(9);
    expect(hemOf(out) - hemOf(front)).toBeLessThan(11.5);
    expect(waistOf(out)).toBeCloseTo(waistOf(front), 1);
    expect(taggedLength(out.outline, 'side')).toBeCloseTo(taggedLength(front.outline, 'side'), 1);
    expect(out.meta.edited).toBe(true);
    expect(out.labels.some((l) => l.text === EDITED)).toBe(true);
    // It still offsets into a cutting line, and nothing on it is lost.
    expect(cutLine(out).length).toBeGreaterThan(10);
    expect(out.lines.length).toBe(front.lines.length);
  });

  it('turns the other way when the line is drawn up from the hem: the waist opens and is gathered', () => {
    const up = [...down].reverse();
    const [out] = applyCut([front], { cut: 'spread', piece: front.name, line: up, by: 6 });
    expect(waistOf(out) - waistOf(front)).toBeGreaterThan(5);
    expect(hemOf(out)).toBeCloseTo(hemOf(front), 0);
    expect(out.labels.some((l) => l.text === 'GATHER')).toBe(true);
  });

  it('adds fullness evenly, gathered into the waist or folded as a pleat', () => {
    const [g] = applyCut([front], { cut: 'fullness', piece: front.name, line: down, by: 8 });
    expect(waistOf(g) - waistOf(front)).toBeGreaterThan(7.5);
    expect(hemOf(g) - hemOf(front)).toBeGreaterThan(7.5);
    expect(g.notches.length).toBe(front.notches.length + 2);
    const [pl] = applyCut([front], { cut: 'fullness', piece: front.name, line: down, by: 8, finish: 'pleats' });
    expect(pl.lines.length).toBe(front.lines.length + 2);
    expect(pl.labels.some((l) => l.text.startsWith('PLEAT'))).toBe(true);
  });

  it('cuts a yoke off as a new piece along the line as drawn, notched to match', () => {
    const y = b.y0 + 12;
    const across = [{ x: b.x0 - 2, y }, { x: midX, y: y + 1.2 }, { x: b.x1 + 2, y: y + 2 }];
    const out = applyCut(skirt.pieces, { cut: 'piece', piece: front.name, line: across, by: 0 });
    expect(out.length).toBe(skirt.pieces.length + 1);
    const yoke = out.find((pc) => pc.meta.newPiece)!;
    const rest = out.find((pc) => pc.name === front.name)!;
    expect(yoke.name).toBe(`${front.name} yoke`);
    expect(hasNewPieces(out)).toBe(true);
    // The new seam is the same length on both, and each has a notch on it.
    expect(taggedLength(yoke.outline, 'join')).toBeCloseTo(taggedLength(rest.outline, 'join'), 2);
    expect(yoke.notches.length).toBeGreaterThan(0);
    // The darts end above the cut, so they are carried on to the seam and closed into the yoke (round 3): no dart is
    // left to sew on either, the waist is as long as it was sewn, and both keep the fold.
    expect(yoke.meta.dartsClosed).toBe(front.lines.length);
    expect(yoke.lines.length).toBe(0);
    expect(rest.lines.length).toBe(0);
    expect(taggedLength(yoke.outline, 'waist')).toBeCloseTo(waistOf(front), 1);
    expect(taggedLength(yoke.outline, 'dart')).toBe(0);
    expect(!!yoke.fold).toBe(!!front.fold);
    // A new piece isn't paired with the back, so moving points still walks front with back.
    expect(pairs(out).every((g) => !g.front.meta.newPiece && !g.back.meta.newPiece)).toBe(true);
    // Its name can be given.
    const named = applyCut(skirt.pieces, { cut: 'piece', piece: front.name, line: across, by: 0, name: 'Hip yoke' });
    expect(named.some((pc) => pc.name === 'Hip yoke')).toBe(true);
  });

  it('closes darts into a yoke cut across them, leaving the rest of each dart on the lower piece (round 3)', () => {
    const across = [{ x: b.x0 - 2, y: b.y0 + 4 }, { x: b.x1 + 2, y: b.y0 + 4.5 }];
    const out = applyCut([front], { cut: 'piece', piece: front.name, line: across, by: 0 });
    const yoke = out.find((pc) => pc.meta.newPiece)!;
    const rest = out.find((pc) => pc.name === front.name)!;
    expect(yoke.meta.dartsClosed).toBe(2);
    expect(yoke.lines.length).toBe(0);
    expect(rest.lines.length).toBe(2);
    expect(taggedLength(yoke.outline, 'waist')).toBeCloseTo(waistOf(front), 1);
    // Sewn, the lower piece's seam is as long as the yoke's: what the darts take there is what the yoke lost.
    const intake = rest.lines.reduce((t, ln) => t + len(sub(ln.start, ln.segs[1].to)), 0);
    expect(taggedLength(rest.outline, 'join') - intake).toBeCloseTo(taggedLength(yoke.outline, 'join'), 0);
    // The fold stays straight and where it was.
    expect(yoke.fold?.[0].x).toBeCloseTo(front.fold![0].x, 3);
    expect(yoke.fold?.[1].x).toBeCloseTo(front.fold![1].x, 3);
    // A band cut off near the hem is not a yoke: the darts stay as drafted.
    const band = applyCut([front], { cut: 'piece', piece: front.name, line: [{ x: b.x0 - 2, y: b.y1 - 10 }, { x: b.x1 + 2, y: b.y1 - 10 }], by: 0 });
    expect(band.find((pc) => pc.name === front.name)!.lines.length).toBe(2);
  });

  it('marks each kept cut half way along its line, ends where it meets the edges', () => {
    const m = cutMark([front], { cut: 'spread', piece: front.name, line: down, by: 6 })!;
    expect(Math.abs(m.at.y - (b.y0 + b.y1) / 2)).toBeLessThan(3);
    expect(m.ends[0].y).toBeLessThan(m.ends[1].y);
    expect(cutMark([front], { cut: 'spread', piece: 'Nothing', line: down, by: 6 })).toBeUndefined();
  });

  it('applies moves and cuts in the order made, so a point moved on a cut piece moves', () => {
    const across = [{ x: b.x0 - 2, y: b.y0 + 12 }, { x: b.x1 + 2, y: b.y0 + 13 }];
    const cut = applyCut(skirt.pieces, { cut: 'piece', piece: front.name, line: across, by: 0 });
    const yoke = cut.find((pc) => pc.meta.newPiece)!;
    const h = handlesOf([yoke])[0];
    const out = applyPatternEdits(skirt.pieces, [
      { cut: 'piece', piece: front.name, line: across, by: 0 },
      { piece: yoke.name, at: h.at, by: { x: 0, y: -1 } },
    ]);
    const moved = handlesOf([out.find((pc) => pc.name === yoke.name)!]).find((x) => x.at === h.at)!;
    expect(len(sub(moved.pos, h.pos))).toBeGreaterThan(0.5);
  });

  it('sews a new piece back on in All round as cut, then with what was moved or spread after the cut (round 4)', () => {
    const across = [{ x: b.x0 - 2, y: b.y0 + 12 }, { x: midX, y: b.y0 + 13 }, { x: b.x1 + 2, y: b.y0 + 14 }];
    const cut = { cut: 'piece' as const, piece: front.name, line: across, by: 0 };
    const sewnOf = (pcs: typeof skirt.pieces) => sewnForAllRound(pcs).find((pc) => pc.name === front.name)!;
    const seamOn = (pc: typeof front) => pc.lines.filter((ln) => ln.tags[0] === 'newseam').length;
    // Nothing edited after the cut: the piece as it was before it, darts and all, the seam drawn on it.
    const asCut = applyPatternEdits(skirt.pieces, [cut]);
    const plain = sewnOf(asCut);
    expect(hemOf(plain)).toBeCloseTo(hemOf(front), 3);
    expect(plain.lines.length).toBe(front.lines.length + 1);
    // A spread for flare on the lower piece after the cut: the hem sewn in All round is as much wider, the waist and
    // its darts as drafted (the yoke had them closed into it; sewn, they are darts again).
    const flared = applyPatternEdits(skirt.pieces, [cut, { cut: 'spread', piece: front.name, line: [{ x: midX, y: b.y0 + 16 }, { x: midX, y: b.y1 - 3 }], by: 8 }]);
    const lower = flared.find((pc) => pc.name === front.name)!;
    expect(hemOf(lower) - hemOf(front)).toBeGreaterThan(7.5);
    const sewn = sewnOf(flared);
    expect(sewnForAllRound(flared).some((pc) => pc.meta.newPiece)).toBe(false);
    expect(hemOf(sewn)).toBeCloseTo(hemOf(lower), 3);
    expect(taggedLength(sewn.outline, 'waist') + taggedLength(sewn.outline, 'dart')).toBeCloseTo(waistOf(front) + taggedLength(front.outline, 'dart'), 1);
    expect(sewn.lines.filter((ln) => ln.segs.length === 2).length).toBe(front.lines.length);
    expect(seamOn(sewn)).toBe(1);
    expect(taggedLength(sewn.outline, 'join')).toBe(0);
    // A point moved on the yoke after the cut moves on the sewn piece too.
    const yoke = asCut.find((pc) => pc.meta.newPiece)!;
    const h = handlesOf([yoke]).find((x) => !x.at.includes('join') && !x.at.startsWith('dart'))!;
    const moved = sewnOf(applyPatternEdits(skirt.pieces, [cut, { piece: yoke.name, at: h.at, by: { x: 0, y: -1.5 } }]));
    const near = (pc: typeof front) => Math.min(...pc.outline.points(16).map((q) => len(sub(q, { x: h.pos.x, y: h.pos.y - 1.5 }))));
    expect(near(moved)).toBeLessThan(0.3);
    expect(near(plain)).toBeGreaterThan(1);
  });

  it('leaves a pattern nobody edited exactly as drafted', () => {
    expect(applyPatternEdits(skirt.pieces, [])).toBe(skirt.pieces);
    expect(applyPatternEdits(skirt.pieces, undefined)).toBe(skirt.pieces);
  });

  it('spreads a bodice front from the shoulder for a fuller hem', () => {
    const bodice = draftBodice(bm, { fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist' });
    const f = bodice.pieces.find((pc) => /front/i.test(pc.name))!;
    const fb = box(f.outline.points());
    const line = [{ x: (fb.x0 + fb.x1) / 2 - 2, y: fb.y0 + 2 }, { x: (fb.x0 + fb.x1) / 2 - 2, y: fb.y1 - 1 }];
    const out = applyCut(bodice.pieces, { cut: 'spread', piece: f.name, line, by: 5 });
    const e = out.find((pc) => pc.name === f.name)!;
    expect(e.outline.points().length).toBeGreaterThan(f.outline.points().length - 1);
    expect(cutLine(e).every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
  });

  it('prints and writes a DXF file with the cut pieces, read back as the same pieces', () => {
    const across = [{ x: b.x0 - 2, y: b.y0 + 12 }, { x: midX, y: b.y0 + 13 }, { x: b.x1 + 2, y: b.y0 + 14 }];
    const pcs = applyPatternEdits(skirt.pieces, [
      { cut: 'spread', piece: front.name, line: down, by: 8 },
      { cut: 'piece', piece: front.name, line: across, by: 0 },
    ]);
    const sheet = layout(pcs, 'Skirt', []);
    expect(sheet).toBeDefined();
    expect(labelCollisions(sheet).length).toBeLessThanOrEqual(labelCollisions(layout(skirt.pieces, 'Skirt', [])).length + 1);
    const back = importDxf(toDxf(pcs, { style: 'Skirt', size: 'Example', date: '2026-11-07' }));
    expect(back.pieces.map((pc) => pc.name).sort()).toEqual(pcs.map((pc) => pc.name).sort());
  });
});
