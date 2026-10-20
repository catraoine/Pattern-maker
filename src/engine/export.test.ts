import { describe, expect, it } from 'vitest';
import type { P } from './geometry';
import { draftOuter } from './outerwear';
import { draftBodice } from './bodice';
import { draftTrousers, trousersWaistband } from './trousers';
import { draftTee } from './tee';
import { withAllowances } from './allowances';
import { bounds, cutLine, Piece } from './piece';
import { columnSpans, fitRow, labelCollisions, layout, pack, packedPages, pageCount, textWidth, turnedInBox, wrapInfo } from './export';
import { EXAMPLE_VALUES } from '../measurements';

const GAP = 4;
const INFO = { pattern: 'Test pattern', madeFor: 'Cat', date: '19 Oct 2026' };

const inside = (q: P, pts: P[]) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const segDist = (a: P, b: P, q: P) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, l2 ? ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2 : 0));
  return Math.hypot(a.x + t * dx - q.x, a.y + t * dy - q.y);
};
/** The least distance between two outlines, or -1 when one reaches into the other. */
function apart(A: P[], B: P[]): number {
  let m = Infinity;
  for (const [X, Y] of [
    [A, B],
    [B, A],
  ]) {
    for (const q of X) {
      if (inside(q, Y)) return -1;
      for (let i = 0; i < Y.length; i++) m = Math.min(m, segDist(Y[i], Y[(i + 1) % Y.length], q));
    }
  }
  return m;
}

const outer = (kind: 'jacket' | 'coat') => draftOuter(EXAMPLE_VALUES as never, { kind }).pieces.map((pc) => withAllowances(pc, 'home'));

describe('the information line', () => {
  it('stays on one line when it fits, and breaks at its separators when it does not', () => {
    const line = 'PIECE 3 OF 11 · CUT 2 (1 PAIR) · SELF FABRIC';
    expect(wrapInfo(line, 0.5, 0.12, 30)).toEqual([line]);
    expect(wrapInfo(line, 0.5, 0.12, 10)).toEqual(['PIECE 3 OF 11 · CUT 2 (1 PAIR)', 'SELF FABRIC']);
  });

  it('shortens its words before dropping the fabric, and keeps the number and cutting at the least', () => {
    const line = 'PIECE 5/11 · CUT 2 ON FOLD · UPPER AND UNDER COLLAR IN SELF + INTERFACING';
    expect(wrapInfo(line, 0.42, 0.12, 10.5)).toEqual(['PIECE 5/11 · CUT 2 ON FOLD', 'UPPER AND UNDER COLLAR IN SELF + INTERF.']);
    expect(wrapInfo(line, 0.42, 0.12, 6)).toEqual(['PIECE 5/11', 'CUT 2 ON FOLD']);
    expect(fitRow(line, 0.42, 0.12, 30)).toBe(line);
    expect(fitRow(line, 0.42, 0.12, 8)).toBe('PIECE 5/11 · CUT 2 ON FOLD');
    expect(fitRow(line, 0.42, 0.12, 1)).toBe('CUT 2 ON FOLD');
  });
});

