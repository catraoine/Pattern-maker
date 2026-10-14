import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { P } from '../engine/geometry';
import { DraftStep, Sheet } from '../engine/export';
import type { BodiceDraft } from '../engine/bodice';

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

/**
 * The bodice front as worn: the neckline, shoulder and armhole from the front piece, mirrored about the
 * centre front, with the darts closed so the waist and hem sit level. Darts show as their stitching lines.
 */
export function BodiceSketch({ draft, label }: { draft: BodiceDraft; label: string }) {
  const d = useMemo(() => {
    const front = draft.pieces[0];
    const { pts, tags } = front.outline.taggedPoints(16);
    const lastArm = tags.lastIndexOf('armhole');
    const top = pts.slice(0, lastArm + 2); // centre front neck round to the underarm
    const { waistSide, waistCentre, hemSide, hemCentre } = draft.front;
    const waist = { x: waistSide.x, y: waistCentre.y };
    const hem = { x: hemSide.x, y: hemCentre.y };
    const below = hemCentre.y - waistCentre.y > 0.5;
    const xs = [...top, waist, hem].map((q) => q.x);
    const ys = [...top, hem].map((q) => q.y);
    const w = Math.max(...xs);
    const minY = Math.min(...ys);
    const at = (q: P, side: 1 | -1) => ({ x: w + 6 + side * q.x, y: q.y - minY + 6 });
    const f = (q: { x: number; y: number }) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
    const half = (side: 1 | -1) => {
      let s = top.map((q, i) => `${i ? 'L' : 'M'}${f(at(q, side))}`).join(' ') + ` L${f(at(waist, side))}`;
      if (below) {
        const dy = hem.y - waist.y;
        s += ` C${f(at({ x: waist.x + (hem.x - waist.x) * 0.5, y: waist.y + dy * 0.3 }, side))} ${f(at({ x: hem.x, y: hem.y - dy * 0.4 }, side))} ${f(at(hem, side))}`;
      }
      return s + ` L${f(at(hemCentre, side))}`;
    };
    // Each dart as its fold line: tip to the middle of its mouth, or point to point for a fish-eye dart.
    const darts = front.lines
      .filter((ln) => ln.segs.length === 2 || ln.segs.length === 4)
      .flatMap((ln) => {
        const q = ln.points();
        const [a, b] = ln.segs.length === 4 ? [q[0], q[2]] : [q[1], { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 }];
        // Waist darts end on the level waist; a bust dart ends on the straight side seam drawn here.
        const under = top[top.length - 1];
        const sideX = (y: number) => under.x + ((waist.x - under.x) * (y - under.y)) / (waist.y - under.y);
        const level = (r: P) =>
          ln.segs.length !== 2 ? r : r.y > waistCentre.y - 0.5 ? { x: r.x, y: waistCentre.y } : { x: Math.min(r.x, sideX(r.y)), y: r.y };
        return ([1, -1] as const).map((side) => `M${f(at(a, side))} L${f(at(level(b), side))}`);
      })
      .join(' ');
    return { right: half(1), left: half(-1), darts, w: 2 * w + 12, h: Math.max(...ys) - minY + 12 };
  }, [draft]);
  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-label={label} className="preview-svg sketch">
      <path d={`${d.right} ${d.left.replace(/^M/, 'L')}`} style={{ fill: 'var(--fill)', stroke: 'none' }} />
      <path d={d.right} style={{ fill: 'none', stroke: 'var(--ink)' }} strokeWidth={0.25} strokeLinejoin="round" />
      <path d={d.left} style={{ fill: 'none', stroke: 'var(--ink)' }} strokeWidth={0.25} strokeLinejoin="round" />
      <path d={d.darts} style={{ fill: 'none', stroke: 'var(--muted)' }} strokeWidth={0.15} />
    </svg>
  );
}
