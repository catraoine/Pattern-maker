// Pattern PDFs: tiled for home printing or a copy shop, or one true-size page for a projector.
// Kept separate so pdf-lib only loads when someone downloads.
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  clip,
  concatTransformationMatrix,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setCharacterSpacing,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fontData from './fontData';
import type { Unit } from '../measurements';
import { inInches } from '../units';
import { type Lay, hideSqFt, layWords } from './layplan';
import type { Flat } from './flat';
import { DIAGRAMS, DiagramId } from './diagrams';
import { P } from './geometry';
import { Face, OVERLAP, PAGE_MARGIN, Paper, STYLES, Sheet, pageName, pageSize, tileGrid, usedTiles } from './export';

// The page footer sits inside the 1 cm margin: closer to the edge most home printers cannot print, and some
// drivers then offer to shrink the page, which breaks the scale.
const FOOTER_Y = 1.05;
import type { SewingGuide } from './instructions';
import type { Check, FinishedRow } from './qc';
import type { DraftPoint } from './piece';

const CM = 72 / 2.54; // PDF points per cm

type Fonts = Record<Face, PDFFont>;

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The Contour Line typefaces: Chakra Petch for labels, Instrument Sans for text. */
async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [label, body, bodyMedium] = await Promise.all(
    [fontData.label, fontData.body, fontData.bodyMedium].map((f) => doc.embedFont(bytes(f), { subset: true })),
  );
  return { label, body, bodyMedium };
}

// Set for the document being written when the sewist works in inches; every string drawn is rewritten on its way out.
let inchMode = false;
const worded = (text: string) => (inchMode ? inInches(text) : text);

// Instrument Sans (the text face) has no fraction characters, so inch lengths like "21⅝ in" printed as "21[] in" in
// every inch tester's PDF (Nov 17). Where a face lacks one, write it the way pattern envelopes do: "21-5/8 in". With a
// space, this face sets "1 1/4 yd" so tight it reads as "11/4 yd"; the hyphen also keeps the two on one line.
const FRACTIONS: Record<string, string> = { '⅛': '1/8', '¼': '1/4', '⅜': '3/8', '½': '1/2', '⅝': '5/8', '¾': '3/4', '⅞': '7/8' };
const glyphs = new WeakMap<PDFFont, Set<number>>();
function printable(text: string, font: PDFFont): string {
  let has = glyphs.get(font);
  if (!has) glyphs.set(font, (has = new Set(font.getCharacterSet())));
  const set = has;
  return text.replace(/(\d?)([⅛¼⅜½⅝¾⅞])/g, (m, d: string, f: string) => (set.has(f.codePointAt(0)!) ? m : `${d}${d ? '-' : ''}${FRACTIONS[f]}`));
}

/** Text with letter spacing. `x` is the left edge, or the centre when `centre` is set. */
function drawText(
  page: PDFPage,
  text: string,
  o: { x: number; y: number; size: number; font: PDFFont; grey?: number; tracking?: number; rotate?: number; centre?: boolean; worded?: boolean },
) {
  // Wrapped lines come already in the sewist's unit: rewriting them again turned "exactly 10 cm (3.94 in)" into
  // "exactly 10 cm (3.94 in) (3.94 in)" in the inch booklet.
  text = printable(o.worded ? text : worded(text), o.font);
  const cs = (o.tracking ?? 0) * o.size;
  const width = o.font.widthOfTextAtSize(text, o.size) + cs * Math.max(0, text.length - 1);
  const shift = o.centre ? width / 2 : 0;
  const rad = ((o.rotate ?? 0) * Math.PI) / 180;
  if (cs) page.pushOperators(setCharacterSpacing(cs));
  const g = o.grey ?? 0;
  page.drawText(text, {
    // Rotation is clockwise in sheet space, which is counter-clockwise flipped in PDF space.
    x: o.x - shift * Math.cos(rad),
    y: o.y + shift * Math.sin(rad),
    size: o.size,
    font: o.font,
    color: rgb(g, g, g),
    rotate: degrees(-(o.rotate ?? 0)),
  });
  if (cs) page.pushOperators(setCharacterSpacing(0));
  return width;
}

/**
 * Draw the part of the sheet from (ox, oy) cm onward, with that point landing at (left, top) cm on
 * the page. `ink` maps a grey level to the printed one (inverted on a black projector page).
 */
function drawSheet(
  page: PDFPage,
  sheet: Sheet,
  fonts: Fonts,
  view: { ox: number; oy: number; w: number; h: number; left: number; top: number; ph: number },
  ink: (grey: number) => number = (g) => g,
  thin = 1,
) {
  const { ox, oy, w, h, left, top, ph } = view;
  for (const pr of sheet.prims) {
    if (pr.kind === 'poly') {
      const st = STYLES[pr.style];
      // Skip shapes entirely outside this view.
      const xs = pr.pts.map((q) => q.x);
      const ys = pr.pts.map((q) => q.y);
      if (Math.max(...xs) < ox || Math.min(...xs) > ox + w || Math.max(...ys) < oy || Math.min(...ys) > oy + h) continue;
      const d =
        pr.pts.map((q, i) => `${i ? 'L' : 'M'}${(q.x * CM).toFixed(2)} ${(q.y * CM).toFixed(2)}`).join(' ') + (pr.closed ? ' Z' : '');
      const g = ink(st.grey);
      page.drawSvgPath(d, {
        x: (left - ox) * CM,
        y: (ph - top + oy) * CM,
        borderColor: rgb(g, g, g),
        borderWidth: st.width * CM * thin,
        borderDashArray: st.dash ? st.dash.map((v) => v * CM) : undefined,
      });
    } else {
      // Skip words entirely outside this view, by where the words reach, not where they start: a label running up a
      // piece or a wide name block anchored off this page can still cross onto it. Culled by its anchor alone, it was
      // left off one page and printed on the next, so the words were cut where the two pages overlap.
      const font = fonts[pr.face ?? 'body'];
      const size = pr.size * CM * 0.85;
      const shown = printable(worded(pr.text), font);
      const width = (font.widthOfTextAtSize(shown, size) + (pr.tracking ?? 0) * size * Math.max(0, shown.length - 1)) / CM;
      const rad = (pr.rotate * Math.PI) / 180;
      const u = { x: Math.cos(rad), y: Math.sin(rad) };
      const from = pr.anchor === 'middle' ? width / 2 : 0;
      const ends = [-from, width - from].map((k) => ({ x: pr.at.x + u.x * k, y: pr.at.y + u.y * k }));
      const pad = pr.size + 0.5;
      if (
        Math.max(...ends.map((q) => q.x)) + pad < ox ||
        Math.min(...ends.map((q) => q.x)) - pad > ox + w ||
        Math.max(...ends.map((q) => q.y)) + pad < oy ||
        Math.min(...ends.map((q) => q.y)) - pad > oy + h
      )
        continue;
      const at = (q: P) => ({ x: (q.x - ox + left) * CM, y: (ph - top - (q.y - oy)) * CM });
      drawText(page, pr.text, {
        ...at(pr.at),
        size: pr.size * CM * 0.85,
        font: fonts[pr.face ?? 'body'],
        grey: ink(pr.grey ?? 0),
        tracking: pr.tracking,
        rotate: pr.rotate,
        centre: pr.anchor === 'middle',
      });
    }
  }
}

