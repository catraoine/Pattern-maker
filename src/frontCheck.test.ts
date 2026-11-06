import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkPatterns, patternDesigns, patternReport } from './patternSweep';
import { FrontDrawing, frontProblems, pathPoints } from './frontCheck';

// The Front drawing check (Quality: Automated checks, Cat 2026-11-04). FRONT_FROM=<folder> scores what
// e2e/front-drawing.spec.ts read out of the real app for every option, held to src/frontKnown.json: it fails on a new
// fault, or on an option not in the file yet. A fault in the file is a real one to fix, never one to hide: when it is
// fixed, FRONT_KNOWN=write takes it out. FRONT_SHARD=i/n scores one share of the options, as the capture took them.
const file = new URL('./frontKnown.json', import.meta.url);
const FROM = process.env.FRONT_FROM;

describe.skipIf(!FROM)('Front drawing: every option', () => {
  it('draws every option on the form without a fault, or no worse than src/frontKnown.json', () => {
    const drawings: Record<string, FrontDrawing> = {};
    for (const f of readdirSync(FROM!).filter((f) => /^front-.*\.json$/.test(f))) Object.assign(drawings, JSON.parse(readFileSync(`${FROM}/${f}`, 'utf8')));
    const [shard, shards] = (process.env.FRONT_SHARD ?? '1/1').split('/').map(Number);
    const designs = patternDesigns().filter((_, i) => i % shards === shard - 1);
    const results = designs.map((d) => (drawings[d.key] ? { key: d.key, problems: frontProblems(d.key, drawings[d.key]) } : { key: d.key, problems: [], error: 'not captured' }));
    const known = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>) : {};
    const c = checkPatterns(results, known);
    if (process.env.FRONT_REPORT) writeFileSync(process.env.FRONT_REPORT, patternReport(results, c, 'Front drawing'));
    if (process.env.FRONT_KNOWN === 'write') writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries({ ...known, ...c.now }).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
    else {
      expect(c.worse, 'new Front drawing faults (fix them; see frontCheck.ts)').toEqual([]);
      expect(c.unseen, 'new options: look at their Front drawing, then add them to src/frontKnown.json (FRONT_KNOWN=write)').toEqual([]);
    }
  });
});

describe('the Front drawing check', () => {
  const box = (x: number, y: number, w: number, h: number) => `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`;
  const vb = '0 0 40 100';
  it('reads the cloth outlines', () => {
    expect(pathPoints('M1 2 L3 4 L5 6 Z M7 8 L9 10')).toEqual([[{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }], [{ x: 7, y: 8 }, { x: 9, y: 10 }]]);
  });
  it('passes a bodice over a skirt, sewn together', () => {
    expect(frontProblems('dress', { viewBox: vb, cloth: [box(10, 10, 20, 30), box(8, 40, 24, 40)] })).toEqual([]);
  });
  it('finds a gap between pieces sewn together', () => {
    // A piece with a hole the form shows through.
    expect(frontProblems('dress', { viewBox: vb, cloth: [box(10, 10, 20, 12), box(10, 30, 20, 12), box(10, 22, 4, 8), box(26, 22, 4, 8)] }).join()).toMatch(/gap/);
  });
  it('finds cloth cut off, twisted, jagged and lopsided', () => {
    expect(frontProblems('dress', { viewBox: vb, cloth: [box(10, 10, 20, 95)] }).join()).toMatch(/cut off: cloth runs 5 cm/);
    // Past the sides of a tall drawing is still in view: the box has room either side.
    expect(frontProblems('dress', { viewBox: vb, cloth: [box(-2, 10, 44, 60)] }).join()).not.toMatch(/cut off/);
    expect(frontProblems('dress', { viewBox: vb, cloth: ['M10 10 L30 40 L30 10 L10 40 Z'] }).join()).toMatch(/twisted/);
    const saw = Array.from({ length: 20 }, (_, i) => `L${10 + i} ${80 + (i % 2) * 2}`).join(' ');
    expect(frontProblems('dress', { viewBox: vb, cloth: [`M10 10 L30 10 ${saw} Z`] }).join()).toMatch(/jagged/);
    expect(frontProblems('dress', { viewBox: vb, cloth: [box(5, 10, 20, 30)] }).join()).toMatch(/lopsided/);
    expect(frontProblems('dress closure=wrap', { viewBox: vb, cloth: [box(5, 10, 20, 30)] }).join()).not.toMatch(/lopsided/);
  });
});
