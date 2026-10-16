import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { P } from '../engine/geometry';
import { DraftStep, Sheet } from '../engine/export';

const STEPS: DraftStep[] = ['outline', 'darts', 'grain', 'allowance', 'labels'];
const STEP_MS = 1100;

function caption(step: DraftStep, name: string, sheet: Sheet, piece: number): string {
  const has = (text: string) => sheet.prims.some((pr) => pr.piece === piece && pr.kind === 'text' && pr.text === text);
  return {
    outline: `Drafting the ${name.toLowerCase().replace('skirt ', '')}`,
    darts: 'Taking in darts',
    grain: has('PLACE ON FOLD') ? 'Grain and fold' : 'Marking the grain',
    allowance: 'Adding seam allowance',
    labels: 'Notches and labels',
  }[step];
}

/** The order the pattern is drawn in: each piece step by step, skipping steps a piece doesn't have. */
function timeline(sheet: Sheet) {
  const pieces = [...new Set(sheet.prims.map((pr) => pr.piece).filter((v): v is number => v !== undefined))];
  const out: { piece: number; step: DraftStep }[] = [];
  for (const piece of pieces) {
    for (const step of STEPS) if (sheet.prims.some((pr) => pr.piece === piece && pr.step === step)) out.push({ piece, step });
  }
  return out;
}

/**
 * The real pattern pieces, drawn from the same sheet the PDF is printed from. Each time `play` changes
 * (from 0), the pattern draws itself step by step, the way it is drafted, with a caption for each step.
 */
export function PatternPreview({ sheet, label, play = 0, names = [] }: { sheet: Sheet; label: string; play?: number; names?: string[] }) {
  const pts = (ps: P[]) => ps.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  const steps = useMemo(() => timeline(sheet), [sheet]);
  const [now, setNow] = useState<number>();

  useEffect(() => {
    if (!play || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setNow(0);
    const timers = steps.map((_, i) => setTimeout(() => setNow(i), i * STEP_MS));
    timers.push(setTimeout(() => setNow(steps.length), steps.length * STEP_MS));
    timers.push(setTimeout(() => setNow(undefined), steps.length * STEP_MS + 1600));
    return () => timers.forEach(clearTimeout);
  }, [play, steps]);

  const playing = now !== undefined;
  const at = (pr: Sheet['prims'][number]) => steps.findIndex((s) => s.piece === pr.piece && s.step === pr.step);
  const anim = (pr: Sheet['prims'][number]): { className?: string; style?: CSSProperties } => {
    if (!playing) return {};
    const k = at(pr);
    if (k < 0) return {};
    return { className: pr.kind === 'poly' && pr.style !== 'stitch' ? 'drawn' : 'faded', style: { animationDelay: `${k * STEP_MS}ms` } };
  };
  const current = now !== undefined && now < steps.length ? steps[now] : undefined;

  return (
    <>
      <svg key={playing ? `play-${play}` : 'still'} viewBox={`0 0 ${sheet.width} ${sheet.height}`} role="img" aria-label={label} className="preview-svg">
        {sheet.prims.map((pr, i) => {
          const a = anim(pr);
          if (pr.kind === 'poly') {
            const Tag = pr.closed ? 'polygon' : 'polyline';
            const stroke = pr.style === 'stitch' ? 'var(--muted)' : 'var(--ink)';
            const width = pr.style === 'cut' ? 0.12 : 0.07;
            return (
              <Tag
                key={i}
                points={pts(pr.pts)}
                className={a.className}
                pathLength={a.className === 'drawn' ? 1 : undefined}
                style={{ fill: pr.style === 'cut' && !playing ? 'var(--paper)' : 'none', stroke, ...a.style }}
                strokeWidth={width}
                strokeDasharray={pr.style === 'stitch' ? '0.5 0.3' : undefined}
                strokeLinejoin="round"
              />
            );
          }
          return (
            <text
              key={i}
              x={pr.at.x}
              y={pr.at.y}
              fontSize={pr.size}
              textAnchor={pr.anchor}
              className={a.className}
              style={{ fontFamily: 'var(--mono)', fill: 'var(--ink)', ...a.style }}
              transform={pr.rotate ? `rotate(${pr.rotate} ${pr.at.x} ${pr.at.y})` : undefined}
            >
              {pr.text}
            </text>
          );
        })}
      </svg>
      {playing && (
        <p className="draft-caption" role="status">
          {current ? (
            <>
              <span className="muted">
                {String((now ?? 0) + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
              </span>{' '}
              {caption(current.step, names[current.piece] ?? 'piece', sheet, current.piece)}
            </>
          ) : (
            'Drafted to fit you'
          )}
        </p>
      )}
    </>
  );
}
