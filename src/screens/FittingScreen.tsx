import { useMemo, useState } from 'react';
import type { P } from '../engine/geometry';
import type { Piece } from '../engine/piece';
import type { Side } from '../engine/skirt';
import { FIT_ISSUES, FitGarment, FitIssue, Fitting, NO_FITTING, describeFitting, setAmount, toggleIssue } from '../engine/fitting';

interface Props {
  /** A dress is fitted as one toile, with the bodice's and the skirt's corrections together. */
  garment: FitGarment | 'dress';
  fitting?: Fitting;
  /** The pattern's own pieces drafted with a set of corrections, for the before and after drawing. */
  draftWith: (f: Fitting) => Piece[] | undefined;
  /** The bodice has a bust dart (some corrections go into it). */
  hasBustDart: boolean;
  onSave: (f: Fitting) => void;
  onCancel: () => void;
}

/**
 * After the toile: the person ticks what they see when they try it on, and each correction goes into
 * the pattern the way a pattern cutter would make it. The drawing shows the pattern before and after.
 */
export function FittingScreen({ garment, fitting, draftWith, hasBustDart, onSave, onCancel }: Props) {
  const saved = fitting ?? NO_FITTING;
  const [f, setF] = useState<Fitting>(saved);
  const issues = FIT_ISSUES.filter((i) => (garment === 'dress' || i.garment === garment) && (hasBustDart || !i.needsBustDart));
  const areaOf = (i: FitIssue) => (garment === 'dress' ? `${i.garment === 'skirt' ? 'Skirt' : 'Bodice'}: ${i.area.toLowerCase()}` : i.area);
  const areas = [...new Set(issues.map(areaOf))];
  const before = useMemo(() => draftWith(saved), [draftWith, saved]);
  const after = useMemo(() => draftWith(f), [draftWith, f]);
  const changed = JSON.stringify(f.issues) !== JSON.stringify(saved.issues) || JSON.stringify(f.sides ?? {}) !== JSON.stringify(saved.sides ?? {});
  const version = saved.round + 1;
  const list = describeFitting(f, garment);

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
                <IssueRow key={i.id} issue={i} f={f} onChange={setF} />
              ))}
          </fieldset>
        ))}
      </section>

      <section className="card help fitside" aria-labelledby="fitprev">
        <h2 id="fitprev">The correction</h2>
        {before && after ? (
          <BeforeAfter before={before} after={after} />
        ) : (
          <p className="msg error">These corrections can't be drafted for these measurements. Try a smaller amount.</p>
        )}
        <p className="muted small">Fine dashed line: the pattern now. Solid line: corrected. A second line is cut for one side only.</p>
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
          onClick={() => onSave({ ...f, round: saved.round + 1, date: new Date().toISOString().slice(0, 10) })}
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
    </div>
  );
}

function IssueRow({ issue, f, onChange }: { issue: FitIssue; f: Fitting; onChange: (f: Fitting) => void }) {
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

/** The pattern's pieces side by side: the pattern now in a fine dash, corrected in a solid line. */
function BeforeAfter({ before, after }: { before: Piece[]; after: Piece[] }) {
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
  const pts = (ps: P[], dx: number) => ps.map((q) => `${(q.x + dx).toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`-1 ${(y0 - 1).toFixed(2)} ${(x - gap + 2).toFixed(2)} ${(y1 - y0 + 2).toFixed(2)}`} className="preview-svg fitprev" role="img" aria-label="The pattern before and after the corrections">
      {shapes.map((s, i) => (
        <g key={i}>
          <polygon points={pts(s.now, offsets[i])} className="fit-now" />
          {s.alt && <polygon points={pts(s.alt, offsets[i])} className="fit-alt" />}
          <polygon points={pts(s.next, offsets[i])} className="fit-next" />
        </g>
      ))}
    </svg>
  );
}
