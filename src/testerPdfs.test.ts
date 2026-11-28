import { PDFPage, type PDFFont } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { EXAMPLE_BODY, type MeasurementValues } from './measurements';
import { layout } from './engine/export';
import { toTiledPdf } from './engine/pdf';
import { checkPattern } from './engine/qc';

// The five tester pieces' PDFs, read the way a tester gets them: in centimetres and in inches, on Letter and A4, for the
// sample body and a tester's own hand-measured numbers. Every check here is something a tester found first (Nov 17):
// - inch fractions printed as empty boxes, because the text face has no fraction characters;
// - lengths left in cm or mm in an inch PDF ("1.5 CM ALLOWANCE", "neckline 19.5 cm (half)", "trim 3 mm"), metres on
//   the cover, the test square's inches written twice, and "3/8 in in";
// - words printed over other words (long seam check names ran on under their figures; vest cutting layout names).
const IN = 2.54;
const BODIES: Record<string, MeasurementValues> = {
  sample: EXAMPLE_BODY,
  // A tester's own tape measurements, in inches, with a long front length for her bust depth.
  'hand-measured': { ...EXAMPLE_BODY, height: 165, full_bust: 46 * IN, high_bust: 42 * IN, underbust: 37 * IN, waist: 39 * IN, nape_to_waist: 17.5 * IN, front_hps_to_waist: 21 * IN, bust_depth: 12 * IN, apex_separation: 10 * IN, full_hip: 44 * IN, waist_to_hip: 20 },
};
const IDS = ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'];

/** A tester piece as the app makes it: the look's own fabric and finish, on this body. */
function made(id: string, body: MeasurementValues) {
  const look = COLLECTION.find((l) => l.id === id)!;
  const values = withEstimates(body);
  const { garment, ...next } = lookPatch(look, values);
  const fabric = lookFabric(look.fabric);
  const finish = { ...DEFAULT_FINISH, ...SIMPLE_FINISH, ...look.finish, fabric, cloth: clothFor(fabric, DEFAULT_FINISH.cloth) } as Finish;
  const saved = { ...INITIAL, ...next, garment, finish } as Saved;
  const inputs: DraftInputs = { saved, form: 'womenswear', fabric };
  const result = GARMENT_DRAFTING[garment].draft(values, inputs, undefined);
  const print = printableFor({ result, values, finish, fabric, garment, ownFitting: undefined, carriedNotes: [], saved: { choices: saved.choices, bodice: saved.bodice }, dress: dressOf(saved), skirtStyle: skirtStyleOf(inputs, undefined), trousersChoices: trousersChoicesOf(saved) });
  if (!print) throw new Error(`${id} did not print`);
  return { look, print };
}

