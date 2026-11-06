import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRINT_SAMPLES, piecesOffThePages, printProblems, printSample } from './printCheck';
import type { Paper } from './engine/export';

// The print check (Quality: Automated checks, check 3): the sample patterns on A4, US Letter and the A0 copy-shop
// sheet. Every pull request checks from the sheet that every piece is on a printed page (inside `npm test`), and in its
// own CI job (PRINT_CHECK=1, with poppler-utils installed for pdftoppm) renders the PDF's pages and measures the test
// square and every overlap between neighbouring pages. Held to src/printKnown.json, the faults already found (page
// names and numbers taken out): it fails on a new one. PRINT_KNOWN=write rewrites the file once a fault is fixed.
const PAPERS: Paper[] = ['a4', 'letter', 'a0'];
const kind = (p: string) => p.replace(/\b[A-Z]\d+\b/g, 'page').replace(/-?\d+(\.\d+)?/g, '#');

describe('print check: every piece is on a printed page', () => {
  it.each(PRINT_SAMPLES.map((d) => [d.key, d] as const))('%s', async (_, d) => {
    for (const paper of PAPERS) {
      const { sheet, pieces } = await printSample(d, paper);
      expect(piecesOffThePages(sheet, paper, pieces), paper).toEqual([]);
    }
  }, 120_000);
});

describe.skipIf(!process.env.PRINT_CHECK)('print check: the printed pages', () => {
  it('measures the test square and lines up every page with its neighbours, no worse than src/printKnown.json', async () => {
    // No silent pass: with PRINT_CHECK set, the pages must render.
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' });
    const file = new URL('./printKnown.json', import.meta.url);
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const now: Record<string, string[]> = {};
    const fresh: string[] = [];
    const report: string[] = ['## Print check', ''];
    for (const d of PRINT_SAMPLES)
      for (const paper of PAPERS) {
        const key = `${d.key}, ${paper}`;
        // A0 is printed by a copy shop at its full size; 60 dpi is enough to measure it to half a millimetre.
        const problems = await printProblems(d, paper, paper === 'a0' ? 60 : 150);
        now[key] = [...new Set(problems.map(kind))];
        for (const p of problems) if (!(known[key] ?? []).includes(kind(p))) fresh.push(`${key}: ${p}`);
        report.push(`- ${key}: ${problems.length ? problems.join('; ') : 'prints true'}`);
      }
    if (process.env.PRINT_REPORT) writeFileSync(process.env.PRINT_REPORT, report.join('\n') + '\n');
    if (process.env.PRINT_KNOWN === 'write') writeFileSync(file, JSON.stringify(now, null, 1) + '\n');
    else expect(fresh, 'new print faults (fix them; see printCheck.ts)').toEqual([]);
  }, 20 * 60_000);
});
