import { useEffect, useMemo, useState } from 'react';
import { OVERLAP, PAGE_MARGIN, Paper, Sheet, layout, pageCount, pageName, pageSize, tileGrid, toSvg, usedTiles } from '../engine/export';
import { checkPattern } from '../engine/qc';
import type { Piece } from '../engine/piece';
import type { SewingGuide } from '../engine/instructions';
import type { SpecRow } from '../engine/techpack';
import { PatternPreview } from '../ui/Preview';
import { ALLOWANCE_LABELS, AllowanceStyle } from '../engine/allowances';
import type { BodiceEdges } from '../engine/instructions';
import type { Finish } from '../App';
import type { Garment } from '../measurements';
import type { Fitting } from '../engine/fitting';
import { FABRIC_WIDTHS, Lay, layWords } from '../engine/layplan';
import { LayPlanView } from '../ui/LayPlanView';
import type { Flat } from '../engine/flat';
import { TechFlatView } from '../ui/TechFlatView';
import { StepDiagram } from '../ui/StepDiagram';
import { CLOTHS, seamFinish } from '../engine/couture';

/** What to print: the drafted pieces of either garment, with its notes and sewing steps. */
export interface Printable {
  pieces: Piece[];
  notes: string[];
  guide: SewingGuide;
  /** Body, ease and finished measurements, for the tech pack. */
  spec: SpecRow[];
  /** Cutting layouts at the chosen fabric width, one for each fabric. */
  lays: Lay[];
  /** The garment drawn flat, front and back. */
  flat?: Flat;
}

interface Props {
  profile: string;
  title: string;
  fit: string;
  garment: Garment;
  finish: Finish;
  onFinish: (f: Finish) => void;
  made?: Printable;
  error?: string;
  onBack: () => void;
  /** Corrections from toile fittings, and their notes, already in the pattern. */
  fitting?: Fitting;
  fittingNotes: string[];
  onFitting: () => void;
}

type Output = Paper | 'projector' | 'projectorDark';

const OUTPUTS: { id: Output; label: string }[] = [
  { id: 'a4', label: 'A4 at home' },
  { id: 'letter', label: 'US Letter at home' },
  { id: 'a0', label: 'A0 copy shop' },
  { id: 'projector', label: 'Projector' },
  { id: 'projectorDark', label: 'Projector, dark' },
];

