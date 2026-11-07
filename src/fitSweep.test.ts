import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIT_GARMENTS, fitKind, fitProblems, randomFitDesign, randomValues } from './fitSweep';
import { rng } from './engine/randomBodies';

// The fit sweep on random bodies (Quality: Automated checks, check 2, Cat 2026-11-04): FIT_BODIES random bodies (30 in
// the unit tests, 300 in the pull request's own job and nightly), each with a random design of every garment, held to
// the body (see fitSweep.ts). Held to src/fitKnown.json, the kinds of fault already found (numbers taken out, with an
// example): it fails on a new kind. A kind in the file is a real fault waiting on a fix, never one hidden;
// FIT_KNOWN=write rewrites the file once it is fixed. FIT_SEED sets the bodies (1 on pull requests, new each night);
// FIT_REPORT writes what it found.
const file = new URL('./fitKnown.json', import.meta.url);
const BODIES = Number(process.env.FIT_BODIES ?? 30);
const SEED = Number(process.env.FIT_SEED ?? 1);

describe('fit sweep on random bodies', () => {
  it(`drafts every garment for ${BODIES} random bodies to the body plus its ease, with no new kind of fault`, () => {
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    const r = rng(SEED);
    // The Garment range (2026-11-07) draws its designs from a stream of its own, so the other garments' designs stay as before.
    const range = rng(SEED + 7_000_000);
    const found = new Map<string, { count: number; example: string }>();
    let drafted = 0;
    for (let i = 0; i < BODIES; i++) {
      const values = randomValues(r);
      for (const g of FIT_GARMENTS) {
        const d = randomFitDesign(g === 'knit_dress' || g === 'hoodie' || g === 'jumpsuit' ? range : r, g);
        let problems: string[];
        try {
          problems = fitProblems(d, values);
          drafted++;
        } catch {
          // A body and design the app turns away with a message to the maker (a DraftError) isn't a pattern to measure.
          continue;
        }
        for (const p of problems) {
          const k = fitKind(g, p);
          const f = found.get(k) ?? { count: 0, example: `body ${i + 1}: ${p} (${JSON.stringify(d.saved)})` };
          f.count++;
          found.set(k, f);
        }
      }
    }
    const fresh = [...found.keys()].filter((k) => !(k in known));
    const fixed = Object.keys(known).filter((k) => !found.has(k));
    if (process.env.FIT_REPORT) {
      const lines = [`## Fit sweep, ${BODIES} random bodies (seed ${SEED})`, '', `${drafted} patterns drafted. ${found.size} kinds of fault, ${fresh.length} new.`, ''];
      for (const [k, f] of [...found].sort((a, b) => b[1].count - a[1].count)) lines.push(`- ${fresh.includes(k) ? '**new** ' : ''}${k}: ${f.count} times, e.g. ${f.example}`);
      if (fixed.length) lines.push('', 'Not seen this run (fixed, or these bodies missed them):', ...fixed.map((k) => `- ${k}`));
      writeFileSync(process.env.FIT_REPORT, lines.join('\n') + '\n');
    }
    if (process.env.FIT_KNOWN === 'write') writeFileSync(file, JSON.stringify(Object.fromEntries([...found].sort(([a], [b]) => a.localeCompare(b)).map(([k, f]) => [k, f.example])), null, 1) + '\n');
    else if (!process.env.FIT_REPORT_ONLY) expect(fresh.map((k) => found.get(k)!.example), 'new kinds of fit fault (fix them; see fitSweep.ts)').toEqual([]);
    expect(drafted).toBeGreaterThan(BODIES * FIT_GARMENTS.length * 0.8);
  }, 60 * 60_000);
});