describe('the tester pieces print cleanly', () => {
  afterEach(() => vi.restoreAllMocks());
  for (const id of IDS)
    for (const [bodyName, body] of Object.entries(BODIES))
      it(`${id}, ${bodyName}: pattern and booklet, cm and inches, Letter and A4`, async () => {
        const { look, print } = made(id, body);
        const checks = checkPattern(print.pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket'));
        const summary = { rows: print.spec.filter((r) => typeof r.finished === 'number'), checks, flat: print.flat, fabric: print.guide.fabric, lays: print.lays, madeFor: 'Tester' };
        const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Tester' });
        let drawn = '';
        let booklet = false;
        const missing = new Set<string>();
        const lines: { page: PDFPage; y: number; x0: number; x1: number; text: string }[] = [];
        const real = PDFPage.prototype.drawText;
        vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, o?: { font?: PDFFont; x?: number; y?: number; size?: number; rotate?: unknown }) {
          if (o?.font) {
            const has = new Set(o.font.getCharacterSet());
            for (const c of text) if (!has.has(c.codePointAt(0)!) && c !== ' ') missing.add(`${c} in "${text}"`);
            if (booklet && o.size && !(o.rotate as { angle?: number } | undefined)?.angle) lines.push({ page: this, y: Math.round(o.y ?? 0), x0: o.x ?? 0, x1: (o.x ?? 0) + o.font.widthOfTextAtSize(text, o.size), text });
          }
          drawn += text + '\n';
          return real.call(this, text, o as never);
        });
        for (const unit of ['cm', 'in'] as const)
          for (const paper of ['letter', 'a4'] as const) {
            drawn = '';
            booklet = false;
            lines.length = 0;
            const where = `${unit}, ${paper}`;
            await toTiledPdf(sheet, paper, { title: look.name, unit, part: 'pattern' });
            booklet = true;
            await toTiledPdf(sheet, paper, { title: look.name, guide: print.guide, summary, unit, part: 'booklet' });
            expect([...missing], where).toEqual([]);
            const over: string[] = [];
            for (const a of lines) for (const b of lines) if (a !== b && a.page === b.page && Math.abs(a.y - b.y) < 4 && a.x0 < b.x0 && a.x1 > b.x0 + 1) over.push(`"${a.text}" runs into "${b.text}"`);
            expect(over, where).toEqual([]);
            // Each steps page opens on a step's name: the Ice Peplum's page 9 opened on step 8's drawings under no heading,
            // read as step 9's (pretend tester EK walk, Nov 27).
            const pages = [...new Set(lines.map((l) => l.page))];
            const from = pages.findIndex((pg) => lines.some((l) => l.page === pg && l.text === 'STEPS'));
            const heads = (pg: PDFPage) => lines.some((l) => l.page === pg && /^\d+\. /.test(l.text));
            const last = pages.length - 1 - [...pages].reverse().findIndex(heads);
            const headless = pages.slice(from + 1, last + 1).map((pg) => lines.filter((l) => l.page === pg && !/^MAISON TRAC|^\d+$|^Page \d/i.test(l.text)).sort((a, b) => b.y - a.y)[0]?.text ?? '').filter((t) => !/^\d+\. /.test(t));
            expect(headless, where).toEqual([]);
            // A step whose drawings run onto the next page keys the ones on this page too: the key was printed only after
            // the last row, so the first page of drawings had none (EL walk, Nov 27).
            const unkeyed = pages.filter((pg, k) => lines.some((l) => l.page === pages[k + 1] && / \(continued\)$/.test(l.text)) && !lines.some((l) => l.page === pg && /^[A-Z][A-Z ,]*: [A-Z]/.test(l.text)));
            expect(unkeyed.length, where).toBe(0);
            expect(drawn, where).not.toMatch(/NaN|undefined|Infinity|\[object/);
            expect(drawn, where).not.toMatch(/\(3\.94 in\)\s*\(3\.94 in\)/);
            const square = /10 CM · 3\.94 IN|10 cm \(3\.94 in\)/g;
            if (unit === 'in') {
              expect(drawn.replace(square, ''), where).not.toMatch(/\d\s*(cm|CM|mm|m|M)\b/);
              expect(drawn, where).not.toMatch(/\d \d\/\d| in in\b/);
              expect(drawn, where).toMatch(/\d-\d\/[248] (in|yd)/);
              // One way of writing a fraction on every page: "21-7/8 in" sat beside "¾ in" and "2⅜ yd" (pretend tester, Nov 18).
              expect(drawn, where).not.toMatch(/[⅛¼⅜½⅝¾⅞]/);
            } else expect(drawn.replace(square, ''), where).not.toMatch(/\d(\/\d+)?\s*(in|yd|IN|YD)\b(?! (from|the|a|an|and|to|place)\b)/);
          }
      });
});

