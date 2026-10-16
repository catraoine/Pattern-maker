// Tech pack: the one document a dressmaker or sample room needs alongside the pattern file.
// Pieces drawn small, body and finished measurements with the ease, a piece list with cutting and
// seam allowances, fabric and notions, and the construction steps. A4, black on white.
// Kept separate from pdf.ts so pdf-lib only loads when someone downloads.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { P, len, sub } from './geometry';
import { Piece, bounds, cutLine } from './piece';
import type { SewingGuide } from './instructions';

/** One line of the measurement table, in cm. Body and ease are left out where they don't apply. */
export interface SpecRow {
  label: string;
  body?: number;
  ease?: number;
  finished: number | string;
}

export interface TechPack {
  title: string;
  profile: string;
  fit: string;
  date: string;
  pieces: Piece[];
  measurements: SpecRow[];
  notes: string[];
  guide: SewingGuide;
}

const CM = 72 / 2.54;
const [PW, PH] = [21.0, 29.7];
const LEFT = 2 * CM;
const RIGHT = (PW - 2) * CM;
const INK = rgb(0, 0, 0);
const GREY = rgb(0.4, 0.4, 0.4);
const RULE = rgb(0.75, 0.75, 0.75);

const fmt = (v: number | string | undefined) => (v === undefined ? '' : typeof v === 'number' ? String(Math.round(v * 10) / 10) : v);

/** Seam allowances by edge, as a short phrase: "1.5 cm, hem 4 cm, neck 1 cm". */
export function allowanceText(pc: Piece): string {
  const extra = Object.entries(pc.allowances)
    .filter(([tag, v]) => tag !== 'fold' && v !== pc.seamAllowance)
    .map(([tag, v]) => `${tag} ${fmt(v)} cm`);
  return [`${fmt(pc.seamAllowance)} cm`, ...extra].join(', ');
}

