import { useEffect, useMemo, useState } from 'react';
import { OVERLAP, PAGE_MARGIN, Paper, Sheet, layout, pageCount, pageName, pageSize, tileGrid, toSvg, usedTiles } from '../engine/export';
import { checkPattern } from '../engine/qc';
import type { Piece } from '../engine/piece';
import type { SewingGuide } from '../engine/instructions';
import type { SpecRow } from '../engine/techpack';
import { PatternPreview } from '../ui/Preview';
import type { Finish } from '../App';
import { SaveControl } from '../ui/SaveControl';

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
  finish: Finish;
  onFinish: (f: Finish) => void;
  made?: Printable;
  error?: string;
  onBack: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
}

type Output = Paper | 'projector' | 'projectorDark';

// The dark projector file is the same page with white lines on black, offered as an option of the projector.
const PAPERS: { id: Paper | 'projector'; label: string }[] = [
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'US Letter' },
  { id: 'a0', label: 'A0 copy shop' },
  { id: 'projector', label: 'Projector' },
];

const isProjector = (o: Output): o is 'projector' | 'projectorDark' => o === 'projector' || o === 'projectorDark';

/** The date as printed on the pattern, such as 14 Oct 2026. */
const printedDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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

export function ExportScreen({ profile, title, fit, finish, onFinish, made, error, onBack, saveState, onSave, onAccount }: Props) {
  const [paper, setPaper] = useState<Output>('a4');
  const [pdf, setPdf] = useState<{ paper: Output; bytes: Uint8Array } | null>(null);
  const [shareNote, setShareNote] = useState('');
  const guide = made?.guide;
  const date = useMemo(printedDate, []);
  const sheet = useMemo(
    () =>
      made ? layout(made.pieces, `Maison Tracé: ${title}`, made.notes, { pattern: title, madeFor: profile, date }, { atelier: finish.atelier }) : undefined,
    [made, title, profile, date, finish.atelier],
  );
  // The seam check walks the garment's own pieces; its lining and facings follow them.
  const checks = useMemo(() => {
    if (!made) return [];
    const waist = made.spec.find((r) => r.label === 'Waist')?.finished;
    return checkPattern(
      made.pieces.filter((pc) => !pc.kind),
      { finishedWaist: typeof waist === 'number' ? waist : undefined },
    );
  }, [made]);
  const drafting = useMemo(() => (made ? made.pieces.filter((pc) => pc.draft).map((pc) => ({ piece: pc.name, points: pc.draft!.points })) : []), [made]);
  const summary = useMemo(
    () =>
      made
        ? { rows: made.spec.filter((r) => typeof r.finished === 'number'), checks, madeFor: profile, date, drafting: finish.atelier ? drafting : undefined }
        : undefined,
    [made, checks, profile, date, drafting, finish.atelier],
  );

  // Build the PDF ahead of time, so share and print run straight from the tap (phones require that).
  useEffect(() => {
    if (!sheet || !guide) return;
    let live = true;
    setPdf(null);
    import('../engine/pdf')
      .then(({ toTiledPdf, toProjectorPdf }) =>
        isProjector(paper) ? toProjectorPdf(sheet, { dark: paper === 'projectorDark', title }) : toTiledPdf(sheet, paper, { title, guide, summary }),
      )
      .then((bytes) => live && setPdf({ paper, bytes }));
    return () => {
      live = false;
    };
  }, [sheet, paper, title, guide, summary]);

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

  const projector = isProjector(paper);
  const grid = projector ? { rows: 1, cols: 1 } : tileGrid(sheet, paper);
  const pages = projector ? 1 : pageCount(sheet, paper);
  const passed = checks.filter((c) => c.ok).length;
  const fileBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const fileName = `${fileBase}-${paper === 'projectorDark' ? 'projector-black' : paper}.pdf`;
  const ready = pdf?.paper === paper ? pdf.bytes : null;

  const share = async () => {
    if (!ready) return;
    try {
      await navigator.share({ files: [new File([ready], fileName, { type: 'application/pdf' })], title: `Maison Tracé: ${title}` });
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

  const download_ = () => ready && download(ready, 'application/pdf', fileName);
  const paperChoice = projector ? 'projector' : paper;

  return (
    <>
      <div className="split">
        <section className="card grow" aria-labelledby="ptitle">
          <div>
            <h1 id="ptitle">{title[0].toUpperCase() + title.slice(1)}</h1>
            <p className="muted">
              For {profile === 'Me' ? 'you' : profile} · {fit[0].toUpperCase() + fit.slice(1)} fit
            </p>
          </div>
          <fieldset className="group">
            <legend>Print on</legend>
            <div className="chips" role="group" aria-label="Paper">
              {PAPERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={paperChoice === p.id ? 'chip on' : 'chip'}
                  aria-pressed={paperChoice === p.id}
                  onClick={() => setPaper(p.id === 'projector' ? (paper === 'projectorDark' ? 'projectorDark' : 'projector') : p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {projector && (
              <label className="check">
                <input type="checkbox" checked={paper === 'projectorDark'} onChange={(e) => setPaper(e.target.checked ? 'projectorDark' : 'projector')} />
                <span>White lines on black, easier to see on dark fabric</span>
              </label>
            )}
          </fieldset>
          <div className="stack">
            <button type="button" className="primary" onClick={download_} disabled={!ready}>
              {ready ? `Download PDF (${pages} ${pages === 1 ? 'page' : 'pages'})` : 'Making your PDF…'}
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
          </div>
          <p>
            {projector
              ? 'One page at true size, in fine lines for projecting onto fabric. Line your projector up with the 10 cm test square.'
              : paper === 'a0'
                ? 'Ask the copy shop to print at 100% (actual size). Measure the 10 cm test square before you cut.'
                : 'Print at 100% (actual size). Measure the 10 cm test square on page 1 before you cut.'}
          </p>
          {!projector && paper !== 'a0' && (
            <details className="small">
              <summary>How the pages fit together</summary>
              <p className="muted small">
                Trim each page along its dashed line on the left and top, then lay it over the page before so the half diamonds make whole ones.
                Tape them down and cut out your size line. On a phone, send the PDF to your email and print from a computer, or print straight from the
                share menu.
              </p>
            </details>
          )}
          <div className="preview tiles" style={{ ['--cols' as string]: grid.cols }}>
            <PatternPreview sheet={sheet} label={projector ? 'Pattern on one page for a projector' : `Pattern laid over ${pages} numbered print pages`} />
            {!projector && <TileOverlay sheet={sheet} paper={paper} />}
          </div>
          <p className="muted small">
            {passed === checks.length
              ? 'Checked: every seam meets its partner and every curve runs smoothly from piece to piece.'
              : `${checks.length - passed} of ${checks.length} seam checks found something to look at. The details are on the last page of the PDF.`}
          </p>
          <SaveControl state={saveState} onSave={onSave} onAccount={onAccount} />
          <p className="muted small">Printed it? The sewing steps are just below, and on the last pages of the PDF.</p>
          <button type="button" className="link" onClick={onBack}>
            Back to style
          </button>
        </section>
      </div>

      <MakerPack
        profile={profile}
        title={title}
        fit={fit}
        made={made}
        fileBase={fileBase}
        onSvg={() => download(toSvg(sheet), 'image/svg+xml', `${fileBase}.svg`)}
        atelier={finish.atelier}
        onAtelier={(on) => onFinish({ ...finish, atelier: on })}
        drafting={drafting}
      />

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
function MakerPack({
  profile,
  title,
  fit,
  made,
  fileBase,
  onSvg,
  atelier,
  onAtelier,
  drafting,
}: {
  profile: string;
  title: string;
  fit: string;
  made: Printable;
  fileBase: string;
  onSvg: () => void;
  atelier: boolean;
  onAtelier: (on: boolean) => void;
  drafting: { piece: string; points: { n: string; note: string }[] }[];
}) {
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
    <details className="card more">
      <summary>
        <span className="eyebrow">Having it made, or drafting by hand</span>
        <h2>More files</h2>
      </summary>
      <p className="muted">
        For a dressmaker or factory, send both files. The tech pack has the measurements, ease, piece list, fabric and sewing steps. The DXF opens
        in pattern software such as Gerber, Lectra, Optitex and CLO 3D.
      </p>
      <div className="row wrap">
        <button type="button" className="secondary" onClick={techPack} disabled={busy}>
          {busy ? 'Making the tech pack…' : 'Tech pack (PDF)'}
        </button>
        <button type="button" className="secondary" onClick={dxf}>
          Pattern (DXF)
        </button>
        <button type="button" className="secondary" onClick={onSvg}>
          Pattern (SVG)
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={atelier} onChange={(e) => onAtelier(e.target.checked)} />
        <span>
          Show how it was drafted <span className="muted small">numbered points on the pattern, with a note on how each was found</span>
        </span>
      </label>
      {atelier && (
        <div className="atelier">
          {drafting.map((d) => (
            <div key={d.piece}>
              <h3>{d.piece}</h3>
              <ol className="draftpoints">
                {d.points.map((pt) => (
                  <li key={pt.n}>
                    <span className="num">{pt.n}</span>
                    {pt.note}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

/** Dashed page boundaries drawn over the preview, matching how the PDF is tiled. Blank pages aren't printed. */
function TileOverlay({ sheet, paper }: { sheet: Sheet; paper: Paper }) {
  const [pw, ph] = pageSize(sheet, paper);
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  const stepX = tw - OVERLAP;
  const stepY = th - OVERLAP;
  const cells = usedTiles(sheet, paper).flatMap((row, r) =>
    row.map((on, c) =>
      on ? (
        <g key={`${r}-${c}`}>
          <rect x={c * stepX} y={r * stepY} width={tw} height={th} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={0.12} strokeDasharray="0.8 0.6" />
          <text x={c * stepX + 0.8} y={r * stepY + 2} fontSize={1.4} style={{ fill: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            {pageName(r, c)}
          </text>
        </g>
      ) : null,
    ),
  );
  return (
    <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} className="preview-svg overlay" aria-hidden="true">
      {cells}
    </svg>
  );
}