const EDGES: { id: BodiceEdges; label: string; detail: string }[] = [
  { id: 'binding', label: 'Bias binding', detail: 'Quick and neat' },
  { id: 'facings', label: 'Facings', detail: 'Clean edge, interfaced' },
  { id: 'lined', label: 'Fully lined', detail: 'The couture finish' },
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

export function ExportScreen({ profile, title, fit, garment, finish, onFinish, made, error, onBack, fitting, fittingNotes, onFitting }: Props) {
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
  const lays = useMemo(() => made?.lays ?? [], [made]);
  const summary = useMemo(
    () =>
      made
        ? { rows: made.spec.filter((r) => typeof r.finished === 'number'), checks, madeFor: profile, date, drafting: finish.atelier ? drafting : undefined, lays, flat: made.flat }
        : undefined,
    [made, checks, profile, date, drafting, finish.atelier, lays],
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
            <PatternPreview sheet={sheet} label={projector ? 'Pattern on one page for a projector' : `Pattern laid over ${pages} numbered print pages`} />
            {!projector && <TileOverlay sheet={sheet} paper={paper} />}
          </div>
          <p className="muted">
            {projector
              ? 'One page at true size, in fine lines for projecting onto fabric. Calibrate your projector to the 10 cm test square.'
              : paper === 'a0'
                ? `${pages} ${pages === 1 ? 'sheet' : 'sheets'} of A0. Ask the copy shop to print at 100% (actual size), then measure the 10 cm test square before you cut.`
                : `${pages} pages. Trim each page along its dashed line on the left and top and lay it over the one before, so the half diamonds make whole ones. Print at 100% (actual size) and measure the 10 cm test square before you cut.`}
          </p>
          {finish.atelier && (
            <div className="atelier">
              <p className="eyebrow">Atelier view: how it was drafted</p>
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
          <p className="muted small">
            {passed === checks.length
              ? `Pattern check: all ${passed} checks pass. Seams walked to within 1 mm, curves blend across seams, darts trued.`
              : `Pattern check: ${passed} of ${checks.length} checks pass. The details are in the PDF.`}
          </p>
        </section>

        <section className="card help" aria-labelledby="pset">
          <h2 id="pset">Print settings</h2>
          <fieldset className="group">
            <legend>Paper</legend>
            {OUTPUTS.map((p) => (
              <label key={p.id} className={paper === p.id ? 'radio on' : 'radio'}>
                <input type="radio" name="paper" checked={paper === p.id} onChange={() => setPaper(p.id)} />
                <span>{p.label}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="group">
            <legend>Seam allowances</legend>
            {(Object.keys(ALLOWANCE_LABELS) as AllowanceStyle[]).map((a) => (
              <label key={a} className={finish.allowances === a ? 'radio on' : 'radio'}>
                <input type="radio" name="allowances" checked={finish.allowances === a} onChange={() => onFinish({ ...finish, allowances: a })} />
                <span>
                  {ALLOWANCE_LABELS[a].label} <span className="muted small">{ALLOWANCE_LABELS[a].detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {garment === 'skirt' ? (
            <fieldset className="group">
              <legend>Lining</legend>
              {[false, true].map((on) => (
                <label key={String(on)} className={finish.skirtLined === on ? 'radio on' : 'radio'}>
                  <input type="radio" name="lining" checked={finish.skirtLined === on} onChange={() => onFinish({ ...finish, skirtLined: on })} />
                  <span>
                    {on ? 'Lined' : 'Unlined'} <span className="muted small">{on ? 'Hangs better, never clings' : 'Lighter, quicker'}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <fieldset className="group">
              <legend>Neck and armholes</legend>
              {EDGES.map((e) => (
                <label key={e.id} className={finish.bodiceEdges === e.id ? 'radio on' : 'radio'}>
                  <input type="radio" name="edges" checked={finish.bodiceEdges === e.id} onChange={() => onFinish({ ...finish, bodiceEdges: e.id })} />
                  <span>
                    {e.label} <span className="muted small">{e.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <label className="check">
            <input type="checkbox" checked={finish.atelier} onChange={(e) => onFinish({ ...finish, atelier: e.target.checked })} />
            <span>
              Atelier view <span className="muted small">show the draft: the frame, numbered points and how each was found</span>
            </span>
          </label>
          <button type="button" className="primary" onClick={() => ready && download(ready, 'application/pdf', fileName)} disabled={!ready}>
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

      {made?.flat && (
        <section className="card" aria-labelledby="flattitle">
          <p className="eyebrow">Technical flat</p>
          <h2 id="flattitle">{title}</h2>
          <TechFlatView flat={made.flat} title={title} />
          <p className="muted small">
            Drawn to scale from your pattern, with the darts sewn. It goes on the first page of the PDF, for a dressmaker or anyone
            checking the design.
          </p>
        </section>
      )}

      <section className="card" aria-labelledby="laytitle">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Cutting layout</p>
            <h2 id="laytitle">{lays.map((l) => `${l.metres.toFixed(1)} m${l.fabric === 'lining' ? ' of lining' : ''}`).join(' + ') || 'Too wide to lay out'}</h2>
          </div>
          <div className="row wrap">
            <div className="seg" role="group" aria-label="Fabric width">
              {FABRIC_WIDTHS.map((w) => (
                <button key={w} type="button" className={finish.fabricWidth === w ? 'on' : ''} aria-pressed={finish.fabricWidth === w} onClick={() => onFinish({ ...finish, fabricWidth: w })}>
                  {w} cm
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={finish.nap} onChange={(e) => onFinish({ ...finish, nap: e.target.checked })} />
              <span>
                Nap or one-way print <span className="muted small">every piece the same way up</span>
              </span>
            </label>
          </div>
        </div>
        {lays.length ? (
          lays.map((lay) => (
            <div key={lay.fabric} className="lay">
              {lays.length > 1 && <p className="eyebrow">{lay.fabric === 'lining' ? 'Lining' : 'Fabric'}</p>}
              <LayPlanView lay={lay} />
              <p className="muted small">{layWords(lay)}</p>
            </div>
          ))
        ) : (
          <p className="muted">These pieces are wider than {finish.fabricWidth} cm fabric. Try a wider fabric.</p>
        )}
      </section>

      <section className="card" aria-labelledby="toiletitle">
        <p className="eyebrow">Before your fabric{fittingNotes.length && fitting ? ` · version ${fitting.round + 1}` : ''}</p>
        <h2 id="toiletitle">{fittingNotes.length ? 'Corrected after your toile' : 'Fit it in a toile first'}</h2>
        {fittingNotes.length ? (
          <ul className="fitlist">
            {fittingNotes.map((n) => (
              <li key={n}>{n[0].toUpperCase() + n.slice(1)}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Make it up in calico first and try it on. Tell us what you see, such as pulling at the bust or a gaping neckline, and the
            pattern is corrected the way a pattern cutter would, with a second line for one side if your shoulders or hips differ.
          </p>
        )}
        <div className="row wrap">
          <button type="button" className="secondary" onClick={onFitting}>
            {fittingNotes.length ? 'Fit another toile' : 'I’ve tried on a toile'}
          </button>
        </div>
      </section>

      <MakerPack profile={profile} title={title} fit={fit} made={made} fileBase={fileBase} />

      <section className="card sew" aria-labelledby="sewtitle">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">After printing</p>
            <h2 id="sewtitle">How to sew it</h2>
          </div>
          <div className="seg" role="group" aria-label="How to sew it">
            {(['quick', 'couture'] as const).map((r) => (
              <button key={r} type="button" className={finish.route === r ? 'on' : ''} aria-pressed={finish.route === r} onClick={() => onFinish({ ...finish, route: r })}>
                {r === 'quick' ? 'Quick' : 'Couture'}
              </button>
            ))}
          </div>
        </div>
        {finish.route === 'couture' && (
          <div className="cloth">
            <p className="muted small">
              Thread-traced lines, basting and a fitting before machining, a hand-picked zip and hand-finished edges. The seam finish and
              pressing follow your cloth.
            </p>
            <div className="seg" role="group" aria-label="Your cloth">
              {CLOTHS.map((c) => (
                <button key={c.id} type="button" className={finish.cloth === c.id ? 'on' : ''} aria-pressed={finish.cloth === c.id} onClick={() => onFinish({ ...finish, cloth: c.id })} title={c.detail}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="muted small">
              Seams: {{ french: 'French seams', hongkong: 'Hong Kong bound', pinked: 'pinked', overcast: 'overcast by hand' }[seamFinish(finish.cloth, garment === 'bodice' ? finish.bodiceEdges === 'lined' : finish.skirtLined)]}.
            </p>
          </div>
        )}
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
                {st.diagram && <StepDiagram id={st.diagram} />}
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
