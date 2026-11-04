import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkPatterns, patternDesigns, patternProblems, patternReport, selfCrossing, walkDesign } from './patternSweep';
import { randomArms, randomBody, randomCrotch, rng } from './engine/randomBodies';
import { EXAMPLE_BODY, MeasurementValues } from './measurements';
import { Path, p } from './engine/geometry';
import type { Piece } from './engine/piece';

// Pattern geometry on every option (Quality: Automated checks, Cat 2026-11-04). Every option of every garment is drafted
// to the example body and built into its printed pattern, and the pattern is walked: seams that sew together match,
// notches line up and sit on the edge, and no piece crosses itself. It is held to src/patternOptions.json, the faults
// each design had when it was last looked at: the check fails on a new fault, or a design not in the file yet. A fault
// in the file is a real one to fix (they are listed for Cat), never one to hide: when it is fixed, PATTERN_OPTIONS=write
// takes it out of the file. PATTERN_BODIES=<n> (nightly) walks every option on that many random bodies too, and only
// reports.
const file = new URL('./patternOptions.json', import.meta.url);

describe('pattern geometry: every option on its own', () => {
  it('drafts every option into a sound pattern, or no worse than src/patternOptions.json', () => {
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const results = patternDesigns().map((d) => walkDesign(d));
    const c = checkPatterns(results, known);
    if (process.env.PATTERN_REPORT) writeFileSync(process.env.PATTERN_REPORT, patternReport(results, c));
    if (process.env.PATTERN_OPTIONS === 'write') writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(c.now).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
    else {
      expect(c.worse, 'new pattern faults (fix them; see patternSweep.ts)').toEqual([]);
      expect(c.unseen, 'new options: look at their pattern, then add them to src/patternOptions.json (PATTERN_OPTIONS=write)').toEqual([]);
    }
  }, 600_000);
});

const BODIES = Number(process.env.PATTERN_BODIES ?? 0);
describe.skipIf(!BODIES)('pattern geometry on random bodies', () => {
  it(`walks every option on ${BODIES} random bodies and reports`, () => {
    const seed = Number(process.env.PATTERN_SEED ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const r = rng(seed);
    const designs = patternDesigns();
    const results = Array.from({ length: BODIES }, (_, i) => {
      const b = randomBody(r);
      const values = { ...EXAMPLE_BODY, ...b, ...randomArms(b, r), ...randomCrotch(b, r), height: b.waist_to_floor / 0.615 } as unknown as MeasurementValues;
      return designs.map((d) => ({ ...walkDesign(d, values), key: `${d.key} (body ${i + 1})` }));
    }).flat();
    // Each design held to its own faults on the example body, so only what the body brings shows as new.
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const byBody = Object.fromEntries(results.map((x) => [x.key, known[x.key.replace(/ \(body \d+\)$/, '')] ?? []]));
    const c = checkPatterns(results, byBody);
    writeFileSync(process.env.PATTERN_BODIES_REPORT ?? 'pattern-bodies.md', `Seed ${seed}\n\n${patternReport(results, c, `Pattern geometry on ${BODIES} random bodies`)}`);
    expect(results.length).toBe(BODIES * designs.length);
  }, 6 * 60 * 60_000);
});

describe('the pattern geometry check', () => {
  const square = (outline: Path, notches: Piece['notches'] = []): Piece => ({ name: 'Test', outline, lines: [], notches, labels: [], cut: '', seamAllowance: 1, allowances: {}, meta: {} });
  it('finds a line that crosses itself', () => {
    expect(selfCrossing([p(0, 0), p(10, 10), p(10, 0), p(0, 10), p(0, 0)])).toBeDefined();
    expect(selfCrossing([p(0, 0), p(10, 0), p(10, 10), p(0, 10), p(0, 0)])).toBeUndefined();
  });
  it('finds a notch off the edge', () => {
    const o = new Path(p(0, 0)).line(p(10, 0), 'waist').line(p(10, 10), 'side').line(p(0, 10), 'hem').line(p(0, 0), 'centre');
    o.closed = true;
    expect(patternProblems([square(o, [[p(10, 5), p(1, 0)]])])).toEqual([]);
    expect(patternProblems([square(o, [[p(8, 5), p(1, 0)]])])[0]).toMatch(/off the edge/);
  });
  it('finds side seam notches that do not meet', () => {
    const piece = (name: string, at: number): Piece => {
      const o = new Path(p(0, 0)).line(p(10, 0), 'waist').line(p(10, 20), 'side').line(p(0, 20), 'hem').line(p(0, 0), 'centre');
      o.closed = true;
      return { ...square(o, [[p(10, at), p(1, 0)]]), name };
    };
    expect(patternProblems([piece('Skirt front', 12), piece('Skirt back', 12)])).toEqual([]);
    expect(patternProblems([piece('Skirt front', 12), piece('Skirt back', 13)]).join()).toMatch(/none at that place/);
  });
});