describe('packing the sheet', () => {
  for (const kind of ['jacket', 'coat'] as const) {
    it(`nests the ${kind} in rows, the pieces a gap apart, on far fewer pages than one long row`, () => {
      const pieces = outer(kind);
      const boxes = pieces.map((pc) => bounds(pc));
      const outlines = pieces.map((pc) => cutLine(pc));
      const packed = pack(outlines, boxes);
      // Each outline as laid: turned end to end within its box when the packer turned it.
      const laid = outlines.map((o, i) => (packed.turned[i] ? o.map((q) => turnedInBox(q, boxes[i])) : o));
      const placed = laid.map((o, i) => o.map((q) => ({ x: q.x + packed.at[i].x - boxes[i][0], y: q.y + packed.at[i].y - boxes[i][1] })));
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++) expect(apart(placed[i], placed[j]), `${pieces[i].name} / ${pieces[j].name}`).toBeGreaterThanOrEqual(GAP - 0.01);
      for (const at of packed.at) {
        expect(at.x).toBeGreaterThanOrEqual(-0.01);
        expect(at.y).toBeGreaterThanOrEqual(-0.01);
      }
      // The sheet is nowhere near as oblong as a single row of pieces.
      expect(packed.width / packed.height).toBeLessThan(3);
      const sizes = boxes.map(([x0, y0, x1, y1]) => ({ w: x1 - x0, h: y1 - y0 }));
      let x = 0;
      const row = { at: sizes.map((s) => ({ x: (x += s.w + GAP) - s.w - GAP, y: 0 })), turned: sizes.map(() => false), width: x - GAP, height: Math.max(...sizes.map((s) => s.h)) };
      const spans = laid.map((o, i) => columnSpans(o.map((q) => ({ x: q.x - boxes[i][0], y: q.y - boxes[i][1] }))));
      const pages = packedPages(packed, sizes, spans);
      expect(pages).toBeLessThan(packedPages(row, sizes));
      // Turning pieces end to end brought the jacket from 53 pages to 50 and the coat from 83 to 79.
      expect(pages).toBeLessThanOrEqual(kind === 'jacket' ? 51 : 80);
      // The packer counts the pieces' outlines; the laid-out sheet also carries labels and notches, so it can run a page over.
      const sheet = layout(pieces, kind, [], INFO);
      expect(Math.abs(pageCount(sheet, 'a4') - pages)).toBeLessThanOrEqual(1);
      // Some pieces are turned, and a turned piece is drawn turned: its cutting line as laid, with
      // its name block and every other label on it the right way up and still inside it.
      expect(packed.turned.some(Boolean)).toBe(true);
      pieces.forEach((pc, i) => {
        const cut = sheet.prims.find((pr) => pr.kind === 'poly' && pr.style === 'cut' && pr.piece === i && pr.closed)!;
        expect(cut.kind === 'poly' && cut.pts.length).toBe(placed[i].length);
        if (cut.kind !== 'poly') return;
        cut.pts.forEach((q, k) => {
          expect(q.x).toBeCloseTo(placed[i][k].x + 3, 3);
          expect(q.y).toBeCloseTo(placed[i][k].y + 3, 3);
        });
        for (const pr of sheet.prims) {
          if (pr.kind !== 'text' || pr.piece !== i) continue;
          expect(pr.rotate, `${pc.name}: ${pr.text}`).toBeGreaterThan(-91);
          expect(pr.rotate, `${pc.name}: ${pr.text}`).toBeLessThanOrEqual(91);
          expect(inside(pr.at, cut.pts), `${pc.name}: ${pr.text}`).toBe(true);
        }
      });
    });
  }

  it('leaves the title block its corner', () => {
    const pieces = outer('jacket');
    const sheet = layout(pieces, 'Jacket', [], INFO);
    const square = sheet.prims.find((pr) => pr.kind === 'text' && pr.text === '10 CM')!;
    expect(square.kind === 'text' && square.at.x).toBeCloseTo(8, 1);
    // No cutting line reaches into the 10 cm square or the card beside it.
    for (const pr of sheet.prims) {
      if (pr.kind !== 'poly' || pr.style !== 'cut') continue;
      for (const q of pr.pts) expect(q.x > 3 + 56 || q.y > 13).toBe(true);
    }
  });
});