// DR walk, Nov 20: the Blush Shift's inch booklet read "Shoulder seam (back) 5 in, ease -1/8 in, finished 5 in".
describe('the inch booklets add up', () => {
  afterEach(() => vi.restoreAllMocks());
  // "21-7/8 in" or "-1/8 in" in eighths of an inch.
  const eighths = (t: string) => {
    const m = /^([+\-−]?)(\d+)?(?:-?(\d)\/(\d))? in$/.exec(t.trim());
    if (!m || (!m[2] && !m[3])) return undefined;
    return (m[1] === '-' || m[1] === '−' ? -1 : 1) * (Number(m[2] ?? 0) * 8 + (m[3] ? (Number(m[3]) * 8) / Number(m[4]) : 0));
  };
  for (const id of IDS)
    for (const [bodyName, body] of Object.entries(BODIES))
      it(`${id}, ${bodyName}: each finished measurement is the body plus the ease`, async () => {
        const { look, print } = made(id, body);
        const summary = { rows: print.spec.filter((r) => typeof r.finished === 'number'), checks: [], flat: print.flat, fabric: print.guide.fabric, lays: print.lays, madeFor: 'Tester' };
        const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Tester' });
        const drawn: string[] = [];
        const real = PDFPage.prototype.drawText;
        vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, o?: unknown) {
          drawn.push(text);
          return real.call(this, text, o as never);
        });
        await toTiledPdf(sheet, 'letter', { title: look.name, guide: print.guide, summary, unit: 'in', part: 'booklet' });
        const wrong: string[] = [];
        let rows = 0;
        for (let i = 0; i + 2 < drawn.length; i++) {
          if (!/^[+\-−]/.test(drawn[i + 1])) continue;
          const [b, e, f] = [drawn[i], drawn[i + 1], drawn[i + 2]].map(eighths);
          if (b === undefined || e === undefined || f === undefined) continue;
          rows++;
          if (b + e !== f) wrong.push(`${drawn[i - 1]}: ${drawn[i]}, ease ${drawn[i + 1]}, finished ${drawn[i + 2]}`);
        }
        expect(rows).toBeGreaterThan(0);
        expect(wrong).toEqual([]);
      });
});

// The booklet split its seam check, leaving two checks alone on a page, and left step headings at a page's foot with
// their words over the page (pretend-tester walk, Nov 17).
describe('the tester booklets keep things together', () => {
  afterEach(() => vi.restoreAllMocks());
  for (const id of IDS)
    it(`${id}: the seam check on one page, and no heading alone at a page foot`, async () => {
      const { look, print } = made(id, EXAMPLE_BODY);
      const checks = checkPattern(print.pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket'));
      const summary = { rows: print.spec.filter((r) => typeof r.finished === 'number'), checks, flat: print.flat, fabric: print.guide.fabric, lays: print.lays, madeFor: 'Tester' };
      const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Tester' });
      for (const paper of ['letter', 'a4'] as const) {
        const pages = new Map<PDFPage, { y: number; text: string; size: number }[]>();
        const real = PDFPage.prototype.drawText;
        vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, o?: { y?: number; size?: number }) {
          if (!pages.has(this)) pages.set(this, []);
          pages.get(this)!.push({ y: o?.y ?? 0, text, size: o?.size ?? 0 });
          return real.call(this, text, o as never);
        });
        await toTiledPdf(sheet, paper, { title: look.name, guide: print.guide, summary, unit: 'cm', part: 'booklet' });
        vi.restoreAllMocks();
        const withOk = [...pages.values()].filter((t) => t.some((l) => l.text === 'OK' || l.text === 'CHECK'));
        expect(withOk.length, paper).toBe(1);
        for (const t of pages.values()) {
          const lowest = t.filter((l) => l.size >= 9).sort((a, b) => a.y - b.y)[0];
          expect(lowest && /^\d+\. /.test(lowest.text) && lowest.size === 11 ? lowest.text : '', paper).toBe('');
        }
      }
    });
});

