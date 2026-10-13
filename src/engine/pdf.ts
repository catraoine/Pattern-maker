// Tiled PDF for home printing. Kept separate so pdf-lib only loads when someone downloads.
import {
  PDFDocument,
  StandardFonts,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from 'pdf-lib';
import { P } from './geometry';
import { OVERLAP, PAGE_MARGIN, PAPER_CM, Paper, STYLES, Sheet, tileGrid } from './export';
import type { SewingGuide } from './instructions';

const CM = 72 / 2.54; // PDF points per cm

/** Tile the sheet onto printer pages with trim guides, page labels and overlap for taping. */
export async function toTiledPdf(sheet: Sheet, paper: Paper, guide?: { title: string; guide: SewingGuide }): Promise<Uint8Array> {
  const [pw, ph] = PAPER_CM[paper];
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  const stepX = tw - OVERLAP;
  const stepY = th - OVERLAP;
  const { rows, cols } = tileGrid(sheet, paper);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.setTitle('Pattern Maker pattern');

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const page = doc.addPage([pw * CM, ph * CM]);
      const ox = c * stepX;
      const oy = r * stepY;
      // Sheet point (x, y) in cm lands on the page at these PDF coordinates (origin bottom left).
      const px = (q: P) => (q.x - ox + PAGE_MARGIN) * CM;
      const py = (q: P) => (ph - PAGE_MARGIN - (q.y - oy)) * CM;

      page.pushOperators(
        pushGraphicsState(),
        rectangle(PAGE_MARGIN * CM, PAGE_MARGIN * CM, tw * CM, th * CM),
        clip(),
        endPath(),
      );
      for (const pr of sheet.prims) {
        if (pr.kind === 'poly') {
          const st = STYLES[pr.style];
          // Skip shapes entirely outside this tile.
          const xs = pr.pts.map((q) => q.x);
          const ys = pr.pts.map((q) => q.y);
          if (Math.max(...xs) < ox || Math.min(...xs) > ox + tw || Math.max(...ys) < oy || Math.min(...ys) > oy + th) continue;
          const d =
            pr.pts.map((q, i) => `${i ? 'L' : 'M'}${(q.x * CM).toFixed(2)} ${(q.y * CM).toFixed(2)}`).join(' ') +
            (pr.closed ? ' Z' : '');
          page.drawSvgPath(d, {
            x: (PAGE_MARGIN - ox) * CM,
            y: (ph - PAGE_MARGIN + oy) * CM,
            borderColor: rgb(st.grey, st.grey, st.grey),
            borderWidth: st.width * CM,
            borderDashArray: st.dash ? st.dash.map((v) => v * CM) : undefined,
          });
        } else {
          const size = pr.size * CM * 0.85;
          const width = font.widthOfTextAtSize(pr.text, size);
          const shift = pr.anchor === 'middle' ? width / 2 : 0;
          const rad = (pr.rotate * Math.PI) / 180;
          // Rotation is clockwise in sheet space, which is counter-clockwise flipped in PDF space.
          page.drawText(pr.text, {
            x: px(pr.at) - shift * Math.cos(rad),
            y: py(pr.at) + shift * Math.sin(rad),
            size,
            font,
            color: rgb(0, 0, 0),
            rotate: degrees(-pr.rotate),
          });
        }
      }
      page.pushOperators(popGraphicsState());

      // Trim guides: cut along the dashed line and tape to the neighbouring page.
      const guide = { borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5, borderDashArray: [2, 2] };
      page.drawRectangle({ x: PAGE_MARGIN * CM, y: PAGE_MARGIN * CM, width: tw * CM, height: th * CM, ...guide });
      if (c > 0) {
        const gx = (PAGE_MARGIN + OVERLAP) * CM;
        page.drawLine({ start: { x: gx, y: PAGE_MARGIN * CM }, end: { x: gx, y: (ph - PAGE_MARGIN) * CM }, thickness: 0.5, color: guide.borderColor, dashArray: [2, 2] });
      }
      if (r > 0) {
        const gy = (ph - PAGE_MARGIN - OVERLAP) * CM;
        page.drawLine({ start: { x: PAGE_MARGIN * CM, y: gy }, end: { x: (pw - PAGE_MARGIN) * CM, y: gy }, thickness: 0.5, color: guide.borderColor, dashArray: [2, 2] });
      }
      page.drawText(
        `Row ${String.fromCharCode(65 + r)}  Column ${c + 1}   (${r * cols + c + 1} of ${rows * cols})   Print at 100% / actual size`,
        { x: PAGE_MARGIN * CM, y: 0.4 * CM, size: 8, font, color: rgb(0.4, 0.4, 0.4) },
      );
    }
  }
  if (guide) await addSewingPages(doc, paper, guide.title, guide.guide);
  return doc.save();
}

/** Sewing steps after the pattern pages, so the tiled pages keep their numbers. */
async function addSewingPages(doc: PDFDocument, paper: Paper, title: string, guide: SewingGuide) {
  const [pw, ph] = PAPER_CM[paper];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const left = 2 * CM;
  const width = (pw - 4) * CM;
  let page = doc.addPage([pw * CM, ph * CM]);
  let y = (ph - 2) * CM;

  const wrap = (text: string, size: number, f = font) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > width - 18 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const write = (text: string, size: number, f = font, indent = 0, gap = 4) => {
    const lines = wrap(text, size, f);
    if (y - lines.length * size * 1.35 < 2 * CM) {
      page = doc.addPage([pw * CM, ph * CM]);
      y = (ph - 2) * CM;
    }
    for (const l of lines) {
      page.drawText(l, { x: left + indent, y, size, font: f, color: rgb(0, 0, 0) });
      y -= size * 1.35;
    }
    y -= gap;
  };

  write(`How to sew your ${title}`, 18, bold, 0, 10);
  write('You will need', 11, bold, 0, 2);
  guide.notions.forEach((n) => write(`-  ${n}`, 10, font, 0, 1));
  y -= 10;
  guide.steps.forEach((st, i) => {
    write(`${i + 1}. ${st.title}`, 11, bold, 0, 1);
    write(st.text, 10, font, 18, 8);
  });
}
