import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SweepDesign, checkOptions, optionDesigns, optionsReport, randomDesign, sewDesign, sweepReport } from './drapeSweep';
import { rng } from './engine/randomBodies';
import { drapeQuality } from './engine/drape/quality';
import type { Draped } from './engine/drape/garment';
import type { Saved } from './savedWork';

// Designs whose All round drawing passed its quality check, and passed by eye (Cat's SS27 looks and the first sweep,
// 2026-11-02). They stay passing: an engine change that breaks one of them fails here, before it ships. Add each
// design that comes to pass, so the list only grows.
const LOCKED: [string, SweepDesign][] = [
  ['bias slip, midi (SS27 9C skirt)', { garment: 'skirt', saved: { choices: { fit: 'regular', silhouette: 'slip', length: 'midi' } as Saved['choices'] }, fibre: 'silk' }],
  // (The bias slip above the knee with a diagonal hem was here, but its hem was drawn as a V point at the centre front,
  // not a diagonal: the drape sews one half and mirrors it. Off the list, on Cat's word, until skirts are sewn whole, Nov 8.)
  ['pencil skirt, knee', { garment: 'skirt', saved: { choices: { fit: 'fitted', silhouette: 'pencil', length: 'knee', asymHem: 'none' } as Saved['choices'] }, fibre: 'cotton' }],
  ['knife-pleated A-line midi, low rise, crisp (SS27 look 10)', { garment: 'skirt', saved: { choices: { fit: 'regular', silhouette: 'a_line', length: 'midi', lengthCm: 64.6, pleats: 'knife', rise: 'low' } as unknown as Saved['choices'] }, fibre: 'wool', crisp: true }],
  ['knife-pleated straight midi', { garment: 'skirt', saved: { choices: { fit: 'regular', silhouette: 'straight', length: 'midi', pleats: 'knife' } as unknown as Saved['choices'] }, fibre: 'wool' }],
  ['A-line mini, crisp (SS27 07 skirt)', { garment: 'skirt', saved: { choices: { fit: 'regular', silhouette: 'a_line', length: 'mini' } as Saved['choices'] }, fibre: 'cotton', crisp: true }],
  ['boned strapless bodice', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'fitted', neckline: 'strapless', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'fitted', closure: 'back_zip', collar: 'none', structure: 'boned' } as Saved['bodice'] }, fibre: 'linen' }],
  ['cami top, hip length', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'regular', neckline: 'cami', length: 'hip', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'cap', closure: 'back_zip', collar: 'none' } as Saved['bodice'] }, fibre: 'cotton' }],
  ['square neck, long sleeves, keyhole back', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'fitted', neckline: 'square', length: 'hip', darts: 'bust_waist', sleeve: 'long', sleeveShape: 'straight', closure: 'back_zip', collar: 'none', back: 'keyhole' } as Saved['bodice'] }, fibre: 'cotton', crisp: true }],
  ['sleeveless shell (SS27 look B top)', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'fitted', neckline: 'crew', length: 'high_hip', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight' } as Saved['bodice'] }, fibre: 'silk' }],
  ['sleeveless A-line dress, natural waist', { garment: 'dress', saved: { dress: { garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', closure: 'back_zip', collar: 'none' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'knee', asymHem: 'none' }, waistSeam: 'natural' } as Saved['dress'] }, fibre: 'cotton' }],
  ['sleeveless A-line dress, dropped waist', { garment: 'dress', saved: { dress: { garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', closure: 'back_zip', collar: 'none' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'knee', asymHem: 'none' }, waistSeam: 'dropped' } as Saved['dress'] }, fibre: 'cotton' }],
  ['plunge bias slip gown (SS27 look 02)', { garment: 'dress', saved: { dress: { garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'plunge', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', closure: 'back_zip', collar: 'none', back: 'v' }, skirt: { fit: 'regular', silhouette: 'slip', length: 'maxi', asymHem: 'none' }, waistSeam: 'natural' } as Saved['dress'] }, fibre: 'silk' }],
  ['oversized Big Shirt, dropped shoulder, oversized cuffs (SS27 look 01 top)', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'oversized', neckline: 'crew', length: 'long', darts: 'none', sleeve: 'long', sleeveShape: 'straight', collar: 'shirt', closure: 'front_buttons', sleeveCut: 'drop', sleeveCuff: 'oversized' } as Saved['bodice'] }, fibre: 'cotton' }],
  ['boxy crop, short sleeves, waist length, crisp (SS27 07 top)', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'boxy', neckline: 'crew', collar: 'none', sleeve: 'short', length: 'waist' } as Saved['bodice'] }, fibre: 'cotton', crisp: true }],
  ['shirt, collar and long sleeves (SS27 9C top)', { garment: 'bodice', saved: { bodice: { garment: 'bodice', fit: 'regular', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', sleeve: 'long', sleeveShape: 'straight', sleeveCuff: 'shirt', length: 'hip', darts: 'bust_waist' } as Saved['bodice'] }, fibre: 'cotton' }],
];

describe('All round drawings that passed stay passing', () => {
  it.each(LOCKED)('%s', (_, design) => {
    const x = sewDesign(design);
    expect(x.error).toBeUndefined();
    expect(x.quality?.problems ?? []).toEqual([]);
  }, 120_000);
});

describe('the quality check', () => {
  // A two-triangle cloth, cut as a 10 cm square.
  const square = (pos: number[]): Draped =>
    ({
      panels: [
        {
          pc: { name: 'Test', meta: {} },
          mesh: { pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], tris: [[0, 1, 2], [0, 2, 3]], runs: {}, side: [], darts: [] },
          base: 0,
          role: 'front',
          turned: [false, false, false, false],
          start: [],
          thick: [],
        },
      ],
      pos: Float64Array.from(pos),
      lines: [],
      buttons: [],
    }) as unknown as Draped;
  const sp = { bodyR: () => 0, tip: { c: -100, x: 10 } };
  it('passes cloth drawn as cut', () => {
    expect(drapeQuality(square([0, 0, 20, 10, 0, 20, 10, 10, 20, 0, 10, 20]), sp).ok).toBe(true);
  });
  it('fails a point flung off or not a number', () => {
    expect(drapeQuality(square([0, 0, 20, 10, 0, 20, NaN, 10, 20, 0, 10, 20]), sp).problems[0].check).toBe('broken');
    expect(drapeQuality(square([0, 0, 20, 10, 0, 20, 900, 10, 20, 0, 10, 20]), sp).problems[0].check).toBe('broken');
  });
  it('fails cloth stretched far past its cut', () => {
    expect(drapeQuality(square([0, 0, 20, 40, 0, 20, 40, 10, 20, 0, 10, 20]), sp).problems.map((p) => p.check)).toContain('stretched');
  });
  it('fails a seam drawn open', () => {
    const q = drapeQuality(square([0, 0, 20, 10, 0, 20, 10, 10, 20, 0, 10, 20]), sp, { seams: [{ i: 0, j: 1, k: 2, t: 0 }] });
    expect(q.problems.map((p) => p.check)).toEqual(['seam']);
  });
});

// The nightly sweep: DRAPE_SWEEP=<how many> sews that many random designs (seeded by DRAPE_SEED, by default the
// date) and writes the report to DRAPE_REPORT. It doesn't fail on what it finds: the report is the result.
const N = Number(process.env.DRAPE_SWEEP ?? 0);
describe.skipIf(!N)('All round sweep of random designs', () => {
  it(`sews ${N} random designs and reports the failures`, () => {
    const seed = Number(process.env.DRAPE_SEED ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const r = rng(seed);
    const results = Array.from({ length: N }, () => sewDesign(randomDesign(r)));
    const report = `Seed ${seed}\n\n${sweepReport(results, Number(process.env.DRAPE_LIST ?? 8))}`;
    writeFileSync(process.env.DRAPE_REPORT ?? 'drape-sweep.md', report);
    expect(results.length).toBe(N);
  }, 6 * 60 * 60_000);
});

// Every option on its own (optionDesigns), held to drapeOptions.json: what each option's All round did when it was last
// looked at. DRAPE_OPTIONS=check (on every pull request) fails when an option that passed now fails, or when an option
// isn't in the file yet: a new option is looked at (the eye check) before it ships, and added to the file as it fares.
// DRAPE_OPTIONS=report (nightly) only reports; DRAPE_OPTIONS=write rewrites the file with what the options do now.
const OPTIONS = process.env.DRAPE_OPTIONS;
describe.skipIf(!OPTIONS)('All round: every option on its own', () => {
  it('sews each option and holds it to drapeOptions.json', () => {
    const file = new URL('./drapeOptions.json', import.meta.url);
    const known = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    // DRAPE_SHARD="2/3" sews every third option from the second, so a pull request's check runs in three parts at once.
    const [part, parts] = (process.env.DRAPE_SHARD ?? '1/1').split('/').map(Number);
    const results = optionDesigns()
      .filter((_, i) => i % parts === part - 1)
      .map(({ key, design }) => ({ key, r: sewDesign(design) }));
    const c = checkOptions(results, known);
    writeFileSync(process.env.DRAPE_OPTIONS_REPORT ?? 'drape-options.md', optionsReport(c));
    writeFileSync(process.env.DRAPE_OPTIONS_JSON ?? 'drape-options.json', JSON.stringify({ passing: Object.values(c.now).filter((v) => v === 'passes').length, total: results.length, worse: c.worse, unseen: c.unseen, better: c.better }, null, 1));
    if (OPTIONS === 'write' && parts === 1) writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(c.now).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
    if (OPTIONS === 'check') {
      expect(c.worse, 'options whose All round passed before and fails now').toEqual([]);
      expect(c.unseen, 'new options: look at their All round, then add them to src/drapeOptions.json (DRAPE_OPTIONS=write)').toEqual([]);
    }
  }, 2 * 60 * 60_000);
});

// The weekly eye check's sample (see e2e/eye-check.spec.ts, EYE_FROM): DRAPE_EYE=<file> writes DRAPE_EYE_RANDOM random
// designs (seeded by DRAPE_SEED, by default the date) and the options named in DRAPE_EYE_OPTIONS ("skirt pleats=box,
// bodice collar=cape", or "unseen" for every option not yet in drapeOptions.json), as the eye check's designs.
const EYE = process.env.DRAPE_EYE;
describe.skipIf(!EYE)('All round: the eye check sample', () => {
  it('writes the sample', () => {
    const seed = Number(process.env.DRAPE_SEED ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const r = rng(seed);
    const colours = ['#2F3A4A', '#8A9A5B', '#C9962E', '#A3236F', '#F2E8CF', '#1E1E22', '#9CC3E6', '#6B4F3A'];
    const eye = (code: string, name: string, d: SweepDesign, i: number) => ({ code, name, garment: d.garment, saved: d.saved, fabric: { colour: colours[i % colours.length], fibre: d.fibre, ...(d.crisp ? { drape: 'crisp' } : {}) } });
    const random = Array.from({ length: Number(process.env.DRAPE_EYE_RANDOM ?? 12) }, (_, i) => {
      const d = randomDesign(r);
      return eye(`R${i + 1}`, sewDesign(d).label, d, i);
    });
    const ask = (process.env.DRAPE_EYE_OPTIONS ?? '').split(',').map((k) => k.trim()).filter(Boolean);
    const known = JSON.parse(readFileSync(new URL('./drapeOptions.json', import.meta.url), 'utf8')) as Record<string, string>;
    const options = optionDesigns()
      .filter((o) => (ask.includes('unseen') && !(o.key in known)) || ask.includes(o.key))
      .map((o, i) => eye(`O${i + 1}`, o.key, o.design, i));
    writeFileSync(EYE!, JSON.stringify([...options, ...random], null, 1));
    expect(random.length + options.length).toBeGreaterThan(0);
  });
});

