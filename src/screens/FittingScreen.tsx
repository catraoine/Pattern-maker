import { useMemo, useState } from 'react';
import type { P } from '../engine/geometry';
import type { Piece } from '../engine/piece';
import type { Side } from '../engine/skirt';
import { Carried, FIT_ISSUES, FitTarget, FitIssue, appliesTo, Fitting, NO_FITTING, describeFitting, setAmount, toggleIssue, versionsOf } from '../engine/fitting';
import { PieceChange, changeLabel, changeWords, compareEdges } from '../engine/compare';

interface Props {
  /** A dress is fitted as one toile, with the bodice's and the skirt's corrections together. */
  garment: FitTarget;
  /** The corrections the pattern is drafted with: this garment's own, with those carried in from the person's other toiles. */
  fitting?: Fitting;
  /** This garment's own saved fitting, with its earlier versions. */
  own?: Fitting;
  /** Which corrections came in from other toiles. */
  carried?: Carried['from'];
  /** The pattern's own pieces drafted with a set of corrections, for the before and after drawing. */
  draftWith: (f: Fitting) => Piece[] | undefined;
  /** The bodice has a bust dart (some corrections go into it). */
  hasBustDart: boolean;
  /** Save the corrections; `shown` lists those carried in, so one unticked here is cleared for good. */
  onSave: (f: Fitting, shown: string[]) => void;
  onCancel: () => void;
}

/**
 * After the toile: the person ticks what they see when they try it on, and each correction goes into
 * the pattern the way a pattern cutter would make it. The drawing shows the pattern before and after.
 */
