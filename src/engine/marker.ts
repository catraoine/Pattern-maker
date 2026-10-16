// The full-scale marker: the cutting layout drawn at 1:1 for a plotter, as a PDF in panels no longer
// than a PDF page can be, and as a DXF with every piece in place on the fabric. Several sizes can go in
// one lay. Kept separate so pdf-lib only loads when someone downloads.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { P } from './geometry';
import type { Lay } from './layplan';
import { LAYER, Writer, ascii } from './dxf';

const CM = 72 / 2.54;
/** A PDF page can be up to 200 inches; panels stop short of that, with 2 cm overlap to join. */
export const PANEL_CM = 480;
const OVERLAP = 2;
const MARGIN = 3;

/** Where the marker is cut into panels along its length. */
export function panels(length: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < length; y += PANEL_CM - OVERLAP) {
    out.push([y, Math.min(length, y + PANEL_CM)]);
    if (y + PANEL_CM >= length) break;
  }
  return out;
}

/** The marker as a plotter PDF: the fabric's length across the page, its width down it. */
export async function markerPdf(lay: Lay, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.setTitle(`Maison Trace marker: ${ascii(title)}`);
  const across = lay.folded ? lay.across : lay.width - 2;
  const height = across + 2 * MARGIN + 4;
  const parts = panels(lay.length);
  parts.forEach(([y0, y1], k) => {
    const width = y1 - y0 + 2 * MARGIN;
    const page = doc.addPage([width * CM, height * CM]);
    // Marker x runs along the fabric (the lay's y), page y up from the bottom selvedge.
    const at = (q: P) => ({ x: (q.y - y0 + MARGIN) * CM, y: (q.x + MARGIN) * CM });
    page.drawRectangle({ x: MARGIN * CM, y: MARGIN * CM, width: (y1 - y0) * CM, height: across * CM, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
    for (const pl of lay.placements) {
      if (!pl.pts.some((q) => q.y >= y0 - 1 && q.y <= y1 + 1)) continue;
      const pts = pl.pts.map(at);
      const path = pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${(height * CM - q.y).toFixed(2)}`).join(' ') + ' Z';
      page.drawSvgPath(path, { x: 0, y: height * CM, borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
      const c = at(pl.at);
      if (pl.at.y >= y0 && pl.at.y <= y1) page.drawText(ascii(pl.name + (pl.single && lay.folded ? ' 1 LAYER' : '')), { x: c.x - 30, y: c.y, size: 14, font });
    }
    const head = `${ascii(title)}  |  ${lay.width} cm ${lay.folded ? 'folded' : 'single layer'}  |  ${lay.length} cm  |  panel ${k + 1} of ${parts.length}${k ? `, overlaps the last by ${OVERLAP} cm` : ''}`;
    page.drawText(head, { x: MARGIN * CM, y: (height - 2) * CM, size: 18, font });
    // A 10 cm check bar, to confirm the plotter is at 100%.
    page.drawRectangle({ x: MARGIN * CM, y: (MARGIN + across + 0.8) * CM, width: 10 * CM, height: 0.4 * CM, color: rgb(0, 0, 0) });
  });
  return doc.save();
}

/** The marker as a DXF: the fabric's edges, and every piece's cutting line where it lies, in mm. */
export function markerDxf(lay: Lay, info: { style: string; date: string }): string {
  const w = new Writer();
  const across = lay.folded ? lay.across : lay.width - 2;
  // DXF x along the fabric, y across it, so the pts' (x across, y along) swap.
  const swap = (q: P): P => ({ x: q.y, y: -q.x });
  w.g(0, 'SECTION');
  w.g(2, 'HEADER');
  w.g(9, '$ACADVER');
  w.g(1, 'AC1009');
  w.g(9, '$INSUNITS');
  w.g(70, '4');
  w.g(0, 'ENDSEC');
  w.g(0, 'SECTION');
  w.g(2, 'ENTITIES');
  w.polyline([{ x: 0, y: 0 }, { x: lay.length, y: 0 }, { x: lay.length, y: -across }, { x: 0, y: -across }].map((q) => ({ x: q.x, y: -q.y })), '0', true);
  for (const pl of lay.placements) {
    w.polyline(pl.pts.map(swap).map((q) => ({ x: q.x, y: -q.y })), LAYER.boundary, true);
    const c = swap(pl.at);
    w.text({ x: c.x, y: -c.y }, pl.name, LAYER.boundary, 4);
  }
  [`Style Name: ${info.style}`, `Creation Date: ${info.date}`, `Marker: ${lay.width} cm ${lay.folded ? 'folded' : 'single layer'}, ${lay.length} cm`, `Pieces: ${lay.placements.length}`, 'Units: METRIC'].forEach((t, k) =>
    w.text({ x: 0, y: -8 + k * 1.2 }, t, '0', 4),
  );
  w.g(0, 'ENDSEC');
  w.g(0, 'EOF');
  return w.out.join('\r\n') + '\r\n';
}