// Piece labels printed through the page footer ("PAGE A2 ... PRINT AT 100%") on 9 of 10 tester pattern files (pretend-
// tester walk, Nov 18). The footer sits in the strip the page below repeats, so that strip is cleared under it first.
describe('the tester pattern pages keep their footer clear', () => {
  afterEach(() => vi.restoreAllMocks());
  const CM = 72 / 2.54;
  for (const id of IDS)
    it(`${id}: no piece words under the page footer`, async () => {
      const { look, print } = made(id, EXAMPLE_BODY);
      const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Tester' });
      for (const paper of ['letter', 'a4'] as const) {
        const events = new Map<PDFPage, ({ kind: 'text'; text: string; x: number; x1: number; y: number } | { kind: 'clear'; x1: number; y1: number })[]>();
        const add = (p: PDFPage, e: never) => (events.get(p) ?? events.set(p, []).get(p)!).push(e);
        const realText = PDFPage.prototype.drawText;
        const realRect = PDFPage.prototype.drawRectangle;
        vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, o?: { x?: number; y?: number; size?: number; font?: PDFFont }) {
          const x = o?.x ?? 0;
          const font = o?.font;
          const size = o?.size ?? 0;
          add(this, { kind: 'text', text, x, x1: x + (font ? font.widthOfTextAtSize(text, size) : 0), y: o?.y ?? 0 } as never);
          return realText.call(this, text, o as never);
        });
        vi.spyOn(PDFPage.prototype, 'drawRectangle').mockImplementation(function (this: PDFPage, o?: { x?: number; y?: number; width?: number; height?: number; color?: unknown }) {
          if (o && (o.color as { red?: number } | undefined)?.red === 1) add(this, { kind: 'clear', x1: (o.x ?? 0) + (o.width ?? 0), y1: (o.y ?? 0) + (o.height ?? 0) } as never);
          return realRect.call(this, o as never);
        });
        await toTiledPdf(sheet, paper, { title: look.name, unit: 'cm', part: 'pattern' });
        vi.restoreAllMocks();
        const under: string[] = [];
        for (const list of events.values()) {
          const foot = list.findIndex((e) => e.kind === 'text' && e.text.startsWith('PAGE '));
          expect(foot, 'a pattern page with no footer').toBeGreaterThan(0);
          const fy = (list[foot] as { y: number }).y;
          const clear = list.find((e) => e.kind === 'clear') as { x1: number; y1: number } | undefined;
          const line = list[foot + 1] as { x1: number; text: string };
          // And it keeps "ACTUAL SIZE", the words most print boxes use (A4 pages lost it, DS walk, Nov 21).
          expect(line.text, paper).toMatch(/ACTUAL SIZE/);
          // Words drawn on the footer's line before it, unless a cleared band went down between.
          for (const e of list.slice(0, foot))
            if (e.kind === 'text' && e.y > fy - 0.1 * CM && e.y < fy + 0.25 * CM && e.x < line.x1 + 0.3 * CM && e.x1 > 0.9 * CM && !(clear && list.indexOf(clear as never) > list.indexOf(e) && e.y < clear.y1 && e.x < clear.x1)) under.push(`"${e.text}"`);
        }
        expect(under, paper).toEqual([]);
      }
    });
});