describe('labels on small pieces', () => {
  const trousers = draftTrousers({ waist: 76, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, crotch_depth: 27, crotch_length: 70 });
  const tee = draftTee({ full_bust: 92, waist: 76, full_hip: 102, waist_to_hip: 20.5, neck: 35, shoulder_width: 38, nape_to_waist: 41, armscye: 40, arm_length: 59, upper_arm: 29, wrist: 16 });
  const shirt = draftBodice(EXAMPLE_VALUES as never, { fit: 'regular', collar: 'shirt', closure: 'front_buttons' });
  const cases: [string, Piece[]][] = [
    ['jacket', outer('jacket')],
    ['coat', outer('coat')],
    ['trousers', [...trousers.pieces, trousersWaistband(trousers, 1.5)].map((pc) => withAllowances(pc, 'home'))],
    ['tee', tee.pieces],
    ['shirt-collar bodice', shirt.pieces.map((pc) => withAllowances(pc, 'home'))],
  ];
  const texts = (pieces: Piece[], name: string) => {
    const sheet = layout(pieces, name, [], INFO);
    const i = pieces.findIndex((pc) => pc.name === name);
    return sheet.prims.flatMap((pr) => (pr.kind === 'text' && pr.piece === i ? [pr.text] : []));
  };

  for (const [name, pieces] of cases) {
    it(`keeps every label of the ${name} clear of the others`, () => {
      expect(labelCollisions(layout(pieces, name, [], INFO))).toEqual([]);
    });
  }

  it('keeps the collar\'s name block off its roll line', () => {
    const pieces = cases[0][1];
    const sheet = layout(pieces, 'Jacket', [], INFO);
    const i = pieces.findIndex((pc) => pc.name === 'Collar');
    // The roll line as drawn on the sheet: the collar's one internal line, two points long.
    const roll = sheet.prims.find((pr) => pr.kind === 'poly' && pr.piece === i && pr.style === 'mark' && pr.pts.length === 2 && !pr.closed)!;
    expect(roll).toBeDefined();
    if (roll.kind !== 'poly') return;
    const [a, b] = roll.pts;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(10);
    // The name block: the name, its information line(s) and the fabric. None of their boxes meets the roll line.
    const block = sheet.prims.filter((pr): pr is Extract<typeof pr, { kind: 'text' }> => pr.kind === 'text' && pr.piece === i && /^COLLAR$|^PIECE |COLLAR IN SELF/.test(pr.text));
    expect(block.length).toBeGreaterThanOrEqual(2);
    for (const pr of block) {
      expect(pr.rotate).toBe(0);
      const hw = textWidth(pr.text, pr.size, pr.tracking ?? 0) / 2;
      const top = pr.at.y - pr.size * 0.75;
      const bottom = pr.at.y + pr.size * 0.1;
      // The line's height where it passes the box, if it does.
      const [x0, x1] = [pr.at.x - hw, pr.at.x + hw];
      const yAt = (x: number) => a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
      const lo = Math.max(x0, Math.min(a.x, b.x));
      const hi = Math.min(x1, Math.max(a.x, b.x));
      if (lo > hi) continue;
      const ys = [yAt(lo), yAt(hi)];
      const clear = Math.max(...ys) < top || Math.min(...ys) > bottom;
      expect(clear, `${pr.text} crosses the roll line`).toBe(true);
    }
  });

  it('names the collar as it is cut, on the fold in self', () => {
    const t = texts(cases[0][1], 'Collar');
    expect(t.some((x) => x.includes('UPPER AND UNDER COLLAR IN SELF'))).toBe(true);
    expect(t.some((x) => /BIAS/.test(x))).toBe(false);
  });

  it('puts the cutting words of a neckband in its information line, once', () => {
    const t = texts(cases[3][1], 'Neckband');
    expect(t.filter((x) => /STRETCH ALONG IT/i.test(x))).toHaveLength(1);
    expect(t).toContain('NECKBAND');
  });

  it('keeps the name and the cutting of a fly shield and a collar stand', () => {
    for (const [pieces, name] of [
      [cases[2][1], 'Fly shield'],
      [cases[4][1], 'Collar stand'],
    ] as const) {
      const t = texts(pieces, name);
      expect(t).toContain(name.toUpperCase());
      expect(t.some((x) => /CUT \d/.test(x))).toBe(true);
    }
  });
});
