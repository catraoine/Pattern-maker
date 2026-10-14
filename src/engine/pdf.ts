// Pattern PDFs: tiled for home printing or a copy shop, or one true-size page for a projector.
// Kept separate so pdf-lib only loads when someone downloads.
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  clip,
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
import { P } from './geometry';
import { Face, OVERLAP, PAGE_MARGIN, Paper, STYLES, Sheet, pageName, pageSize, tileGrid, usedTiles } from './export';
import type { SewingGuide } from './instructions';
import type { Check, FinishedRow } from './qc';

const CM = 72 / 2.54; // PDF points per cm

type Fonts = Record<Face, PDFFont>;

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The Contour Line typefaces: Chakra Petch for labels, Space Grotesk for text. */
async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [label, body, bodyMedium] = await Promise.all(
    [fontData.label, fontData.body, fontData.bodyMedium].map((f) => doc.embedFont(bytes(f), { subset: true })),
  );
  return { label, body, bodyMedium };
}

/** Text with letter spacing. `x` is the left edge, or the centre when `centre` is set. */
function drawText(
  page: PDFPage,
  text: string,
  o: { x: number; y: number; size: number; font: PDFFont; grey?: number; tracking?: number; rotate?: number; centre?: boolean },
) {
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
      if (pr.at.x < ox - 40 || pr.at.x > ox + w + 40 || pr.at.y < oy - 2 || pr.at.y > oy + h + 2) continue;
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

/** Everything printed after the pattern pages. */
export interface PdfExtras {
  title: string;
  guide?: SewingGuide;
  summary?: Summary;
}

export interface Summary {
  rows: FinishedRow[];
  checks: Check[];
  madeFor?: string;
  date?: string;
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

/** Tile the sheet onto printer pages with trim guides, matching diamonds and page names. */
export async function toTiledPdf(sheet: Sheet, paper: Paper, extras?: PdfExtras): Promise<Uint8Array> {
  const [pw, ph] = pageSize(sheet, paper);
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  const stepX = tw - OVERLAP;
  const stepY = th - OVERLAP;
  const { rows, cols } = tileGrid(sheet, paper);
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  doc.setTitle(extras ? `Maison Tracé: ${extras.title}` : 'Maison Tracé pattern');
  const grey = rgb(0.6, 0.6, 0.6);
  // The top and left pages of a join are trimmed halfway across the overlap.
  const trim = OVERLAP / 2;

  const used = usedTiles(sheet, paper);
  const has = (r: number, c: number) => !!used[r]?.[c];
  const total = used.flat().filter(Boolean).length;
  let number = 0;
  for (let r = 0; r < rows; r++) {
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
      drawText(page, `PAGE ${name}`, { x: PAGE_MARGIN * CM, y: 0.4 * CM, size: 7, font: fonts.label, tracking: 0.2 });
      drawText(page, `${number} OF ${total}   ·   ROW ${String.fromCharCode(65 + r)}, COLUMN ${c + 1}   ·   PRINT AT 100% / ACTUAL SIZE`, {
        x: (PAGE_MARGIN + 2.2) * CM,
        y: 0.4 * CM,
        size: 7,
        font: fonts.label,
        grey: 0.4,
        tracking: 0.15,
      });
    }
  }
  if (extras?.summary) addSummaryPage(doc, fonts, sheet, paper === 'a0' ? 'a4' : paper, used, total, extras.title, extras.summary, [stepX, stepY]);
  if (extras?.guide) addSewingPages(doc, fonts, paper === 'a0' ? 'a4' : paper, extras.title, extras.guide);
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
      drawText(st.page, l, { x: left + indent, y: st.y, size, font: f, grey });
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
  return { st, write, label, room, left, width, pw, ph };
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
) {
  const { st, write, label, room, left, width } = flow(doc, paper, fonts);
  drawText(st.page, ['MAISON TRACÉ', s.madeFor && `MADE FOR ${s.madeFor}`, s.date].filter(Boolean).join('   ·   ').toUpperCase(), {
    x: left,
    y: st.y,
    size: 7.5,
    font: fonts.label,
    tracking: 0.3,
    grey: 0.4,
  });
  st.y -= 26;
  write(title[0].toUpperCase() + title.slice(1), 20, fonts.bodyMedium, 0, 18);

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

  const passed = s.checks.filter((c) => c.ok).length;
  label('SEAM CHECK');
  write(
    passed === s.checks.length
      ? `All ${passed} checks pass. Every pair of seams that sew together is walked to within 1 mm, curves blend across the seams within 2°, centre lines are square within 1° and dart legs are trued.`
      : `${passed} of ${s.checks.length} checks pass. Please look at the ones marked CHECK before cutting.`,
    9.5,
    fonts.body,
    0,
    10,
  );
  for (const c of s.checks) {
    room(14);
    drawText(st.page, c.ok ? 'OK' : 'CHECK', { x: left, y: st.y, size: 7, font: fonts.label, tracking: 0.2, grey: c.ok ? 0.4 : 0 });
    drawText(st.page, c.label, { x: left + 46, y: st.y, size: 9, font: fonts.body });
    drawText(st.page, c.detail, { x: left + 0.48 * width, y: st.y, size: 8.5, font: fonts.body, grey: 0.4 });
    st.y -= 14;
  }
  st.y -= 16;

  label('PAGE LAYOUT');
  write(
    `Print pages 1 to ${total} at 100% (actual size) and measure the 10 cm test square. Trim each page along its dashed line on the left and top, then lay it over the page before it so the half diamonds make whole ones, and tape.`,
    9.5,
    fonts.body,
    0,
    10,
  );
  // A small map: the pieces' cutting lines with the page grid over them.
  const k = Math.min(width / sheet.width, 190 / sheet.height);
  room(sheet.height * k + 10);
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
      drawText(st.page, pageName(r, c), { x: a.x + 3, y: a.y - 10, size: 7, font: fonts.label, tracking: 0.1, grey: 0.4 });
    }),
  );
  st.y -= sheet.height * k + 10;
}

/** Sewing steps after the pattern pages, so the tiled pages keep their numbers. */
function addSewingPages(doc: PDFDocument, fonts: Fonts, paper: 'a4' | 'letter', title: string, guide: SewingGuide) {
  const { write, label, st } = flow(doc, paper, fonts);
  drawText(st.page, 'MAISON TRACÉ', { x: 2 * CM, y: st.y, size: 7.5, font: fonts.label, tracking: 0.3, grey: 0.4 });
  st.y -= 26;
  write(`How to sew your ${title}`, 20, fonts.bodyMedium, 0, 18);
  label('YOU WILL NEED');
  guide.notions.forEach((n) => write(`-  ${n}`, 10, fonts.body, 0, 1));
  st.y -= 14;
  label('STEPS');
  guide.steps.forEach((s, i) => {
    write(`${i + 1}. ${s.title}`, 11, fonts.bodyMedium, 0, 2);
    write(s.text, 10, fonts.body, 18, 8);
  });
}