// A tester taping Letter pages couldn't tell which of two dashed lines to cut, the print area's border or the trim line,
// and wasn't sure whether the half diamonds go over or beside each other (fit tester, Nov 20). Each page's cut edges
// now carry one solid line marked CUT, nothing dashed, and every diamond says OVER or UNDER the page it joins.
describe('the tester pages say where to cut and which page goes on top', () => {
  afterEach(() => vi.restoreAllMocks());
  for (const id of IDS)
    it(`${id}: one solid CUT line, and OVER or UNDER at every diamond`, async () => {
      const { look, print } = made(id, EXAMPLE_BODY);
      const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Tester' });
      for (const unit of ['cm', 'in'] as const)
        for (const paper of ['letter', 'a4'] as const) {
          const where = `${unit}, ${paper}`;
          const texts = new Map<PDFPage, string[]>();
          const dashed: string[] = [];
          // Where each page's name in the footer starts, and its upright cut line: the line ran through "PAGE A2" (DP walk, Nov 20).
          const footAt = new Map<PDFPage, number>();
          const cutAt = new Map<PDFPage, number>();
          const realText = PDFPage.prototype.drawText;
          vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, o?: Parameters<PDFPage['drawText']>[1]) {
            texts.set(this, [...(texts.get(this) ?? []), text]);
            if (text.startsWith('PAGE ') && o?.x !== undefined) footAt.set(this, o.x);
            return realText.call(this, text, o);
          });
          const realLine = PDFPage.prototype.drawLine;
          vi.spyOn(PDFPage.prototype, 'drawLine').mockImplementation(function (this: PDFPage, o: Parameters<PDFPage['drawLine']>[0]) {
            if (o.dashArray?.length) dashed.push('line');
            if (o.start.x === o.end.x && (o.thickness ?? 1) >= 1) cutAt.set(this, o.start.x);
            return realLine.call(this, o);
          });
          const realRect = PDFPage.prototype.drawRectangle;
          vi.spyOn(PDFPage.prototype, 'drawRectangle').mockImplementation(function (this: PDFPage, o?: Parameters<PDFPage['drawRectangle']>[0]) {
            if (o?.borderDashArray?.length) dashed.push('rectangle');
            return realRect.call(this, o);
          });
          await toTiledPdf(sheet, paper, { title: look.name, unit, part: 'pattern' });
          vi.restoreAllMocks();
          expect(dashed, where).toEqual([]);
          for (const [pg, x] of cutAt) expect(footAt.get(pg)!, where).toBeGreaterThan(x + 2);
          for (const t of texts.values()) {
            // A bare page name only once on a page: its own, large and faint. A diamond's says OVER or UNDER.
            expect(t.filter((x) => /^[A-Z]\d+$/.test(x)).length, where).toBeLessThanOrEqual(1);
            if (t.some((x) => /^OVER [A-Z]\d+$/.test(x))) expect(t.filter((x) => x === 'CUT ON THE SOLID LINE').length, where).toBeGreaterThan(0);
          }
          expect([...texts.values()].flat().some((x) => /^UNDER [A-Z]\d+$/.test(x)), where).toBe(true);
        }
    });
});

// DT walk, Nov 21: the page map showed the pieces' outlines with no names, so which pages made which piece took working out.
describe('the page map names the pieces', () => {
  afterEach(() => vi.restoreAllMocks());
  for (const id of IDS)
    it(`${id}: every big piece's name is on the map`, async () => {
      const { look, print } = made(id, EXAMPLE_BODY);
      const summary = { rows: print.spec.filter((r) => typeof r.finished === 'number'), checks: [], flat: print.flat, fabric: print.guide.fabric, lays: print.lays, madeFor: 'Tester' };
      const sheet = layout(print.pieces, `Maison Tracé: ${look.name}`, print.notes, { pattern: look.name, madeFor: 'Tester' });
      const drawn: { page: PDFPage; text: string }[] = [];
      const real = PDFPage.prototype.drawText;
      vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (this: PDFPage, text: string, o?: unknown) {
        drawn.push({ page: this, text });
        return real.call(this, text, o as never);
      });
      await toTiledPdf(sheet, 'a4', { title: look.name, guide: print.guide, summary, unit: 'cm', part: 'booklet' });
      // Only the map's own page: the cutting layouts after it name the pieces too.
      const mapPage = drawn.find((d) => d.text === 'PAGE LAYOUT')!.page;
      const map = drawn.filter((d) => d.page === mapPage).map((d) => d.text).join('\n');
      // The two largest pieces (by their outline's span) are always big enough to name.
      const big = [...print.pieces].sort((a, b) => span(b) - span(a)).slice(0, 2);
      for (const pc of big) expect(map, pc.name).toContain(pc.name.toUpperCase());
    });
  const span = (pc: { outline: { points: () => { x: number; y: number }[] } }) => {
    const ps = pc.outline.points();
    return (Math.max(...ps.map((q) => q.x)) - Math.min(...ps.map((q) => q.x))) * (Math.max(...ps.map((q) => q.y)) - Math.min(...ps.map((q) => q.y)));
  };
});