/** A technical flat at scale `k` (points per cm), its top left at (x0, y0), with FRONT and BACK under each view. */
function drawFlat(page: PDFPage, f: Flat, x0: number, y0: number, k: number, fonts: Fonts, line = 1) {
  const path = (pts: P[], close = false) => pts.map((q, i) => `${i ? 'L' : 'M'}${(q.x * k).toFixed(2)} ${(q.y * k).toFixed(2)}`).join(' ') + (close ? ' Z' : '');
  for (const v of f.views) {
    for (const sh of v.shapes) page.drawSvgPath(path(sh, true), { x: x0, y: y0, borderColor: rgb(0, 0, 0), borderWidth: 0.8 * line });
    for (const l of v.lines)
      page.drawSvgPath(path(l.pts), {
        x: x0,
        y: y0,
        borderColor: rgb(0, 0, 0),
        borderWidth: (l.kind === 'zip' ? 1 : l.kind === 'stitch' ? 0.35 : 0.5) * line,
        borderDashArray: l.kind === 'stitch' ? [1.4, 1] : undefined,
      });
    const xs = v.shapes[0].map((q) => q.x);
    drawText(page, v.label, { x: x0 + ((Math.min(...xs) + Math.max(...xs)) / 2) * k, y: y0 - f.height * k - 14, size: 7, font: fonts.label, tracking: 0.2, grey: 0.4, centre: true });
  }
}

/** The cover's name: as large as fits the frame on up to two lines, from 54 pt down to 20. A long name that two lines
 *  can't hold even at 20 pt (the Ice Peplum's and the Barrel Trouser's ran off the page; fit tester walk, Nov 14)
 *  takes as many lines as it needs. */
export function coverTitle(title: string, width: number, widthOf: (line: string, size: number) => number): { size: number; lines: string[] } {
  const name = title.toUpperCase();
  const words = name.split(' ');
  let size = 54;
  let lines = [name];
  const fits = (ls: string[], sz: number) => ls.every((l) => widthOf(l, sz) <= width);
  for (; size > 20; size -= 2) {
    if (fits([name], size)) break;
    const cut = words.findIndex((_, i) => i > 0 && fits([words.slice(0, i).join(' '), words.slice(i).join(' ')], size));
    if (cut > 0) {
      lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
      break;
    }
  }
  if (!fits(lines, size)) {
    lines = [];
    for (const w of words) {
      const last = lines.length ? `${lines[lines.length - 1]} ${w}` : w;
      if (lines.length && fits([last], size)) lines[lines.length - 1] = last;
      else lines.push(w);
    }
  }
  return { size, lines };
}

/**
 * The envelope cover, page 1 (Cat's pick with D1, 2026-10-18): the house name, the flat large, and the
 * garment's name set big at the foot, framed like the front of a designer's pattern envelope.
 */
