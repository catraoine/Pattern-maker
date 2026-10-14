import { useEffect, useMemo, useState } from 'react';
import { OVERLAP, PAGE_MARGIN, PAPER_CM, Paper, layout, tileGrid, toSvg } from '../engine/export';
import type { Piece } from '../engine/piece';
import type { SewingGuide } from '../engine/instructions';
import type { SpecRow } from '../engine/techpack';
import { PatternPreview } from '../ui/Preview';

/** What to print: the drafted pieces of either garment, with its notes and sewing steps. */
export interface Printable {
  pieces: Piece[];
  notes: string[];
  guide: SewingGuide;
  /** Body, ease and finished measurements, for the tech pack. */
  spec: SpecRow[];
}

interface Props {
  profile: string;
  title: string;
  fit: string;
  made?: Printable;
  error?: string;
  onBack: () => void;
}

const PAPERS: { id: Paper; label: string }[] = [
  { id: 'a4', label: 'A4, print at home' },
  { id: 'letter', label: 'US Letter, print at home' },
];

// Phones can hand a file to the share sheet (email, Files, AirDrop, a printer app); most desktops can't.
const canShareFiles = (() => {
  try {
    return (
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] })
    );
  } catch {
    return false;
  }
})();

function download(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportScreen({ profile, title, fit, made, error, onBack }: Props) {
  const [paper, setPaper] = useState<Paper>('a4');
  const [pdf, setPdf] = useState<{ paper: Paper; bytes: Uint8Array } | null>(null);
  const [shareNote, setShareNote] = useState('');
  const guide = made?.guide;
  const sheet = useMemo(() => (made ? layout(made.pieces, `Pattern Maker: ${title}`, made.notes) : undefined), [made, title]);

  // Build the PDF ahead of time, so share and print run straight from the tap (phones require that).
  useEffect(() => {
    if (!sheet || !guide) return;
    let live = true;
    setPdf(null);
    import('../engine/pdf')
      .then(({ toTiledPdf }) => toTiledPdf(sheet, paper, { title, guide }))
      .then((bytes) => live && setPdf({ paper, bytes }));
    return () => {
      live = false;
    };
  }, [sheet, paper, title, guide]);

  if (!made || !sheet || !guide) {
    return (
      <section className="card">
        <p className="msg error">{error ?? 'Add your measurements first.'}</p>
        <button type="button" className="link" onClick={onBack}>
          Back
        </button>
      </section>
    );
  }

  const grid = tileGrid(sheet, paper);
  const pages = grid.rows * grid.cols;
  const fileBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const fileName = `${fileBase}-${paper}.pdf`;
  const ready = pdf?.paper === paper ? pdf.bytes : null;

  const share = async () => {
    if (!ready) return;
    try {
      await navigator.share({ files: [new File([ready], fileName, { type: 'application/pdf' })], title: `Pattern Maker: ${title}` });
      setShareNote('');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareNote("Sharing didn't work on this device. Download the PDF instead.");
    }
  };

  const openToPrint = () => {
    if (!ready) return;
    const url = URL.createObjectURL(new Blob([ready], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <>
      <div className="split">
        <section className="card grow" aria-labelledby="ptitle">
          <div className="row between wrap">
            <h1 id="ptitle">{title[0].toUpperCase() + title.slice(1)}</h1>
            <p className="muted">
              Profile: {profile} · {fit[0].toUpperCase() + fit.slice(1)} fit
            </p>
          </div>
          <div className="preview tiles" style={{ ['--cols' as string]: grid.cols }}>
            <PatternPreview sheet={sheet} label={`Pattern laid over ${pages} numbered print pages`} />
            <TileOverlay sheetW={sheet.width} sheetH={sheet.height} paper={paper} rows={grid.rows} cols={grid.cols} />
          </div>
          <p className="muted">
            {pages} pages. Tape them together by matching the row letters and column numbers. Print at 100% (actual size) and measure the 10
            cm test square before you cut.
          </p>
        </section>

        <section className="card help" aria-labelledby="pset">
          <h2 id="pset">Print settings</h2>
          <fieldset className="group">
            <legend>Paper</legend>
            {PAPERS.map((p) => (
              <label key={p.id} className={paper === p.id ? 'radio on' : 'radio'}>
                <input type="radio" name="paper" checked={paper === p.id} onChange={() => setPaper(p.id)} />
                <span>{p.label}</span>
              </label>
            ))}
            <div className="radio locked" aria-disabled="true">
              <span>A0, copy shop</span>
              <span className="badge">Premium</span>
            </div>
          </fieldset>
          <button type="button" className="primary" onClick={() => ready && download(ready, 'application/pdf', fileName)} disabled={!ready}>
            {ready ? `Download PDF (${pages} pages)` : 'Making your PDF…'}
          </button>
          {canShareFiles && (
            <button type="button" className="secondary" onClick={share} disabled={!ready}>
              Send to email or a printer
            </button>
          )}
          <button type="button" className="secondary" onClick={openToPrint} disabled={!ready}>
            Open PDF to print
          </button>
          {shareNote && <p className="msg small">{shareNote}</p>}
          <p className="muted small">
            On a phone? Send the PDF to your email and print it from a computer, or print straight from the share menu. Always print at 100%
            (actual size).
          </p>
          <button type="button" className="link" onClick={() => download(toSvg(sheet), 'image/svg+xml', `${fileBase}.svg`)}>
            Download SVG (for pattern software)
          </button>
          <button type="button" className="link" onClick={onBack}>
            Back to style
          </button>
        </section>
      </div>

      <MakerPack profile={profile} title={title} fit={fit} made={made} fileBase={fileBase} />

      <section className="card sew" aria-labelledby="sewtitle">
        <div>
          <p className="eyebrow">After printing</p>
          <h2 id="sewtitle">How to sew it</h2>
        </div>
        <div className="sewgrid">
          <div className="notions">
            <p className="eyebrow">You'll need</p>
            <ul>
              {guide.notions.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="muted small">These steps are also on the last pages of the PDF.</p>
          </div>
          <ol className="sewsteps">
            {guide.steps.map((st) => (
              <li key={st.title}>
                <strong>{st.title}</strong>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Files for someone else to make the garment: a tech pack and the pattern as DXF for pattern software. */
function MakerPack({ profile, title, fit, made, fileBase }: { profile: string; title: string; fit: string; made: Printable; fileBase: string }) {
  const [busy, setBusy] = useState(false);
  const fitName = fit[0].toUpperCase() + fit.slice(1);

  const techPack = async () => {
    setBusy(true);
    try {
      const { toTechPack } = await import('../engine/techpack');
      const bytes = await toTechPack({
        title,
        profile,
        fit: fitName,
        date: today(),
        pieces: made.pieces,
        measurements: made.spec,
        notes: made.notes,
        guide: made.guide,
      });
      download(bytes, 'application/pdf', `${fileBase}-tech-pack.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const dxf = async () => {
    const { toDxf } = await import('../engine/dxf');
    download(toDxf(made.pieces, { style: title, size: profile, date: today() }), 'application/dxf', `${fileBase}.dxf`);
  };

  return (
    <section className="card" aria-labelledby="makertitle">
      <p className="eyebrow">Having it made</p>
      <h2 id="makertitle">For a dressmaker or factory</h2>
      <p className="muted">
        Send both files to whoever is making it. The tech pack has your measurements, the ease, the piece list, fabric and the construction
        steps. The DXF opens in pattern software such as Gerber, Lectra, Optitex and CLO 3D.
      </p>
      <div className="row wrap">
        <button type="button" className="secondary" onClick={techPack} disabled={busy}>
          {busy ? 'Making the tech pack…' : 'Download tech pack (PDF)'}
        </button>
        <button type="button" className="secondary" onClick={dxf}>
          Download pattern (DXF)
        </button>
      </div>
    </section>
  );
}

/** Dashed page boundaries drawn over the preview, matching how the PDF is tiled. */
function TileOverlay({ sheetW, sheetH, paper, rows, cols }: { sheetW: number; sheetH: number; paper: Paper; rows: number; cols: number }) {
  const [pw, ph] = PAPER_CM[paper];
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  const stepX = tw - OVERLAP;
  const stepY = th - OVERLAP;
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push(
        <g key={`${r}-${c}`}>
          <rect x={c * stepX} y={r * stepY} width={tw} height={th} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={0.12} strokeDasharray="0.8 0.6" />
          <text x={c * stepX + 0.8} y={r * stepY + 2} fontSize={1.4} style={{ fill: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            {String.fromCharCode(65 + r)}
            {c + 1}
          </text>
        </g>,
      );
  return (
    <svg viewBox={`0 0 ${sheetW} ${sheetH}`} className="preview-svg overlay" aria-hidden="true">
      {cells}
    </svg>
  );
}
