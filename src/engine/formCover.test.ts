import { describe, expect, it } from 'vitest';
import { EXAMPLE_VALUES } from '../measurements';
import { buildBody, girth } from './body3d';
import { CHECK_TOLERANCE, FORM_SIZES, coverPanels, coverPieces, edgeLength, formCheck, padMap } from './formCover';
import { cutLine } from './piece';

const BIG = { ...EXAMPLE_VALUES, full_bust: 118, high_bust: 108, waist: 102, full_hip: 128 };

describe('form cover', () => {
  for (const [name, values] of [['example', EXAMPLE_VALUES], ['fuller', BIG]] as const) {
    it(`sews together edge to edge (${name} body)`, () => {
      const panels = coverPanels(buildBody(values));
      for (let i = 0; i + 1 < panels.length; i++) {
        const back = edgeLength(panels[i].rows, 'toBack');
        const front = edgeLength(panels[i + 1].rows, 'toFront');
        // On the real body the shoulder slopes steeply out from the neck, so at the top of the side seam one edge
        // takes a touch of ease: within the cover's own check tolerance.
        expect(Math.abs(back - front)).toBeLessThan(CHECK_TOLERANCE);
      }
    });

    it(`goes round the form at its measured girths (${name} body)`, () => {
      const body = buildBody(values);
      const panels = coverPanels(body);
      for (const id of ['full_bust', 'waist', 'full_hip'] as const) {
        const mark = body.marks.find((m) => m.id === id)!;
        const row = panels[0].marks.find((m) => m.id === id)!.row;
        // Four pieces make half the cover.
        const round = 2 * panels.reduce((s, pn) => s + pn.rows[row].toFront + pn.rows[row].toBack, 0);
        expect(round).toBeCloseTo(mark.girth, 0);
        const ring = body.rings.find((r) => Math.abs(r.h - mark.h) < 1e-6)!;
        expect(round).toBeCloseTo(girth(ring), 0);
      }
    });
  }

  it('makes four pairs with seam allowance, notches and a waist line', () => {
    const pieces = coverPieces(EXAMPLE_VALUES);
    expect(pieces.map((pc) => pc.name)).toEqual(['Form cover centre front', 'Form cover side front', 'Form cover side back', 'Form cover centre back']);
    for (const pc of pieces) {
      expect(pc.cut).toMatch(/Cut 2/);
      expect(pc.balance?.[0].label).toBe('WAIST');
      expect(cutLine(pc).length).toBeGreaterThan(20);
      // The bust, two waist notches and the hip on each edge that sews to another piece.
      expect(pc.notches.length).toBe(pc.name.endsWith('centre front') || pc.name.endsWith('centre back') ? 4 : 8);
    }
  });
});

describe('pad map', () => {
  it('picks the largest store form that fits inside the person, and pads it out', () => {
    const map = padMap(EXAMPLE_VALUES);
    expect(map.size).toBe('10');
    for (const pad of map.pads) {
      expect(pad.form).toBeLessThanOrEqual(pad.you + 0.25);
      expect(pad.thick).toBeCloseTo(Math.max(0, pad.you - pad.form) / (2 * Math.PI), 1);
    }
  });

  it('has no size when the person is smaller than the smallest form', () => {
    const map = padMap({ ...EXAMPLE_VALUES, full_bust: 78, high_bust: 74, waist: 58, full_hip: 84 });
    expect(map.size).toBeUndefined();
    expect(map.pads.every((p) => p.thick === 0)).toBe(true);
  });

  it('chart sizes grow at every girth', () => {
    for (let i = 1; i < FORM_SIZES.length; i++) for (const id of ['full_bust', 'waist', 'full_hip'] as const) expect(FORM_SIZES[i][id]).toBeGreaterThan(FORM_SIZES[i - 1][id]);
  });
});

describe('form check', () => {
  it('passes girths within a layer of wadding and says what to add or take out', () => {
    const rows = formCheck(EXAMPLE_VALUES, { full_bust: 92.2, waist: 74, full_hip: 104 });
    expect(rows.find((r) => r.id === 'full_bust')!.fix).toBeUndefined();
    expect(rows.find((r) => r.id === 'waist')!.fix).toMatch(/^Add .* round the waist/);
    expect(rows.find((r) => r.id === 'full_hip')!.fix).toMatch(/^Take out .* round the hip/);
    expect(Math.abs(rows[0].short)).toBeLessThanOrEqual(CHECK_TOLERANCE);
  });

  it('skips girths not measured yet', () => {
    expect(formCheck(EXAMPLE_VALUES, { waist: 76 }).map((r) => r.id)).toEqual(['waist']);
  });
});
