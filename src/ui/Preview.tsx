import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
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

/** The point a fraction f of the way along a polyline. */
function along(pts: P[], f: number): P {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
  let left = f * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, left / lens[i]) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    left -= lens[i];
  }
  return pts[0];
}

/** A drafting pencil, its point at the origin, leaning back like a hand holding it. */
function Pencil({ at, size }: { at: P; size: number }) {
  const w = 0.11;
  return (
    <g className="pencil" transform={`translate(${at.x} ${at.y}) rotate(-35) scale(${size})`} aria-hidden="true">
      <polygon points="0,0 -0.045,-0.16 0.045,-0.16" className="pencil-lead" />
      <polygon points="-0.045,-0.16 0.045,-0.16 0.055,-0.22 -0.055,-0.22" className="pencil-wood" />
      <rect x={-w / 2} y={-1} width={w} height={0.78} className="pencil-body" />
    </g>
  );
}

/**
 * The real pattern pieces, drawn from the same sheet the PDF is printed from. Each time `play` changes
 * (from 0), the pattern draws itself step by step, the way it is drafted, with a caption for each step.
 */
export function PatternPreview({ sheet, label, play = 0, names = [], paper = false }: { sheet: Sheet; label: string; play?: number; names?: string[]; paper?: boolean }) {
  const pts = (ps: P[]) => ps.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  const steps = useMemo(() => timeline(sheet), [sheet]);
  const [now, setNow] = useState<number>();
  // While it drafts, a pencil follows the longest line of each step.
  const routes = useMemo(
    () =>
      steps.map(({ piece, step }) => {
        const lines = sheet.prims.filter((pr) => pr.kind === 'poly' && pr.piece === piece && pr.step === step);
        const pick = lines.map((pr) => (pr.kind === 'poly' ? (pr.closed ? [...pr.pts, pr.pts[0]] : pr.pts) : [])).sort((a, b) => b.length - a.length)[0];
        return pick && pick.length > 1 ? pick : undefined;
      }),
    [sheet, steps],
  );
  const [tip, setTip] = useState<P>();
  const frame = useRef<number>();

  useEffect(() => {
    if (!play || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setNow(0);
    const timers = steps.map((_, i) => setTimeout(() => setNow(i), i * STEP_MS));
    timers.push(setTimeout(() => setNow(steps.length), steps.length * STEP_MS));
    timers.push(setTimeout(() => setNow(undefined), steps.length * STEP_MS + 1600));
    const start = performance.now();
    let last: P | undefined;
    const tick = (t: number) => {
      const elapsed = t - start;
      const k = Math.floor(elapsed / STEP_MS);
      if (k >= steps.length) {
        setTip(undefined);
        return;
      }
      const route = routes[k];
      if (route) {
        const f = Math.min(1, Math.max(0, (elapsed - k * STEP_MS) / 1000));
        last = along(route, f * f * (3 - 2 * f));
      }
      setTip(last);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      timers.forEach(clearTimeout);
      if (frame.current) cancelAnimationFrame(frame.current);
      setTip(undefined);
    };
  }, [play, steps, routes]);

  const playing = now !== undefined;
  const at = (pr: Sheet['prims'][number]) => steps.findIndex((s) => s.piece === pr.piece && s.step === pr.step);
  const anim = (pr: Sheet['prims'][number]): { className?: string; style?: CSSProperties } => {
    if (!playing) return {};
    const k = at(pr);
    if (k < 0) return {};
    return { className: pr.kind === 'poly' && pr.style !== 'stitch' ? 'drawn' : 'faded', style: { animationDelay: `${k * STEP_MS}ms` } };
  };
  const current = now !== undefined && now < steps.length ? steps[now] : undefined;

  const drawing = (
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
        {playing && tip && <Pencil at={tip} size={Math.max(sheet.width, sheet.height) / 9} />}
      </svg>
  );

  return (
    <>
      {paper ? <div className="paper-sheet">{drawing}</div> : drawing}
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
