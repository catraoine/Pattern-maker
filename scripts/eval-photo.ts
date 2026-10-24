// Photo-to-pattern eval: reads each photo in evals/photo/cases.json, scores it against its hand label and
// writes evals/photo/results/report.md. Run with `npm run eval:photo`.
//
// Readings come from Claude directly when ANTHROPIC_API_KEY is set, or from the live site with
// `--site https://...` (that counts against the site's 5 readings per visitor per day). Each reading is
// saved, so `--rescore` rebuilds the report without paying for new readings.
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { analyzePhoto } from '../src/photo/analyze';
import { MAX_POINTS, Score, Truth, notRead, scoreReading } from '../src/photo/score';
import type { PhotoReading, PhotoResponse } from '../src/photo/types';

interface Case {
  id: string;
  wanted: string;
  photo: string; // file name in evals/photo/photos
  source: string;
  license: string;
  author: string;
  truth: Truth;
  truthChecked: boolean;
  /** Where the photo lives when it can't be committed (a shop's product shot, a personal photo). */
  photoNote?: string;
}

const DIR = 'evals/photo';
const SAVED = join(DIR, 'results', 'readings.json');
const MEDIA: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const args = process.argv.slice(2);
const site = args.includes('--site') ? args[args.indexOf('--site') + 1] : undefined;
const rescore = args.includes('--rescore');

async function read(file: string): Promise<PhotoResponse> {
  const input = { image: readFileSync(file).toString('base64'), mediaType: MEDIA[extname(file).toLowerCase()] ?? '' };
  if (site) {
    const res = await fetch(new URL('/.netlify/functions/analyze-photo', site), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return (await res.json()) as PhotoResponse;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  return analyzePhoto(input, key ? new Anthropic({ apiKey: key }) : null);
}

async function main() {
  const { cases } = JSON.parse(readFileSync(join(DIR, 'cases.json'), 'utf8')) as { cases: Case[] };
  const saved: Record<string, PhotoResponse> = existsSync(SAVED) ? JSON.parse(readFileSync(SAVED, 'utf8')) : {};

  for (const c of cases) {
    const file = join(DIR, 'photos', c.photo);
    if (!c.photo || !existsSync(file)) continue;
    if (rescore || saved[c.id]?.ok) continue;
    saved[c.id] = await read(file);
    console.log(c.id, saved[c.id].ok ? 'read' : `error: ${(saved[c.id] as { error: string }).error}`);
  }
  mkdirSync(join(DIR, 'results'), { recursive: true });
  writeFileSync(SAVED, JSON.stringify(saved, null, 2));

  const rows: string[] = [];
  const scores: Score[] = [];
  for (const c of cases) {
    const r = saved[c.id];
    if (!r) {
      rows.push(`| ${c.id} | ${c.wanted} | not run (${c.photoNote ? 'photo kept outside the repo' : 'no photo yet'}) | | | | | ${notRead(c.truth).join(', ')} |`);
      continue;
    }
    if (!r.ok) {
      rows.push(`| ${c.id} | ${c.wanted} | error: ${r.error} | | | | | |`);
      continue;
    }
    const s = scoreReading(r.reading as PhotoReading, c.truth);
    scores.push(s);
    const g = r.reading;
    const got = `${g.silhouette.value} (${g.silhouette.confidence}), ${g.length.value}, ${g.fit.value}, hem ${g.shape.hemAt.toFixed(2)} × ${g.shape.hemFullness.toFixed(1)}`;
    const want = `${c.truth.silhouette}, ${c.truth.length}, ${c.truth.fit}, hem ${c.truth.hemAt.toFixed(2)} × ${c.truth.hemFullness.toFixed(1)}${c.truthChecked ? '' : ' (unchecked)'}`;
    rows.push(
      `| ${c.id} | ${want} | ${got}${s.topRight ? `; top ${s.topRight.right}/${s.topRight.of}${s.topRight.wrong.length ? ' (wrong: ' + s.topRight.wrong.join(', ') + ')' : ''}` : ''} | **${s.points}**/${MAX_POINTS} | ${s.drafts ? 'yes' : 'no: ' + s.draftNote} | ${s.confidentlyWrong.join(', ')} | ${g.details.replace(/\|/g, '/')} | ${s.notRead.join(', ')} |`,
    );
  }

  const avg = scores.length ? scores.reduce((a, s) => a + s.points, 0) / scores.length : 0;
  const share = (k: keyof Score['parts'], max: number) => `${Math.round((100 * scores.reduce((a, s) => a + s.parts[k], 0)) / (max * scores.length || 1))}%`;
  const report = [
    `# Photo-to-pattern eval`,
    ``,
    `${scores.length} of ${cases.length} photos scored. Average **${avg.toFixed(1)}/${MAX_POINTS}**.`,
    ``,
    `By part: garment ${share('garment', 1)}, silhouette ${share('silhouette', 3)}, length ${share('length', 2)}, fit ${share('fit', 1)}, hem position ${share('hemAt', 1)}, hem fullness ${share('hemFullness', 1)}, details ${share('details', 1)}. Patterns that pass every seam check: ${scores.filter((s) => s.drafts).length}/${scores.length}.`,
    ``,
    `| Photo | Label | Reading | Score | Drafts cleanly | Confidently wrong | Details sentence | Not read (no slot in the reader) |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- |`,
    ...rows,
    ``,
  ].join('\n');
  writeFileSync(join(DIR, 'results', 'report.md'), report);
  console.log(report);
}

main();
