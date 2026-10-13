import { useMemo, useState } from 'react';
import type { Choices } from '../App';
import { OVERLAP, PAGE_MARGIN, PAPER_CM, Paper, layout, tileGrid, toSvg } from '../engine/export';
import { SkirtDraft } from '../engine/skirt';
import { PatternPreview } from '../ui/Preview';
import { describe } from './StyleScreen';

interface Props {
  profile: string;
  choices: Choices;
  draft?: SkirtDraft;
  error?: string;
  onBack: () => void;
}

const PAPERS: { id: Paper; label: string }[] = [
  { id: 'a4', label: 'A4, print at home' },
  { id: 'letter', label: 'US Letter, print at home' },
];

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
  const [paper, setPaper] = useState<Paper>('a4');
  const [busy, setBusy] = useState(false);
  const title = describe(choices);
  const sheet = useMemo(
    () =>
      draft
        ? layout(draft.pieces, `Pattern Maker: ${title}`, [
            `Finished waist ${draft.finishedWaist} cm, hip ${draft.finishedHip} cm, length ${draft.lengthCm} cm.`,
            'Seam allowance 1.5 cm included, 4 cm at the hem. Dashed line = stitching line.',
          ])
        : undefined,
    [draft, title],
  );

  if (!draft || !sheet) {
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

  const getPdf = async () => {
    setBusy(true);
    try {
      const { toTiledPdf } = await import('../engine/pdf');
      download(await toTiledPdf(sheet, paper), 'application/pdf', `${fileBase}-${paper}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split">
      <section className="card grow" aria-labelledby="ptitle">
        <div className="row between wrap">
          <h1 id="ptitle">{title[0].toUpperCase() + title.slice(1)}</h1>
          <p className="muted">Profile: {profile} · {choices.fit[0].toUpperCase() + choices.fit.slice(1)} fit</p>
        </div>
        <div className="preview tiles" style={{ ['--cols' as string]: grid.cols }}>
          <PatternPreview sheet={sheet} label={`Pattern laid over ${pages} numbered print pages`} />
          <TileOverlay sheetW={sheet.width} sheetH={sheet.height} paper={paper} rows={grid.rows} cols={grid.cols} />
        </div>
        <p className="muted">
          {pages} pages. Tape them together by matching the row letters and column numbers. Print at 100% (actual size) and measure the 10 cm
          test square before you cut.
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
        <button type="button" className="primary" onClick={getPdf} disabled={busy}>
          {busy ? 'Making your PDF…' : `Download PDF (${pages} pages)`}
        </button>
        <button type="button" className="secondary" onClick={() => download(toSvg(sheet), 'image/svg+xml', `${fileBase}.svg`)}>
          Download SVG
        </button>
        <p className="muted small">Your measurements and choices stay on this device. Save it from the style screen to find it again in your account.</p>
        <button type="button" className="link" onClick={onBack}>
          Back to style
        </button>
      </section>
    </div>
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
          <rect x={c * stepX} y={r * stepY} width={tw} height={th} fill="none" stroke="#555" strokeWidth={0.12} strokeDasharray="0.8 0.6" />
          <text x={c * stepX + 0.8} y={r * stepY + 2} fontSize={1.4} fill="#555" fontFamily="Space Mono, monospace">
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