export async function toTechPack(tp: TechPack): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Tech pack: ${tp.title}`);
  doc.setCreator('Maison Tracé');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PW * CM, PH * CM]);
  let y = (PH - 2) * CM;
  let pageNo = 1;
  const footer = () =>
    page.drawText(`Tech pack  -  ${tp.title}  -  ${tp.profile}  -  page ${pageNo}`, {
      x: LEFT,
      y: 1.2 * CM,
      size: 7.5,
      font,
      color: GREY,
    });
  const newPage = () => {
    footer();
    page = doc.addPage([PW * CM, PH * CM]);
    pageNo += 1;
    y = (PH - 2) * CM;
  };
  const need = (h: number) => {
    if (y - h < 2.2 * CM) newPage();
  };

  const wrap = (text: string, size: number, f: PDFFont, width: number) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const write = (text: string, size: number, f = font, indent = 0, gap = 4, color = INK) => {
    const lines = wrap(text, size, f, RIGHT - LEFT - indent);
    need(lines.length * size * 1.35);
    for (const l of lines) {
      page.drawText(l, { x: LEFT + indent, y: y - size, size, font: f, color });
      y -= size * 1.35;
    }
    y -= gap;
  };
  const heading = (text: string) => {
    need(40);
    y -= 8;
    page.drawText(text.toUpperCase(), { x: LEFT, y: y - 9, size: 9, font: bold, color: INK });
    y -= 13;
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.5, color: INK });
    y -= 8;
  };
  /** A table with fixed column positions (points from the left margin); the first row is the header. */
  const table = (rows: string[][], cols: number[], align: ('l' | 'r')[]) => {
    rows.forEach((row, i) => {
      const f = i === 0 ? bold : font;
      const size = i === 0 ? 8 : 9;
      const lastW = (i: number) => (cols[i + 1] ?? RIGHT - LEFT) - cols[i] - 6;
      const cells = row.map((cell, c) => wrap(cell, size, f, lastW(c)));
      const h = Math.max(...cells.map((c) => c.length)) * size * 1.35 + 5;
      need(h);
      cells.forEach((lines, c) => {
        lines.forEach((l, k) => {
          const w = f.widthOfTextAtSize(l, size);
          const right = c + 1 < cols.length ? cols[c + 1] - 10 : RIGHT - LEFT;
          const x = LEFT + (align[c] === 'r' ? right - w : cols[c]);
          page.drawText(l, { x, y: y - size - k * size * 1.35, size, font: f, color: i === 0 ? GREY : INK });
        });
      });
      y -= h;
      page.drawLine({ start: { x: LEFT, y: y + 2 }, end: { x: RIGHT, y: y + 2 }, thickness: 0.3, color: RULE });
    });
    y -= 4;
  };

  // Title block.
  page.drawText('TECH PACK', { x: LEFT, y: y - 8, size: 8, font: bold, color: GREY });
  y -= 14;
  write(tp.title[0].toUpperCase() + tp.title.slice(1), 20, bold, 0, 4);
  write(`Made to measure for ${tp.profile}  -  ${tp.fit} fit  -  drafted ${tp.date}  -  Maison Tracé`, 9, font, 0, 6, GREY);

  // Pieces drawn small, side by side, so whoever cuts can check the file they opened.
  heading('Pattern pieces');
  drawPieces(page, tp.pieces, font, LEFT, y, RIGHT - LEFT, 8 * CM);
  y -= 8 * CM + 26;

  heading('Measurements (cm)');
  table(
    [['Measurement', 'Body', 'Ease', 'Finished'], ...tp.measurements.map((r) => [r.label, fmt(r.body), fmt(r.ease), fmt(r.finished)])],
    [0, 220, 300, 380],
    ['l', 'r', 'r', 'r'],
  );

  heading('Piece list');
  table(
    [['#', 'Piece', 'Cut', 'Seam allowance'], ...tp.pieces.map((pc, i) => [String(i + 1), pc.name, pc.cut, allowanceText(pc)])],
    [0, 22, 150, 290],
    ['l', 'l', 'l', 'l'],
  );

  heading('Fabric and notions');
  (tp.guide.fabric ?? []).forEach((l) => write(l, 10, font, 0, 1));
  tp.guide.notions.forEach((n) => write(`-  ${n}`, 10, font, 0, 1));

  if (tp.notes.length) {
    heading('Pattern notes');
    tp.notes.forEach((n) => write(n, 10, font, 0, 3));
  }

  heading('Construction');
  tp.guide.steps.forEach((st, i) => {
    write(`${i + 1}. ${st.title}`, 10, bold, 0, 1);
    write(st.text, 9.5, font, 14, 6);
  });

  heading('Files');
  write(
    'The full-size pattern comes with this tech pack as a DXF file (AAMA layout, millimetres) for Gerber, Lectra, Optitex or CLO 3D, and as a tiled PDF for printing. Cut line on layer 1, stitching line on layer 14, darts on layer 8, grain on layer 7, fold on layer 6, notches on layer 4.',
    9.5,
  );
  footer();
  return doc.save();
}

/** Outline each piece (cut line solid, stitching line fine) scaled to fit the box, labelled underneath. */
function drawPieces(page: PDFPage, pieces: Piece[], font: PDFFont, x: number, top: number, width: number, height: number) {
  const gap = 1.5; // cm between pieces before scaling
  const boxes = pieces.map(bounds);
  const totalW = boxes.reduce((s, b) => s + b[2] - b[0], 0) + gap * (pieces.length - 1);
  const maxH = Math.max(...boxes.map((b) => b[3] - b[1]));
  const k = Math.min(width / totalW, height / maxH); // points per cm
  let cx = x + (width - totalW * k) / 2;
  pieces.forEach((pc, i) => {
    const [x0, y0, x1] = boxes[i];
    const toPdf = (q: P) => ({ x: cx + (q.x - x0) * k, y: top - (q.y - y0) * k });
    const stroke = (pts: P[], closed: boolean, thickness: number, dash?: number[]) => {
      const all = closed && len(sub(pts[0], pts[pts.length - 1])) > 1e-6 ? [...pts, pts[0]] : pts;
      for (let j = 1; j < all.length; j++)
        page.drawLine({ start: toPdf(all[j - 1]), end: toPdf(all[j]), thickness, color: INK, dashArray: dash });
    };
    stroke(cutLine(pc), true, 0.8);
    stroke(pc.outline.points(12), true, 0.3, [2, 1.5]);
    pc.lines.forEach((ln) => stroke(ln.points(12), false, 0.4));
    if (pc.grain) stroke(pc.grain, false, 0.4);
    const label = `${i + 1}. ${pc.name}`;
    const lw = font.widthOfTextAtSize(label, 8);
    page.drawText(label, { x: cx + ((x1 - x0) * k - lw) / 2, y: top - height - 14, size: 8, font, color: INK });
    cx += (x1 - x0 + gap) * k;
  });
}
