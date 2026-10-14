import { useEffect, useMemo, useState } from 'react';
import type { Choices } from '../App';
import { OVERLAP, PAGE_MARGIN, Paper, Sheet, layout, pageCount, pageName, pageSize, tileGrid, toSvg, usedTiles } from '../engine/export';
import { FIT_EASE } from '../engine/skirt';
import { checkPattern } from '../engine/qc';
import { SkirtDraft } from '../engine/skirt';
import { PatternPreview } from '../ui/Preview';
import { describe, fabricMetres } from './StyleScreen';
import { sewingGuide } from '../engine/instructions';

interface Props {
  profile: string;
  choices: Choices;
  draft?: SkirtDraft;
  error?: string;
  onBack: () => void;
}

type Output = Paper | 'projector' | 'projectorDark';

const OUTPUTS: { id: Output; label: string }[] = [
  { id: 'a4', label: 'A4 at home' },
  { id: 'letter', label: 'US Letter at home' },
  { id: 'a0', label: 'A0 copy shop' },
  { id: 'projector', label: 'Projector' },
  { id: 'projectorDark', label: 'Projector, dark' },
];

const isProjector = (o: Output): o is 'projector' | 'projectorDark' => o === 'projector' || o === 'projectorDark';

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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

export function ExportScreen({ profile, choices, draft, error, onBack }: Props) {
  const [paper, setPaper] = useState<Output>('a4');
  const [pdf, setPdf] = useState<{ paper: Output; bytes: Uint8Array } | null>(null);
  const [shareNote, setShareNote] = useState('');
  const title = describe(choices);
  const guide = useMemo(() => (draft ? sewingGuide(draft, choices, fabricMetres(draft)) : undefined), [draft, choices]);
  const date = useMemo(today, []);
  const sheet = useMemo(
    () =>
      draft
        ? layout(
            draft.pieces,
            `Pattern Maker: ${title}`,
            [
              `Finished waist ${draft.finishedWaist} cm, hip ${draft.finishedHip} cm, length ${draft.lengthCm} cm.`,
              `Seam allowance ${draft.pieces[0].seamAllowance} cm included, ${draft.pieces[0].allowances.hem} cm at the hem. Dashed line = stitching line.`,
              `Waistband: mark a ${draft.waistband.cutLength} x ${draft.waistband.cutWidth} cm strip on the fabric. Sewing steps are on the last pages.`,
            ],
            { pattern: title, madeFor: profile, date },
          )
        : undefined,
    [draft, title, profile, date],
  );
  const checks = useMemo(() => (draft ? checkPattern(draft.pieces, { finishedWaist: draft.finishedWaist }) : []), [draft]);
  const summary = useMemo(() => {
    if (!draft) return undefined;
    const ease = FIT_EASE[choices.fit];
    const rows = [
      { label: 'Waist', body: draft.finishedWaist - ease.waist, ease: ease.waist, finished: draft.finishedWaist },
      { label: 'Hip', body: draft.finishedHip - ease.hip, ease: ease.hip, finished: draft.finishedHip },
      { label: 'Hem circumference', finished: draft.hemCm },
      { label: 'Length, waist to hem', finished: draft.lengthCm },
    ];
    return { rows, checks, madeFor: profile, date };
  }, [draft, choices.fit, checks, profile, date]);

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

  if (!draft || !sheet || !guide) {
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
              Profile: {profile} · {choices.fit[0].toUpperCase() + choices.fit.slice(1)} fit
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
          <p className="muted small qc">
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