export function FittingScreen({ garment, fitting, own, carried = [], draftWith, hasBustDart, onSave, onCancel }: Props) {
  const saved = fitting ?? NO_FITTING;
  const [f, setF] = useState<Fitting>(saved);
  const issues = FIT_ISSUES.filter((i) => appliesTo(i, garment) && (hasBustDart || !i.needsBustDart));
  const areaOf = (i: FitIssue) => (garment === 'dress' ? `${i.garment === 'skirt' ? 'Skirt' : 'Bodice'}: ${i.area.toLowerCase()}` : i.area);
  const areas = [...new Set(issues.map(areaOf))];
  const before = useMemo(() => draftWith(saved), [draftWith, saved]);
  const after = useMemo(() => draftWith(f), [draftWith, f]);
  const changed = JSON.stringify(f.issues) !== JSON.stringify(saved.issues) || JSON.stringify(f.sides ?? {}) !== JSON.stringify(saved.sides ?? {});
  const version = saved.round + 1;
  const list = describeFitting(f, garment);
  const changes = useMemo(() => (before && after ? compareEdges(before, after) : []), [before, after]);
  const fromOf = (id: string) => carried.find((c) => c.id === id)?.garment;

  return (
    <div className="split">
      <section className="card grow" aria-labelledby="fittitle">
        <div>
          <p className="eyebrow">After your toile · version {version}</p>
          <h1 id="fittitle">What do you see?</h1>
          <p className="muted">
            Sew the pattern in calico with long stitches and try it on, inside out, over the underwear you'll wear with it. Tick what you
            see and the pattern is corrected the way a pattern cutter would. Couture seam allowances leave room to let a toile out.
          </p>
        </div>
        {areas.map((area) => (
          <fieldset key={area} className="group">
            <legend>{area}</legend>
            {issues
              .filter((i) => areaOf(i) === area)
              .map((i) => (
                <IssueRow key={i.id} issue={i} f={f} onChange={setF} from={fromOf(i.id)} />
              ))}
          </fieldset>
        ))}
      </section>

      <section className="card help fitside" aria-labelledby="fitprev">
        <h2 id="fitprev">The correction</h2>
        {before && after ? (
          <BeforeAfter before={before} after={after} changes={changes} />
        ) : (
          <p className="msg error">These corrections can't be drafted for these measurements. Try a smaller amount.</p>
        )}
        <p className="muted small">
          Fine dashed line: the pattern now. Solid line: corrected, with each changed edge marked in millimetres. A second line is cut for
          one side only.
        </p>
        <ChangeList changes={changes} />
        {list.length ? (
          <ul className="fitlist">
            {list.map((l) => (
              <li key={l}>{l[0].toUpperCase() + l.slice(1)}</li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nothing to correct yet. If the toile fits, you're ready to cut your fabric.</p>
        )}
        <button
          type="button"
          className="primary"
          disabled={!changed || !after}
          onClick={() => onSave(f, carried.map((c) => c.id))}
        >
          {changed ? `Save as version ${version + 1}` : 'No changes yet'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Back to the pattern
        </button>
        {Object.keys(f.issues).length > 0 && (
          <button type="button" className="link" onClick={() => setF({ ...f, issues: {}, sides: {} })}>
            Clear every correction
          </button>
        )}
      </section>

      {own && own.round > 0 && <CompareVersions own={own} draftWith={draftWith} />}
    </div>
  );
}

/** Any two saved versions of the pattern laid one over the other, every changed edge marked in mm. */
function CompareVersions({ own, draftWith }: { own: Fitting; draftWith: (f: Fitting) => Piece[] | undefined }) {
  const versions = versionsOf(own);
  const [from, setFrom] = useState(versions[0].version);
  const [to, setTo] = useState(versions[versions.length - 1].version);
  const fa = versions.find((v) => v.version === from)?.fitting ?? NO_FITTING;
  const fb = versions.find((v) => v.version === to)?.fitting ?? NO_FITTING;
  const a = useMemo(() => draftWith(fa), [draftWith, fa]);
  const b = useMemo(() => draftWith(fb), [draftWith, fb]);
  const changes = useMemo(() => (a && b ? compareEdges(a, b) : []), [a, b]);
  const dateOf = (v: number) => {
    const d = versions.find((x) => x.version === v)?.fitting.date;
    return d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : v === 1 ? 'first draft' : '';
  };
  const picker = (label: string, v: number, set: (n: number) => void) => (
    <div className="seg" role="group" aria-label={label}>
      {versions.map((x) => (
        <button key={x.version} type="button" className={v === x.version ? 'on' : ''} aria-pressed={v === x.version} onClick={() => set(x.version)}>
          {x.version}
        </button>
      ))}
    </div>
  );
  return (
    <section className="card grow" aria-labelledby="cmptitle">
      <p className="eyebrow">Your versions</p>
      <h2 id="cmptitle">Compare versions</h2>
      <p className="muted small">
        One version laid over another, the way a cutter overlays two patterns. Dashed: version {from}
        {dateOf(from) ? ` (${dateOf(from)})` : ''}. Solid: version {to}
        {dateOf(to) ? ` (${dateOf(to)})` : ''}.
      </p>
      <div className="row wrap">
        <span className="small">From</span>
        {picker('Compare from version', from, setFrom)}
        <span className="small">to</span>
        {picker('Compare to version', to, setTo)}
      </div>
      {a && b ? <BeforeAfter before={a} after={b} changes={changes} /> : <p className="msg error">One of these versions can't be drafted for these measurements.</p>}
      {from === to ? <p className="muted small">Pick two different versions.</p> : <ChangeList changes={changes} />}
    </section>
  );
}

/** Every changed edge, piece by piece, in words. */
function ChangeList({ changes }: { changes: PieceChange[] }) {
  const shown = changes.filter((c) => c.status !== 'same');
  if (!shown.length) return null;
  return (
    <ul className="fitlist changes">
      {shown.map((c) => (
        <li key={c.name}>
          <strong>{c.name}</strong>
          {c.status === 'added' ? ': a new piece' : c.status === 'removed' ? ': no longer cut' : `: ${c.edges.map(changeWords).join('; ')}`}
        </li>
      ))}
    </ul>
  );
}

function IssueRow({ issue, f, onChange, from }: { issue: FitIssue; f: Fitting; onChange: (f: Fitting) => void; from?: string }) {
  const v = f.issues[issue.id];
  const on = v !== undefined;
  const side: Side = f.sides?.[issue.id] ?? 'right';
  const unit = issue.unit === 'cm' ? 'cm' : '°';
  return (
    <div className={on ? 'issue on' : 'issue'}>
      <label className="check">
        <input type="checkbox" checked={on} onChange={() => onChange(toggleIssue(f, issue.id))} />
        <span>
          <strong>{issue.title}</strong>
          <span className="muted small"> {issue.detail}</span>
          {from && on && <span className="tag carried"> From your {from} toile</span>}
        </span>
      </label>
      {on && (
        <div className="issue-fix">
          <div className="row wrap">
            <div className="stepper" role="group" aria-label={`How much: ${issue.title}`}>
              <button type="button" aria-label="Less" onClick={() => onChange(setAmount(f, issue.id, v - issue.step))} disabled={v <= issue.step}>
                −
              </button>
              <span aria-live="polite">
                {v} {unit}
              </span>
              <button type="button" aria-label="More" onClick={() => onChange(setAmount(f, issue.id, v + issue.step))} disabled={v >= issue.max}>
                +
              </button>
            </div>
            {issue.sided && (
              <div className="seg" role="group" aria-label="Which side">
                {(['left', 'right'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={side === s ? 'on' : ''}
                    aria-pressed={side === s}
                    onClick={() => onChange({ ...f, sides: { ...f.sides, [issue.id]: s } })}
                  >
                    {s === 'left' ? 'Left' : 'Right'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="muted small">
            {issue.fix}
            {issue.sided ? ' Your left and right, as you wear it.' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

/** The edges to write a label on, leaving out one that would sit on top of a label already placed (the list below has them all). */
function marks(edges: PieceChange['edges'], fs: number) {
  const placed: PieceChange['edges'] = [];
  for (const e of [...edges].sort((a, b) => Math.max(Math.abs(b.lengthMm), b.movedMm) - Math.max(Math.abs(a.lengthMm), a.movedMm)))
    if (!placed.some((q) => Math.abs(q.at.y - e.at.y) < fs * 1.3 && Math.abs(q.at.x - e.at.x) < fs * 4.5)) placed.push(e);
  return placed;
}

/** The pattern's pieces side by side: the pattern now in a fine dash, corrected in a solid line. */
function BeforeAfter({ before, after, changes = [] }: { before: Piece[]; after: Piece[]; changes?: PieceChange[] }) {
  const shapes = after.map((pc, i) => ({
    now: before[i]?.outline.points() ?? [],
    next: pc.outline.points(),
    alt: pc.alternate?.outline.points(),
  }));
  const all = shapes.map((s) => [...s.now, ...s.next, ...(s.alt ?? [])]);
  const boxes = all.map((ps) => ({
    x0: Math.min(...ps.map((q) => q.x)),
    x1: Math.max(...ps.map((q) => q.x)),
    y0: Math.min(...ps.map((q) => q.y)),
    y1: Math.max(...ps.map((q) => q.y)),
  }));
  const gap = 4;
  let x = 0;
  const offsets = boxes.map((b) => {
    const at = x - b.x0;
    x += b.x1 - b.x0 + gap;
    return at;
  });
  const y0 = Math.min(...boxes.map((b) => b.y0));
  const y1 = Math.max(...boxes.map((b) => b.y1));
  const fs = Math.max(1.2, (x - gap) / 34);
  const pts = (ps: P[], dx: number) => ps.map((q) => `${(q.x + dx).toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`-1 ${(y0 - 1).toFixed(2)} ${(x - gap + 2).toFixed(2)} ${(y1 - y0 + 2).toFixed(2)}`} className="preview-svg fitprev" role="img" aria-label="The pattern before and after the corrections">
      {shapes.map((s, i) => (
        <g key={i}>
          <polygon points={pts(s.now, offsets[i])} className="fit-now" />
          {s.alt && <polygon points={pts(s.alt, offsets[i])} className="fit-alt" />}
          <polygon points={pts(s.next, offsets[i])} className="fit-next" />
          {marks(changes.find((c) => c.name === after[i].name)?.edges ?? [], fs).map((e) => (
              <g key={`${e.tag}${e.nth}`} className="fit-mark">
                <circle cx={e.at.x + offsets[i]} cy={e.at.y} r={fs * 0.22} />
                <text x={e.at.x + offsets[i] + fs * 0.4} y={e.at.y - fs * 0.3} fontSize={fs}>
                  {changeLabel(e)}
                </text>
              </g>
            ))}
        </g>
      ))}
    </svg>
  );
}