function addCoverPage(doc: PDFDocument, fonts: Fonts, paper: 'a4' | 'letter', title: string, s: Summary & { flat: Flat }, name?: string) {
  const [pw, ph] = (paper === 'a4' ? [21.0, 29.7] : [21.59, 27.94]).map((v) => v * CM);
  const page = doc.insertPage(0, [pw, ph]);
  const m = 1.5 * CM;
  const pad = 1.2 * CM;
  page.drawRectangle({ x: m, y: m, width: pw - 2 * m, height: ph - 2 * m, borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
  const left = m + pad;
  const right = pw - m - pad;
  const width = right - left;
  const top = ph - m - pad;
  drawText(page, 'MAISON TRACÉ', { x: left, y: top - 8, size: 9, font: fonts.label, tracking: 0.3 });
  const mark = (s.edition ?? s.date ?? '').toUpperCase();
  if (mark) {
    const w = fonts.label.widthOfTextAtSize(mark, 8) + 0.3 * 8 * (mark.length - 1);
    drawText(page, mark, { x: right - w, y: top - 8, size: 8, font: fonts.label, tracking: 0.3, grey: 0.4 });
  }

  // The name at the foot, as large as fits the frame.
  const { size, lines } = coverTitle(name ?? title, width, (l, sz) => fonts.bodyMedium.widthOfTextAtSize(l, sz));
  const foot = m + pad + 8;
  const who = [s.madeFor && `DRAFTED TO ${s.madeFor === 'Me' ? 'YOU' : s.madeFor.toUpperCase()}`, s.lays?.[0] && !s.lays[0].hide ? `${s.lays[0].metres} M OF ${s.lays[0].width} CM FABRIC` : undefined]
    .filter(Boolean)
    .join('   ·   ');
  if (who) drawText(page, who, { x: left, y: foot, size: 8, font: fonts.label, tracking: 0.3, grey: 0.4 });
  let y = foot + 22;
  for (const l of [...lines].reverse()) {
    drawText(page, l, { x: left, y, size, font: fonts.bodyMedium, tracking: -0.01 });
    y += size * 0.98;
  }
  // A look's description goes over its name, small, so what was picked is still said.
  if (name) {
    drawText(page, title[0].toUpperCase() + title.slice(1), { x: left, y: y + 4, size: 9, font: fonts.body, grey: 0.35 });
    y += 14;
  }
  if (s.credit) drawText(page, s.credit, { x: left, y: y + 4, size: 9, font: fonts.body, grey: 0.35 });

  // The flat fills the space between, centred.
  const f = s.flat;
  const roomTop = top - 40;
  const roomBottom = y + 40;
  const k = Math.min(width / f.width, (roomTop - roomBottom - 24) / f.height);
  const x0 = left + (width - f.width * k) / 2;
  const y0 = roomTop - (roomTop - roomBottom - 24 - f.height * k) / 2;
  drawFlat(page, f, x0, y0, k, fonts, 1.3);
}

/** Everything printed after the pattern pages. */
interface PdfExtras {
  title: string;
  /** The collection look's name while the pattern is still that look ("Black Pleated Skirt"): the cover and the summary
   *  lead with it, the description under it. Only page 1 of the pattern said it, and testers know their piece by it
   *  (pretend tester, Nov 18). */
  name?: string;
  /** The sewist's unit: with `in`, every length in the PDF's text is written in inches. */
  unit?: Unit;
  guide?: SewingGuide;
  summary?: Summary;
  /** Which file (Cat, Nov 15: the pattern is what you print, the instructions are a booklet of their own): `pattern` is
   *  only the pages that tape together, `booklet` is the cover, summary, page map, layouts and steps. Left out, one file holds all. */
  part?: 'pattern' | 'booklet';
}

interface HandPiece {
  piece: string;
  frame: P[][];
  outline: P[];
  lines: P[][];
  points: DraftPoint[];
}

interface Summary {
  rows: FinishedRow[];
  checks: Check[];
  madeFor?: string;
  date?: string;
  /** A numbered drop's copy, and an Archive cut's credit line (see SheetInfo). */
  edition?: string;
  credit?: string;
  /** The pattern code (patternCode.ts). */
  code?: string;
  /** The atelier view: each piece's numbered drafting points and how they were found. */
  drafting?: { piece: string; points: DraftPoint[] }[];
  /** The draft-it-by-hand guide: each piece's frame, outline and numbered points, to redraw it on paper. */
  byHand?: HandPiece[];
  /** Cutting layouts, one for each fabric. */
  lays?: Lay[];
  /** The technical flat, front and back. */
  flat?: Flat;
  /** The maker's own fabric, line by line. */
  fabric?: string[];
}

/** Diamonds that meet across a taped join: one half on each page once the top sheet is trimmed. */
function diamond(page: PDFPage, x: number, y: number, label: string, labelSide: 'left' | 'right' | 'above' | 'below', font: PDFFont) {
  const r = 0.4 * CM;
  page.drawSvgPath(`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`, { x, y, borderColor: rgb(0, 0, 0), borderWidth: 0.6, color: rgb(0.85, 0.85, 0.85) });
  const size = 7;
  const w = font.widthOfTextAtSize(label, size);
  const at = {
    left: { x: x - r - 3 - w, y: y - size / 3 },
    right: { x: x + r + 3, y: y - size / 3 },
    above: { x: x - w / 2, y: y + r + 3 },
    below: { x: x - w / 2, y: y - r - 3 - size },
  }[labelSide];
  page.drawText(label, { ...at, size, font, color: rgb(0, 0, 0) });
}

/** How many pages a finished PDF holds (cover, tiles and guide pages together), for the print screen's note. */
export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

/** Tile the sheet onto printer pages with trim guides, matching diamonds and page names. */
export async function toTiledPdf(sheet: Sheet, paper: Paper, extras?: PdfExtras): Promise<Uint8Array> {
  const [pw, ph] = pageSize(sheet, paper);
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  const stepX = tw - OVERLAP;
  const stepY = th - OVERLAP;
  const { rows, cols } = tileGrid(sheet, paper);
  inchMode = extras?.unit === 'in';
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  // In the sewist's unit, like everything else in the file: an inch file's title said "91 cm" (pretend tester, Nov 18).
  const docTitle = extras && `Maison Tracé: ${extras.name ?? extras.title}${extras.part === 'booklet' ? ' (instructions)' : ''}`;
  doc.setTitle(docTitle ? (inchMode ? inInches(docTitle) : docTitle) : 'Maison Tracé pattern');
  const tiles = extras?.part !== 'booklet';
  const book = extras?.part !== 'pattern';
  const grey = rgb(0.6, 0.6, 0.6);
  // The top and left pages of a join are trimmed halfway across the overlap.
  const trim = OVERLAP / 2;

  const used = usedTiles(sheet, paper);
  const has = (r: number, c: number) => !!used[r]?.[c];
  const total = used.flat().filter(Boolean).length;
  let number = 0;
  for (let r = 0; r < (tiles ? rows : 0); r++) {
    for (let c = 0; c < cols; c++) {
      if (!has(r, c)) continue;
      number++;
      const page = doc.addPage([pw * CM, ph * CM]);
      const ox = c * stepX;
      const oy = r * stepY;
      const name = pageName(r, c);

      // A large, faint page name underneath, so pages can be sorted at a glance.
      if (paper !== 'a0') {
        drawText(page, name, { x: (pw / 2) * CM, y: (ph / 2) * CM - 30, size: 90, font: fonts.label, grey: 0.92, centre: true, tracking: 0.05 });
      }

      page.pushOperators(pushGraphicsState(), rectangle(PAGE_MARGIN * CM, PAGE_MARGIN * CM, tw * CM, th * CM), clip(), endPath());
      drawSheet(page, sheet, fonts, { ox, oy, w: tw, h: th, left: PAGE_MARGIN, top: PAGE_MARGIN, ph });
      page.pushOperators(popGraphicsState());

      // Trim guides: trim the left and top edges along the dashed line and lay the page over its neighbour.
      const guide = { borderColor: grey, borderWidth: 0.5, borderDashArray: [2, 2] };
      page.drawRectangle({ x: PAGE_MARGIN * CM, y: PAGE_MARGIN * CM, width: tw * CM, height: th * CM, ...guide });
      const left = (PAGE_MARGIN + trim) * CM;
      const top = (ph - PAGE_MARGIN - trim) * CM;
      const right = (PAGE_MARGIN + tw - trim) * CM;
      const bottom = (PAGE_MARGIN + trim) * CM;
      if (c > 0) page.drawLine({ start: { x: left, y: PAGE_MARGIN * CM }, end: { x: left, y: (ph - PAGE_MARGIN) * CM }, thickness: 0.5, color: grey, dashArray: [4, 2] });
      if (r > 0) page.drawLine({ start: { x: PAGE_MARGIN * CM, y: top }, end: { x: (pw - PAGE_MARGIN) * CM, y: top }, thickness: 0.5, color: grey, dashArray: [4, 2] });
      for (const f of [0.3, 0.7]) {
        const y = (PAGE_MARGIN + th * (1 - f)) * CM;
        const x = (PAGE_MARGIN + tw * f) * CM;
        if (has(r, c - 1)) diamond(page, left, y, pageName(r, c - 1), 'right', fonts.label);
        if (has(r, c + 1)) diamond(page, right, y, pageName(r, c + 1), 'left', fonts.label);
        if (has(r - 1, c)) diamond(page, x, top, pageName(r - 1, c), 'below', fonts.label);
        if (has(r + 1, c)) diamond(page, x, bottom, pageName(r + 1, c), 'above', fonts.label);
      }
      drawText(page, `PAGE ${name}`, { x: PAGE_MARGIN * CM, y: FOOTER_Y * CM, size: 7, font: fonts.label, tracking: 0.2 });
      drawText(page, `${number} OF ${total}   ·   ROW ${String.fromCharCode(65 + r)}, COLUMN ${c + 1}   ·   PRINT AT 100% / ACTUAL SIZE`, {
        x: (PAGE_MARGIN + 2.2) * CM,
        y: FOOTER_Y * CM,
        size: 7,
        font: fonts.label,
        grey: 0.4,
        tracking: 0.15,
      });
    }
  }
  if (!book) return doc.save();
  if (extras?.summary) addSummaryPage(doc, fonts, sheet, paper === 'a0' ? 'a4' : paper, used, total, extras.title, extras.summary, [stepX, stepY], extras.name);
  if (extras?.summary?.lays?.length) addLayPages(doc, fonts, paper === 'a0' ? 'a4' : paper, extras.summary.lays);
  if (extras?.summary?.byHand?.length) addHandPages(doc, fonts, paper === 'a0' ? 'a4' : paper, extras.title, extras.summary.byHand);
  if (extras?.summary?.drafting?.length) addDraftingPages(doc, fonts, paper === 'a0' ? 'a4' : paper, extras.title, extras.summary.drafting);
  if (extras?.guide) addSewingPages(doc, fonts, paper === 'a0' ? 'a4' : paper, extras.title, extras.guide);
  const cover = extras?.summary;
  if (cover?.flat) addCoverPage(doc, fonts, paper === 'a0' ? 'a4' : paper, extras!.title, { ...cover, flat: cover.flat }, extras!.name);
  return doc.save();
}

/** One page at true size for projecting onto fabric, in thin lines, light or on black. */
export async function toProjectorPdf(sheet: Sheet, opts: { dark?: boolean; title?: string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  doc.setTitle(opts.title ? `Maison Tracé: ${opts.title} (projector)` : 'Maison Tracé projector file');
  const page = doc.addPage([sheet.width * CM, sheet.height * CM]);
  if (opts.dark) page.drawRectangle({ x: 0, y: 0, width: sheet.width * CM, height: sheet.height * CM, color: rgb(0, 0, 0) });
  drawSheet(
    page,
    sheet,
    fonts,
    { ox: 0, oy: 0, w: sheet.width, h: sheet.height, left: 0, top: 0, ph: sheet.height },
    opts.dark ? (g) => 1 - g * 0.6 : (g) => g,
    0.6,
  );
  return doc.save();
}

/** Size of one printed label, in cm: about what a woven label measures. */
const LABEL_SIZE = { w: 6, h: 2 };

/**
 * A sheet of twelve sew-in labels to print at home (Cat's pick L4): the name, the house, and the pattern's
 * code. For iron-on transfer paper that asks for a mirrored print, the page is flipped.
 */
export async function toLabelSheetPdf(name: string, code: string, opts: { paper?: 'a4' | 'letter'; mirror?: boolean } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  doc.setTitle(`Maison Tracé labels: ${code}`);
  const [pw, ph] = opts.paper === 'letter' ? [21.59, 27.94] : [21.0, 29.7];
  const page = doc.addPage([pw * CM, ph * CM]);
  const cols = 2, rows = 6, gap = 1;
  const gridW = cols * LABEL_SIZE.w + (cols - 1) * gap;
  const left = (pw - gridW) / 2, top = 4;
  // The heading reads the right way round even on a mirrored page, so it sits outside the flip.
  drawText(page, 'MAISON TRACÉ   ·   LABELS', { x: (pw / 2) * CM, y: (ph - 2) * CM, size: 7.5, font: fonts.label, tracking: 0.3, grey: 0.4, centre: true });
  drawText(page, opts.mirror ? 'Mirrored for iron-on transfer paper. Cut along the grey lines.' : 'Print at 100%. Cut along the grey lines, then sew on or iron on.', {
    x: (pw / 2) * CM, y: (ph - 2.6) * CM, size: 8, font: fonts.body, grey: 0.4, centre: true,
  });
  if (opts.mirror) page.pushOperators(pushGraphicsState(), concatTransformationMatrix(-1, 0, 0, 1, pw * CM, 0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = (left + c * (LABEL_SIZE.w + gap)) * CM;
      const yTop = (ph - top - r * (LABEL_SIZE.h + gap)) * CM;
      page.drawRectangle({ x, y: yTop - LABEL_SIZE.h * CM, width: LABEL_SIZE.w * CM, height: LABEL_SIZE.h * CM, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.4 });
      const cx = x + (LABEL_SIZE.w / 2) * CM;
      drawText(page, `DRAFTED FOR ${name}`, { x: cx, y: yTop - 0.85 * CM, size: name.length > 12 ? 7 : 8.5, font: fonts.bodyMedium, tracking: 0.12, centre: true });
      drawText(page, `MAISON TRACÉ   ·   ${code}`, { x: cx, y: yTop - 1.45 * CM, size: 5.5, font: fonts.label, tracking: 0.25, grey: 0.25, centre: true });
    }
  if (opts.mirror) page.pushOperators(popGraphicsState());
  return doc.save();
}

/** A text flow over A4 or Letter pages, breaking to a new page when one fills. */
function flow(doc: PDFDocument, paper: 'a4' | 'letter', fonts: Fonts) {
  const [pw, ph] = paper === 'a4' ? [21.0, 29.7] : [21.59, 27.94];
  const left = 2 * CM;
  const width = (pw - 4) * CM;
  const st = { page: doc.addPage([pw * CM, ph * CM]), y: (ph - 2) * CM };
  const room = (need: number) => {
    if (st.y - need < 2 * CM) {
      st.page = doc.addPage([pw * CM, ph * CM]);
      st.y = (ph - 2) * CM;
    }
  };
  const wrap = (text: string, size: number, f: PDFFont, w = width - 18) => {
    text = printable(worded(text), f);
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > w && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const write = (text: string, size: number, f = fonts.body, indent = 0, gap = 4, grey = 0) => {
    const lines = wrap(text, size, f);
    room(lines.length * size * 1.35);
    for (const l of lines) {
      drawText(st.page, l, { x: left + indent, y: st.y, size, font: f, grey, worded: true });
      st.y -= size * 1.35;
    }
    st.y -= gap;
  };
  const label = (text: string, gap = 8) => {
    room(30);
    drawText(st.page, text, { x: left, y: st.y, size: 7.5, font: fonts.label, tracking: 0.3, grey: 0.4 });
    st.y -= 6;
    st.page.drawLine({ start: { x: left, y: st.y }, end: { x: left + width, y: st.y }, thickness: 0.4, color: rgb(0.75, 0.75, 0.75) });
    st.y -= gap + 6;
  };
  return { st, write, wrap, label, room, left, width, pw, ph };
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** The pattern summary: finished measurements, the seam check and a map of how the pages join. */
function addSummaryPage(
  doc: PDFDocument,
  fonts: Fonts,
  sheet: Sheet,
  paper: 'a4' | 'letter',
  used: boolean[][],
  total: number,
  title: string,
  s: Summary,
  [stepX, stepY]: [number, number],
  name?: string,
) {
  const { st, write, wrap, label, room, left, width, ph } = flow(doc, paper, fonts);
  drawText(st.page, ['MAISON TRACÉ', s.madeFor && `MADE FOR ${s.madeFor}`, s.date, s.edition, s.code && `CODE ${s.code}`].filter(Boolean).join('   ·   ').toUpperCase(), {
    x: left,
    y: st.y,
    size: 7.5,
    font: fonts.label,
    tracking: 0.3,
    grey: 0.4,
  });
  st.y -= 26;
  write(name ?? title[0].toUpperCase() + title.slice(1), 20, fonts.bodyMedium, 0, name || s.credit ? 6 : 18);
  if (name) write(title[0].toUpperCase() + title.slice(1), 9.5, fonts.body, 0, s.credit ? 6 : 18, 0.35);
  if (s.credit) write(s.credit, 9.5, fonts.body, 0, 18, 0.35);

  if (s.flat) {
    label('TECHNICAL FLAT');
    const f = s.flat;
    const k = Math.min(width / f.width, 200 / f.height);
    room(f.height * k + 24);
    // Centred across the page, front and back side by side.
    const x0 = left + (width - f.width * k) / 2;
    const y0 = st.y;
    drawFlat(st.page, f, x0, y0, k, fonts);
    st.y -= f.height * k + 34;
  }

  label('FINISHED MEASUREMENTS');
  const colX = [0, 0.45, 0.63, 0.81].map((f) => left + f * width);
  ['', 'BODY', 'EASE', 'FINISHED'].forEach((h, i) => drawText(st.page, h, { x: colX[i], y: st.y, size: 7, font: fonts.label, tracking: 0.2, grey: 0.4 }));
  st.y -= 16;
  for (const row of s.rows) {
    room(16);
    const cells = [row.label, row.body !== undefined ? `${fmt(row.body)} cm` : '', row.ease !== undefined ? `${row.ease < 0 ? '' : '+'}${fmt(row.ease)} cm` : '', typeof row.finished === 'number' ? `${fmt(row.finished)} cm` : row.finished];
    cells.forEach((t, i) => drawText(st.page, t, { x: colX[i], y: st.y, size: 10, font: i === 3 ? fonts.bodyMedium : fonts.body }));
    st.y -= 16;
  }
  st.y -= 14;

  if (s.fabric?.length) {
    label('FABRIC');
    s.fabric.forEach((l) => write(l, 9.5, fonts.body, 0, 2));
    st.y -= 12;
  }

  const passed = s.checks.filter((c) => c.ok).length;
  const intro =
    passed === s.checks.length
      ? `All ${passed} checks pass. Every pair of seams that sew together is walked to within 1 mm, curves blend across the seams within 2°, centre lines are square within 1° and dart legs are trued.`
      : `${passed} of ${s.checks.length} checks pass. Please look at the ones marked CHECK before cutting.`;
  // A long check name ran on under its own figures ("...blends across the shoulder" over "front 90.1°", Nov 17), so
  // each column wraps within its own width and the row takes as many lines as the longer one needs.
  const detailAt = 0.48 * width;
  const rows = s.checks.map((c) => {
    const names = wrap(c.label, 9, fonts.body, detailAt - 46 - 10);
    const details = wrap(c.detail, 8.5, fonts.body, width - detailAt);
    return { c, names, details, lines: Math.max(names.length, details.length) };
  });
  // The list was split with a few checks left over on a page of their own (pretend-tester walk, Nov 17). When it runs
  // over by a little, its rows close up a touch to stay on this page (never closer than a wrapped line's own 11 pt);
  // when it can't, the whole check starts on the next page, kept together.
  const wraps = rows.reduce((a, r) => a + (r.lines - 1) * 11, 0);
  const head = 30 + wrap(intro, 9.5, fonts.body).length * 9.5 * 1.35 + 10;
  const room0 = st.y - 2 * CM - head;
  const closeUp = rows.length > 0 && 14 * rows.length + wraps > room0 && (room0 - wraps) / rows.length >= 11;
  const whole = head + 14 * rows.length + wraps;
  if (!closeUp && whole <= (ph - 4) * CM) room(whole);
  label('SEAM CHECK');
  write(intro, 9.5, fonts.body, 0, 10);
  const base = closeUp ? (st.y - 2 * CM - wraps) / rows.length : 14;
  for (const { c, names, details, lines } of rows) {
    const step = base + (lines - 1) * 11;
    room(step - 0.01);
    drawText(st.page, c.ok ? 'OK' : 'CHECK', { x: left, y: st.y, size: 7, font: fonts.label, tracking: 0.2, grey: c.ok ? 0.4 : 0 });
    names.forEach((l, i) => drawText(st.page, l, { x: left + 46, y: st.y - i * 11, size: 9, font: fonts.body, worded: true }));
    details.forEach((l, i) => drawText(st.page, l, { x: left + detailAt, y: st.y - i * 11, size: 8.5, font: fonts.body, grey: 0.4, worded: true }));
    st.y -= step;
  }
  st.y -= 16;

  // The page map follows on a full page of its own, in the instructions (Cat, Nov 15).
  addMapPage(doc, fonts, sheet, paper, used, total, [stepX, stepY]);
}

/** The page map on a page of its own, as large as the page allows (Cat, Nov 15: it was a small sketch under the seam
 *  check, too small to tape by): how to print and join the pages, and every page's place over the pieces. */
function addMapPage(doc: PDFDocument, fonts: Fonts, sheet: Sheet, paper: 'a4' | 'letter', used: boolean[][], total: number, [stepX, stepY]: [number, number]) {
  const { st, write, label, left, width } = flow(doc, paper, fonts);
  label('PAGE LAYOUT');
  write(
    `Print page A2 first, at 100% (actual size), and measure its 10 cm test square; then print the other ${total - 1} pattern ${total === 2 ? 'page' : 'pages'} (page A1 has your pattern code). Trim each page along its dashed line on the left and top, then lay it over the page before it so the half diamonds make whole ones, and tape.${used.flat().some((u) => !u) ? " Pages with nothing on them aren't printed, so there are gaps in the numbers: leave a gap where a page is missing, as on the map below." : ''}`,
    9.5,
    fonts.body,
    0,
    10,
  );
  // The map: the pieces' cutting lines with the page grid over them, filling the rest of the page.
  st.y -= 6;
  const k = Math.min(width / sheet.width, (st.y - 2 * CM - 10) / sheet.height);
  const x0 = left;
  const y0 = st.y;
  const at = (q: P) => ({ x: x0 + q.x * k, y: y0 - q.y * k });
  for (const pr of sheet.prims) {
    if (pr.kind !== 'poly' || pr.style !== 'cut') continue;
    const d = pr.pts.map((q, i) => `${i ? 'L' : 'M'}${(q.x * k).toFixed(2)} ${(q.y * k).toFixed(2)}`).join(' ') + ' Z';
    st.page.drawSvgPath(d, { x: x0, y: y0, borderColor: rgb(0, 0, 0), borderWidth: 0.6 });
  }
  const [pw0, ph0] = [stepX + OVERLAP, stepY + OVERLAP];
  used.forEach((row, r) =>
    row.forEach((on, c) => {
      if (!on) return;
      const a = at({ x: c * stepX, y: r * stepY });
      st.page.drawRectangle({ x: a.x, y: a.y - ph0 * k, width: pw0 * k, height: ph0 * k, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.4, borderDashArray: [2, 2] });
      // Page names as large as the boxes allow, so each taped page can be found on the map at a glance.
      const size = Math.max(7, Math.min(16, ph0 * k * 0.18));
      drawText(st.page, pageName(r, c), { x: a.x + 4, y: a.y - size - 3, size, font: fonts.label, tracking: 0.1, grey: 0.35 });
    }),
  );
  st.y -= sheet.height * k + 10;
}

/** The cutting layouts: the fabric drawn lengthwise across the page, each piece where it is cut. */
function addLayPages(doc: PDFDocument, fonts: Fonts, paper: 'a4' | 'letter', lays: Lay[]) {
  const { write, label, st, room, left, width } = flow(doc, paper, fonts);
  drawText(st.page, 'MAISON TRACÉ   ·   CUTTING LAYOUT', { x: left, y: st.y, size: 7.5, font: fonts.label, tracking: 0.3, grey: 0.4 });
  st.y -= 26;
  write('Cutting layout', 20, fonts.bodyMedium, 0, 8);
  for (const lay of lays) {
    const k = width / Math.max(lay.length, 60);
    const h = lay.across * k;
    // Keep the heading and words on the page with their drawing.
    room(h + 90);
    label(lay.hide ? `LEATHER: ABOUT ${hideSqFt(lay)} SQ FT OF HIDE` : `${lay.fabric === 'lining' ? 'LINING' : lay.fabric === 'interlining' ? 'COUTIL' : 'FABRIC'}: ${lay.metres.toFixed(1)} M OF ${lay.width} CM WIDE`);
    write(layWords(lay), 9.5, fonts.body, 0, 10);
    room(h + 24);
    const x0 = left;
    const y0 = st.y;
    // Fabric along the page: its length runs left to right, the fold (or a selvedge) along the top.
    const at = (q: P) => `${(q.y * k).toFixed(2)} ${(q.x * k).toFixed(2)}`;
    st.page.drawRectangle({ x: x0, y: y0 - h, width: lay.length * k, height: h, color: rgb(0.96, 0.96, 0.96) });
    st.page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0 + lay.length * k, y: y0 }, thickness: 0.8, dashArray: lay.folded ? [4, 2] : undefined });
    const key: string[] = [];
    for (const pl of lay.placements) {
      const d = pl.pts.map((q, i) => `${i ? 'L' : 'M'}${at(q)}`).join(' ') + ' Z';
      st.page.drawSvgPath(d, { x: x0, y: y0, borderColor: rgb(0, 0, 0), borderWidth: 0.7, color: rgb(1, 1, 1) });
      const name = pl.name.toUpperCase() + (pl.single ? ' (1 LAYER)' : '');
      // A name wider or taller than its piece ran into the next piece's ("COLLAR" into "POCKET FACING" on the vest, the
      // trouser's belt loops over its fly facing, Nov 17). It breaks onto lines that fit the piece, a size smaller if
      // need be; a piece too small for even that carries a number, named in a key under the layout.
      const xs = pl.pts.map((q) => q.y * k);
      const ys = pl.pts.map((q) => q.x * k);
      // Most pieces aren't boxes, so a name gets the middle part of its piece's width, centred in its box.
      const roomW = 0.8 * (Math.max(...xs) - Math.min(...xs)) - 3;
      const mid = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 };
      const roomH = Math.max(...ys) - Math.min(...ys) - 2;
      const wide = (t: string, sz: number) => fonts.label.widthOfTextAtSize(t, sz) + 0.1 * sz * Math.max(0, t.length - 1);
      const fit = (sz: number) => {
        const lines: string[] = [];
        for (const word of name.split(' ')) {
          const next = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
          if (lines.length && wide(next, sz) <= roomW) lines[lines.length - 1] = next;
          else lines.push(word);
        }
        return lines.every((l) => wide(l, sz) <= roomW) && lines.length * sz * 1.2 <= roomH ? lines : undefined;
      };
      let size = 6;
      let lines = fit(6);
      if (!lines) lines = fit((size = 5));
      if (!lines) {
        key.push(name);
        size = 6;
        lines = [String(key.length)];
      }
      const shown = lines;
      shown.forEach((l, i) =>
        drawText(st.page, l, { x: x0 + mid.x, y: y0 - mid.y - size / 3 + ((shown.length - 1) / 2 - i) * size * 1.2, size, font: fonts.label, tracking: 0.1, centre: true }),
      );
    }
    drawText(st.page, lay.folded ? 'FOLD' : 'SELVEDGE', { x: x0, y: y0 + 4, size: 6.5, font: fonts.label, tracking: 0.2, grey: 0.4 });
    drawText(st.page, lay.folded ? 'SELVEDGES' : 'SELVEDGE', { x: x0, y: y0 - h - 10, size: 6.5, font: fonts.label, tracking: 0.2, grey: 0.4 });
    st.y -= h + 24;
    if (key.length) {
      st.y += 4;
      write(key.map((n, i) => `${i + 1}  ${n}`).join('     '), 7.5, fonts.label, 0, 12);
    }
  }
}

/** The atelier view in print: how each piece was drafted, point by point, matching the numbers on the pattern. */
function addDraftingPages(doc: PDFDocument, fonts: Fonts, paper: 'a4' | 'letter', title: string, drafting: NonNullable<Summary['drafting']>) {
  const { write, label, st, room, left } = flow(doc, paper, fonts);
  drawText(st.page, 'MAISON TRACÉ   ·   ATELIER VIEW', { x: 2 * CM, y: st.y, size: 7.5, font: fonts.label, tracking: 0.3, grey: 0.4 });
  st.y -= 26;
  write(`How your ${title} was drafted`, 20, fonts.bodyMedium, 0, 8);
  write(
    'Each piece is drafted flat from your own measurements, in a frame of rectangles, the way a pattern cutter drafts by hand. The numbers match the points on the pattern. Lengths include the ease for the fit you chose.',
    9.5,
    fonts.body,
    0,
    14,
  );
  for (const d of drafting) {
    label(d.piece.toUpperCase());
    for (const pt of d.points) {
      room(14);
      drawText(st.page, pt.n, { x: left, y: st.y, size: 9, font: fonts.label, tracking: 0.05 });
      write(pt.note, 9.5, fonts.body, 24, 4);
    }
    st.y -= 10;
  }
}

/**
 * The draft-it-by-hand guide: for each piece, a small drawing of its frame, outline and numbered points,
 * with how each point is found, so it can be drafted again full size on pattern paper with a ruler.
 */
function addHandPages(doc: PDFDocument, fonts: Fonts, paper: 'a4' | 'letter', title: string, pieces: HandPiece[]) {
  const { write, label, st, room, left, width } = flow(doc, paper, fonts);
  drawText(st.page, 'MAISON TRACÉ   ·   DRAFT IT BY HAND', { x: 2 * CM, y: st.y, size: 7.5, font: fonts.label, tracking: 0.3, grey: 0.4 });
  st.y -= 26;
  write(`Draft your ${title} by hand`, 20, fonts.bodyMedium, 0, 8);
  write(
    'You can draw this pattern yourself, full size, instead of taping printed pages. You need pattern paper (or brown paper) a little bigger than each piece, a long ruler, a set square or anything with a true right angle, a French curve or a flexible curve for the neck and armholes, a pencil and a tape measure.',
    9.5,
    fonts.body,
    0,
    6,
  );
  write(
    'Work each piece in order. Draw the frame first: the long lines that start square to each other. Then mark each numbered point in turn, measuring as the note says, and join them. Straight edges are drawn with the ruler; curves follow the drawing through the points. Lengths are in cm and already include the ease for your fit. Add the seam allowance last, the same width all round (wider at a hem), and copy the notches, grain line and dart lines.',
    9.5,
    fonts.body,
    0,
    14,
  );
  for (const hp of pieces) {
    const all = [...hp.outline, ...hp.frame.flat()];
    const xs = all.map((q) => q.x);
    const ys = all.map((q) => q.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const maxH = 10 * CM;
    const k = Math.min((width * 0.55) / Math.max(x1 - x0, 1), maxH / Math.max(y1 - y0, 1));
    const h = (y1 - y0) * k;
    // The piece's name stays with its drawing.
    room(h + 50);
    label(hp.piece.toUpperCase());
    const top = st.y - 6;
    const at = (q: P) => ({ x: left + (q.x - x0) * k, y: top - (q.y - y0) * k });
    const poly = (pts: P[], opts: { closed?: boolean; grey?: number; dash?: number[]; w?: number }) => {
      for (let i = 1; i < pts.length + (opts.closed ? 1 : 0); i++) {
        const a = at(pts[i - 1]);
        const b = at(pts[i % pts.length]);
        st.page.drawLine({ start: a, end: b, thickness: opts.w ?? 0.6, color: rgb(opts.grey ?? 0, opts.grey ?? 0, opts.grey ?? 0), dashArray: opts.dash });
      }
    };
    for (const f of hp.frame) poly(f, { grey: 0.6, dash: [3, 2], w: 0.5 });
    poly(hp.outline, { closed: true, w: 0.8 });
    for (const ln of hp.lines) poly(ln, { grey: 0.35, w: 0.5 });
    for (const pt of hp.points) {
      const a = at(pt.at);
      st.page.drawCircle({ x: a.x, y: a.y, size: 1.6, color: rgb(0, 0, 0) });
      drawText(st.page, pt.n, { x: a.x + 3, y: a.y + 2, size: 7.5, font: fonts.label });
    }
    // Notes beside the drawing where there is room, else below it.
    const notesLeft = left + (x1 - x0) * k + 18;
    const saved = st.y;
    st.y = top;
    const noteWidth = left + width - notesLeft;
    if (noteWidth > 150) {
      for (const pt of hp.points) {
        const lines = wrapText(pt.note, 8.5, fonts.body, noteWidth - 16);
        drawText(st.page, pt.n, { x: notesLeft, y: st.y, size: 8.5, font: fonts.label });
        for (const l of lines) {
          drawText(st.page, l, { x: notesLeft + 16, y: st.y, size: 8.5, font: fonts.body, worded: true });
          st.y -= 8.5 * 1.35;
        }
        st.y -= 3;
      }
      st.y = Math.min(st.y, top - h) - 14;
    } else {
      st.y = Math.min(saved, top - h) - 14;
      for (const pt of hp.points) {
        room(14);
        drawText(st.page, pt.n, { x: left, y: st.y, size: 9, font: fonts.label, tracking: 0.05 });
        write(pt.note, 9.5, fonts.body, 24, 4);
      }
    }
    st.y -= 8;
  }
}

function wrapText(text: string, size: number, f: PDFFont, w: number) {
  text = printable(worded(text), f);
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (f.widthOfTextAtSize(next, size) > w && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Sewing steps after the pattern pages, so the tiled pages keep their numbers. */
function addSewingPages(doc: PDFDocument, fonts: Fonts, paper: 'a4' | 'letter', title: string, guide: SewingGuide) {
  const { write, wrap, label, st, room } = flow(doc, paper, fonts);
  drawText(st.page, 'MAISON TRACÉ', { x: 2 * CM, y: st.y, size: 7.5, font: fonts.label, tracking: 0.3, grey: 0.4 });
  st.y -= 26;
  write(`How to sew your ${title}`, 20, fonts.bodyMedium, 0, 18);
  if (guide.fabric?.length) {
    label('YOUR FABRIC');
    guide.fabric.forEach((l) => write(l, 10, fonts.body, 0, 1));
    st.y -= 14;
  }
  label('YOU WILL NEED');
  guide.notions.forEach((n) => write(`-  ${n}`, 10, fonts.body, 0, 1));
  st.y -= 14;
  label('STEPS');
  guide.steps.forEach((s, i) => {
    // A step's heading was left alone at the foot of a page (pretend-tester walk, Nov 17): its words, which never split,
    // had gone over to the next. The heading goes over with them.
    room(11 * 1.35 + 2 + wrap(s.text, 10, fonts.body).length * 10 * 1.35);
    write(`${i + 1}. ${s.title}`, 11, fonts.bodyMedium, 0, 2);
    write(s.text, 10, fonts.body, 18, 8);
    if (s.diagram) drawDiagram(s.diagram);
  });

  /** A step's small drawing, under its words: black lines, the cloth in light grey. */
  function drawDiagram(id: DiagramId) {
    const dg = DIAGRAMS[id];
    const k = 3.2; // points per unit: 40 units is about 4.5 cm
    room(dg.h * k + 10);
    const x = 2 * CM + 18;
    const y = st.y;
    for (const pt of dg.parts) {
      const d = pt.pts.map((q, j) => `${j ? 'L' : 'M'}${(q.x * k).toFixed(2)} ${(q.y * k).toFixed(2)}`).join(' ') + (pt.closed ? ' Z' : '');
      const fill = pt.kind === 'cloth' ? rgb(0.95, 0.95, 0.95) : pt.kind === 'fold' ? rgb(0.86, 0.86, 0.86) : undefined;
      const dash = pt.kind === 'machine' ? [2, 1.2] : pt.kind === 'thread' ? [6, 3] : pt.kind === 'under' ? [1.5, 1.5] : undefined;
      const grey = pt.kind === 'under' ? 0.55 : 0;
      st.page.drawSvgPath(d, {
        x,
        y,
        color: pt.closed ? fill : undefined,
        borderColor: rgb(grey, grey, grey),
        borderWidth: pt.kind === 'hand' || pt.kind === 'thread' ? 0.9 : pt.kind === 'cloth' || pt.kind === 'fold' ? 0.6 : 0.7,
        borderDashArray: dash,
      });
    }
    st.y -= dg.h * k + 12;
  }
}
