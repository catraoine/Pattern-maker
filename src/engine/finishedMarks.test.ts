import { describe, expect, it } from 'vitest';
import { EXAMPLE_VALUES } from '../measurements';
import { withAllowances } from './allowances';
import { draftBodice } from './bodice';
import { draftDress } from './dress';
import { labelCollisions, layout } from './export';
import { withFinishedMarks } from './finishedMarks';
import { draftOuter } from './outerwear';
import type { Piece } from './piece';
import { draftSkirt } from './skirt';
import { bodiceSpec, dressSpec, outerSpec, skirtSpec, teeSpec, trousersSpec } from './spec';
import { draftTee } from './tee';
import { draftTrousers } from './trousers';
import { finishedLines } from '../ui/FinishedTable';

const M = EXAMPLE_VALUES as never;
const INFO = { pattern: 'Test pattern', madeFor: 'Cat', date: '28 Oct 2026' };
const home = (pcs: Piece[]) => pcs.map((pc) => withAllowances(pc, 'home'));

const skirt = draftSkirt(M);
const bodice = draftBodice(M);
const dress = draftDress(M);
const trousers = draftTrousers(M);
const tee = draftTee(M);
const jacket = draftOuter(M, { kind: 'jacket' });

const cases: [string, Piece[], ReturnType<typeof skirtSpec>, string[]][] = [
  ['skirt', home(skirt.pieces), skirtSpec(M, skirt), ['WAIST', 'HIP']],
  ['bodice', home(bodice.pieces), bodiceSpec(M, bodice, 'waist'), ['BUST', 'WAIST']],
  ['dress', home(dress.pieces), dressSpec(M, dress), ['BUST', 'WAIST', 'HIP']],
  ['trousers', home(trousers.pieces), trousersSpec(M, trousers), ['WAIST', 'HIP']],
  ['tee', tee.pieces, teeSpec(M, tee), ['BUST']],
  ['jacket', home(jacket.pieces), outerSpec(M, jacket), ['BUST']],
];

describe('finished measurements on the printed pieces', () => {
  for (const [name, pieces, spec, want] of cases) {
    const marked = withFinishedMarks(pieces, spec);
    const marks = marked.flatMap((pc) => pc.finished ?? []);
    it(`marks the ${name}'s ${want.join(', ').toLowerCase()} with the finished round, the body and the ease`, () => {
      for (const w of want) {
        const m = marks.find((x) => x.title.startsWith(`FINISHED ${w} `));
        expect(m, w).toBeDefined();
        const r = spec.find((x) => x.label.toUpperCase() === w)!;
        expect(m!.title).toBe(`FINISHED ${w} ${Math.round((r.finished as number) * 10) / 10} CM`);
        expect(m!.note).toContain(`YOU ${r.body}`);
      }
      // Only on front pieces of the shell, never a back, a facing or a sleeve.
      for (const pc of marked) if (pc.finished) expect(pc.name).not.toMatch(/back|facing|sleeve/i);
    });
    it(`keeps the ${name}'s labels clear of the marks`, () => {
      expect(labelCollisions(layout(marked, name, [], INFO))).toEqual([]);
    });
  }
});

describe('the finished measurements table', () => {
  it('shows the dress against you with the ease and a fit word, and its length', () => {
    const lines = finishedLines(dressSpec(M, dress));
    const bust = lines.find((l) => l.label === 'Bust')!;
    expect(bust.ease).toBeCloseTo(dress.finishedBust - (EXAMPLE_VALUES.full_bust as number), 1);
    expect(['Close', 'Comfy', 'Roomy']).toContain(bust.fit);
    expect(lines.some((l) => l.label === 'Length, nape to hem')).toBe(true);
    // Zips, bones and cutting sizes stay on the printed spec sheet.
    expect(lines.every((l) => !/zip|cut/i.test(l.label))).toBe(true);
  });
  it("reads a knit's negative ease as stretching on", () => {
    const lines = finishedLines([{ label: 'Bust', body: 92, ease: -4, finished: 88 }], { knit: true });
    expect(lines[0].fit).toBe('Stretches on');
  });
  it('reads an elastic waist at the elastic', () => {
    const lines = finishedLines([{ label: 'Waist', body: 76, ease: 30, finished: 106 }], { elasticCm: 70 });
    expect(lines[0]).toMatchObject({ label: 'Waist, on elastic', finished: 70, ease: -6 });
  });
});
