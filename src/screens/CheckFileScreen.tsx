import { useState } from 'react';
import type { P } from '../engine/geometry';
import { FileCheck, checkFile, readPatternFile } from '../engine/checkFile';

/**
 * Check any pattern: open a DXF or SVG from pattern software or a tracing, and the seams are walked:
 * edges that sew together are paired by length, each pair passing within a millimetre.
 */
export function CheckFileScreen({ onBack }: { onBack: () => void }) {
  const [res, setRes] = useState<FileCheck>();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setName(file.name);
    try {
      const pieces = readPatternFile(file.name, await file.text());
      if (!pieces.length) {
        setRes(undefined);
        setError('No closed pattern pieces found in this file. Each piece needs a closed cutting line (a closed polyline in a DXF, a closed path in an SVG).');
        return;
      }
      setRes(checkFile(pieces));
    } catch {
      setRes(undefined);
      setError('This file could not be read. Try saving it as an AAMA DXF, or as a plain SVG.');
    }
  };

  const ok = res?.pairs.filter((p) => p.ok).length ?? 0;
  const close = res?.pairs.filter((p) => !p.ok) ?? [];
  const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + Math.floor(i / 26) - 1)}${String.fromCharCode(65 + (i % 26))}`);
  const mm = (cm: number) => `${(Math.round(cm * 10) / 10).toFixed(1)} cm`;

  return (
    <div className="stack wide">
      <section className="card" aria-labelledby="cftitle">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Check any pattern</p>
            <h1 id="cftitle">Walk the seams of a pattern file</h1>
          </div>
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
        </div>
        <p className="muted">
          Open a pattern from Gerber, Lectra, Optitex or CLO 3D as a DXF, or a traced pattern as an SVG. Each piece is found, split into
          edges at its corners, and the edges are paired by length the way you would walk them with a tape. The file stays on this device.
        </p>
        <label className="primary filebtn">
          Open a DXF or SVG
          <input type="file" accept=".dxf,.svg,image/svg+xml" hidden onChange={(e) => void read(e.target.files?.[0])} />
        </label>
        {error && <p className="msg error">{error}</p>}
      </section>

      {res && (
        <section className="card" aria-labelledby="cfres">
          <h2 id="cfres">{name}</h2>
          <p>
            {res.pieces.length} {res.pieces.length === 1 ? 'piece' : 'pieces'}. {ok} {ok === 1 ? 'seam pairs' : 'seams pair'} within 1 mm
            {close.length ? `, ${close.length} within 3 mm` : ''}
            {res.unpaired.length ? `, and ${res.unpaired.length} ${res.unpaired.length === 1 ? 'edge' : 'edges'} with no partner` : ''}.
          </p>
          <p className="muted small">{res.notes.join(' ')} Hems, waists and fold lines have no partner of their own, so expect a few.</p>
          <div className="filecheck">
            {res.pieces.map((pc, i) => (
              <PieceView key={i} name={pc.name} pts={pc.stitch ?? pc.pts} marks={res.pairs.flatMap((pr, k) => [pr.a, pr.b].filter((e) => e.piece === i).map((e) => ({ pts: e.pts, label: letter(k), ok: pr.ok })))} />
            ))}
          </div>
          <ul className="fitlist changes">
            {res.pairs.map((pr, k) => (
              <li key={k} className={pr.ok ? '' : 'warn'}>
                <strong>{letter(k)}</strong>: {res.pieces[pr.a.piece].name} {mm(pr.a.length)} to {res.pieces[pr.b.piece].name} {mm(pr.b.length)},{' '}
                {pr.diffMm === 0 ? 'identical' : `${pr.diffMm} mm apart${pr.ok ? '' : ', more than a millimetre: eased on purpose, or one to true'}`}
              </li>
            ))}
            {res.unpaired.map((e, k) => (
              <li key={`u${k}`} className="muted">
                {res.pieces[e.piece].name}: an edge of {mm(e.length)} with no partner within 3 mm
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PieceView({ name, pts, marks }: { name: string; pts: P[]; marks: { pts: P[]; label: string; ok: boolean }[] }) {
  const x0 = Math.min(...pts.map((q) => q.x)) - 2;
  const y0 = Math.min(...pts.map((q) => q.y)) - 2;
  const w = Math.max(...pts.map((q) => q.x)) + 2 - x0;
  const h = Math.max(...pts.map((q) => q.y)) + 2 - y0;
  const fs = Math.max(1.5, Math.max(w, h) / 18);
  const line = (ps: P[]) => ps.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  return (
    <figure className="nest">
      <svg viewBox={`${x0} ${y0} ${w} ${h}`} role="img" aria-label={name}>
        <polygon points={line(pts)} className="nest-size" />
        {marks.map((m, i) => {
          const mid = m.pts[Math.floor(m.pts.length / 2)];
          return (
            <g key={i} className={m.ok ? 'seam-ok' : 'seam-warn'}>
              <polyline points={line(m.pts)} />
              <text x={mid.x} y={mid.y} fontSize={fs} textAnchor="middle" dominantBaseline="middle">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="small">{name}</figcaption>
    </figure>
  );
}
