// Drawing-likeness eval: turns the hand scores in evals/drawings/cases.json into evals/drawings/results/likeness.md.
// Run with `npm run eval:likeness`. The screenshots to score come from `node scripts/eval-drawings.mjs`.
//
// Each case is scored by eye against its photo on nine parts, 1 (the app's drawing shows it), 0.5 (roughly),
// 0 (missing or wrong) or null (the photo has none to show, e.g. sleeves on a skirt). Re-score after a drawing
// change ships and compare the averages here.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PARTS = ['silhouette', 'neckline', 'sleeves', 'length', 'waist', 'details', 'print', 'colour', 'fabric'] as const;
export type Part = (typeof PARTS)[number];

export interface DrawingCase {
  id: string;
  source: string;
  photo?: string;
  garment: 'skirt' | 'dress' | 'bodice' | 'tee' | 'trousers' | 'jacket' | 'coat';
  /** The style choices the app would need to match the photo, as the Style page saves them. */
  choices: Record<string, unknown>;
  fabric?: Record<string, unknown>;
  /** What the photo shows, in a sewist's words. */
  truth: string;
  likeness: Partial<Record<Part, number | null>>;
  /** Scored on which release, by whom. */
  scored?: string;
  note?: string;
}

const DIR = 'evals/drawings';

export function likenessReport(cases: DrawingCase[]): string {
  const scored = cases.filter((c) => Object.keys(c.likeness).length);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN);
  const partAvg = (p: Part) => avg(scored.map((c) => c.likeness[p]).filter((v): v is number => typeof v === 'number'));
  const caseAvg = (c: DrawingCase) => avg(PARTS.map((p) => c.likeness[p]).filter((v): v is number => typeof v === 'number'));
  const pct = (n: number) => (Number.isNaN(n) ? '–' : `${Math.round(100 * n)}%`);
  const overall = avg(scored.map(caseAvg).filter((n) => !Number.isNaN(n)));
  const rows = cases.map((c) => {
    const cells = PARTS.map((p) => (c.likeness[p] === undefined ? '' : c.likeness[p] === null ? '–' : String(c.likeness[p])));
    return `| ${c.id} | ${c.garment} | ${c.truth.replace(/\|/g, '/')} | ${cells.join(' | ')} | ${Object.keys(c.likeness).length ? pct(caseAvg(c)) : 'not scored'} | ${(c.note ?? '').replace(/\|/g, '/')} |`;
  });
  return [
    `# Drawing likeness`,
    ``,
    `${scored.length} of ${cases.length} photos scored by eye. Overall **${pct(overall)}** of what the photos show is in the app's drawing.`,
    ``,
    `By part: ${PARTS.map((p) => `${p} ${pct(partAvg(p))}`).join(', ')}.`,
    ``,
    `| Photo | Garment | What it is | ${PARTS.join(' | ')} | Likeness | Note |`,
    `| --- | --- | --- | ${PARTS.map(() => '---').join(' | ')} | --- | --- |`,
    ...rows,
    ``,
  ].join('\n');
}

function main() {
  const { cases } = JSON.parse(readFileSync(join(DIR, 'cases.json'), 'utf8')) as { cases: DrawingCase[] };
  mkdirSync(join(DIR, 'results'), { recursive: true });
  const report = likenessReport(cases);
  writeFileSync(join(DIR, 'results', 'likeness.md'), report);
  console.log(report);
}

main();
