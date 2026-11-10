import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNUSUAL_BODIES } from './engine/unusualBodies';
import { checkMeasurements, crossChecks, FIELDS, type Garment } from './measurements';
import { FIT_GARMENTS, fitProblems, randomFitDesign } from './fitSweep';
import { checkPatterns, patternDesigns, patternReport, walkDesign } from './patternSweep';
import { rng } from './engine/randomBodies';
import { DraftError } from './engine/skirt';

// Unusual bodies (Cat, Nov 10, 2026: "yes tests"): the far edges of what the measuring pages accept, where the random
// bodies rarely go (see engine/unusualBodies.ts). Three checks, run before every ship:
// 1. every unusual body is one the measuring pages take without an error, so these are bodies a maker can enter;
// 2. random designs of every garment, drafted for each body, are the body plus the fit's ease (the fit sweep's checks);
// 3. every option of every garment, drafted for each body, makes a sound printed pattern (the pattern geometry walk).
// A body the app turns away for a design with a message to the maker (a DraftError, such as a waist bigger than the
// hip for a fitted skirt) is not a fault here; a crash is.
// Checks 2 and 3 are held to src/unusualKnown.json: the faults found when this test was written, each one real and
// listed for Cat, waiting on a fix, never hidden. A new fault fails the test. When a fault is fixed, UNUSUAL_KNOWN=write
// takes it out of the file. `npm test` walks every fifth option on each body (a different fifth for each, so between them
// every option is walked); SWEEP=full walks every option on every body (about 5 minutes) and runs more designs.
const file = new URL('./unusualKnown.json', import.meta.url);
const FULL = process.env.SWEEP === 'full';
const BODIES = Object.entries(UNUSUAL_BODIES);
const isRefusal = (e: unknown) => e instanceof DraftError;

describe('unusual bodies', () => {
  it('are all bodies the measuring pages accept without an error', () => {
    const turnedBack: string[] = [];
    for (const [name, v] of BODIES) {
      for (const g of Object.keys(FIELDS) as Garment[])
        for (const c of checkMeasurements(v, 'cm', g)) if (c.level === 'error') turnedBack.push(`${name}, ${g}: ${c.id}: ${c.message}`);
      for (const c of crossChecks(v)) turnedBack.push(`${name}: ${c.id} with ${c.with}: ${c.message}`);
    }
    expect(turnedBack).toEqual([]);
  });

  it('draft every garment to the body plus its ease, with no new kind of fault', () => {
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const designs = FULL ? 12 : 3;
    const found: Record<string, string[]> = {};
    const crashes: string[] = [];
    let drafted = 0;
    for (const [name, v] of BODIES) {
      const r = rng(1);
      for (const g of FIT_GARMENTS)
        for (let k = 0; k < designs; k++) {
          const d = randomFitDesign(r, g);
          try {
            const problems = fitProblems(d, v);
            drafted++;
            if (problems.length) (found[`fit: ${g} (${name})`] ??= []).push(...problems);
          } catch (e) {
            if (!isRefusal(e)) crashes.push(`${name}, ${g}: ${String(e)} (${JSON.stringify(d.saved)})`);
          }
        }
    }
    const kinds = (ps: string[]) => [...new Set(ps.map((p) => p.replace(/-?\d+(\.\d+)?/g, '#')))];
    const fresh = Object.entries(found).flatMap(([key, ps]) => kinds(ps).filter((k) => !(known[key] ?? []).includes(k)).map((k) => `${key}: ${k}`));
    if (process.env.UNUSUAL_KNOWN === 'write') {
      const now = { ...Object.fromEntries(Object.entries(known).filter(([k]) => !k.startsWith('fit: '))), ...Object.fromEntries(Object.entries(found).map(([k, ps]) => [k, kinds(ps)])) };
      writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
    } else expect(fresh, 'new fit faults on an unusual body (fix them; see fitSweep.ts)').toEqual([]);
    expect(crashes, 'a design that crashes instead of drafting or giving the maker a message').toEqual([]);
    expect(drafted).toBeGreaterThan(BODIES.length * FIT_GARMENTS.length * designs * 0.6);
  }, 30 * 60_000);

  it('make a sound pattern from every option, or no worse than src/unusualKnown.json', () => {
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const all = patternDesigns();
    const step = FULL ? 1 : 5;
    const results = BODIES.flatMap(([name, v], i) =>
      all.filter((_, j) => j % step === i % step).map((d) => {
        const r = walkDesign(d, v);
        // A body the app turns away for this design, with its message, is not a fault of the pattern.
        const refused = r.error && /can.t be drafted|can’t be drafted|will work/i.test(r.error);
        return { ...r, error: refused ? undefined : r.error, key: `${d.key} (${name})` };
      }),
    );
    const c = checkPatterns(results, Object.fromEntries(results.map((x) => [x.key, known[x.key] ?? []])));
    if (process.env.UNUSUAL_REPORT) writeFileSync(process.env.UNUSUAL_REPORT, patternReport(results, c, 'Pattern geometry on unusual bodies'));
    if (process.env.UNUSUAL_KNOWN === 'write') {
      const kept = Object.fromEntries(Object.entries(known).filter(([k]) => k.startsWith('fit: ') || !(k in c.now)));
      const now = { ...kept, ...Object.fromEntries(Object.entries(c.now).filter(([, ks]) => ks.length)) };
      writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
    } else expect(c.worse, 'new pattern faults on an unusual body (fix them; see patternSweep.ts)').toEqual([]);
  }, 60 * 60_000);
});
