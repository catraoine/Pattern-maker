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

const CM = 72 / 2.54; // PDF points per cm

/** Tile the sheet onto printer pages with trim guides, page labels and overlap for taping. */
export async function toTiledPdf(sheet: Sheet, paper: Paper): Promise<Uint8Array> {
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
  return doc.save();
}
