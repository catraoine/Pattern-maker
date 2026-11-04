import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkPatterns, patternDesigns, patternReport } from './patternSweep';
import { compareBack, dxfProblems, roundTripDesign } from './dxfRoundTrip';
import { toDxf } from './engine/dxf';
import { importDxf } from './engine/importDxf';
import { draftSkirt } from './engine/skirt';
import { randomArms, randomBody, randomCrotch, rng } from './engine/randomBodies';
import { EXAMPLE_BODY, MeasurementValues } from './measurements';

// The DXF round trip (Quality: Automated checks, Cat 2026-11-04): every option's printed pattern is written as the DXF
// a factory downloads and read back in, and the pieces must come back as drafted. Held to src/dxfKnown.json, the faults
// each design had when last looked at: it fails on a new fault or a design not in the file yet. A fault in the file is a
// real one to fix, never one to hide: when it is fixed, DXF_KNOWN=write takes it out.
const file = new URL('./dxfKnown.json', import.meta.url);

describe('DXF round trip: every option', () => {
  it('reads every option back from its DXF as drafted, or no worse than src/dxfKnown.json', () => {
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const results = patternDesigns().map((d) => roundTripDesign(d));
    const c = checkPatterns(results, known);
    if (process.env.DXF_REPORT) writeFileSync(process.env.DXF_REPORT, patternReport(results, c, 'DXF round trip'));
    if (process.env.DXF_KNOWN === 'write') writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(c.now).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
    else {
      expect(c.worse, 'new DXF faults (fix them; see dxfRoundTrip.ts)').toEqual([]);
      expect(c.unseen, 'new options: look at their DXF, then add them to src/dxfKnown.json (DXF_KNOWN=write)').toEqual([]);
    }
  }, 600_000);
});

// DXF_BODIES=<n> (nightly): every option on that many random bodies too, each held to its faults on the example body,
// and only reported.
const BODIES = Number(process.env.DXF_BODIES ?? 0);
describe.skipIf(!BODIES)('DXF round trip on random bodies', () => {
  it(`reads every option back on ${BODIES} random bodies and reports`, () => {
    const seed = Number(process.env.DXF_SEED ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const r = rng(seed);
    const designs = patternDesigns();
    const results = Array.from({ length: BODIES }, (_, i) => {
      const b = randomBody(r);
      const values = { ...EXAMPLE_BODY, ...b, ...randomArms(b, r), ...randomCrotch(b, r), height: b.waist_to_floor / 0.615 } as unknown as MeasurementValues;
      return designs.map((d) => ({ ...roundTripDesign(d, values), key: `${d.key} (body ${i + 1})` }));
    }).flat();
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const c = checkPatterns(results, Object.fromEntries(results.map((x) => [x.key, known[x.key.replace(/ \(body \d+\)$/, '')] ?? []])));
    writeFileSync(process.env.DXF_BODIES_REPORT ?? 'dxf-bodies.md', `Seed ${seed}\n\n${patternReport(results, c, `DXF round trip on ${BODIES} random bodies`)}`);
    expect(results.length).toBe(BODIES * designs.length);
  }, 6 * 60 * 60_000);
});

describe('the DXF round trip check', () => {
  const pieces = () => draftSkirt({ waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 }, { silhouette: 'a_line' }).pieces;
  it('passes a skirt that reads back exactly', () => {
    expect(dxfProblems(pieces())).toEqual([]);
  });
  it('finds a piece that comes back different', () => {
    const ps = pieces();
    const back = importDxf(toDxf(ps, { style: 'Round trip', size: 'Example', date: '2026-11-04' }));
    back.pieces[0] = { ...back.pieces[0], cut: 'Cut 3', notches: back.pieces[0].notches.slice(1), grain: undefined };
    back.pieces[1] = { ...back.pieces[1], cutOutline: back.pieces[1].cutOutline!.map((q) => ({ x: q.x * 1.01, y: q.y })) };
    const found = compareBack(ps, back).join('\n');
    expect(found).toMatch(/Skirt front: cut 3 in the file, 1 drafted/i);
    expect(found).toMatch(/notches drafted, \d+ read back/);
    expect(found).toMatch(/grain line is lost/);
    expect(found).toMatch(/reads back [\d.]+ × [\d.]+ cm, drafted/);
  });
});
