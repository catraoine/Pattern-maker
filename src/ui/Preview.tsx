import { useMemo } from 'react';
import { P } from '../engine/geometry';
import { Sheet } from '../engine/export';
import type { SkirtDraft } from '../engine/skirt';
import type { BodiceDraft } from '../engine/bodice';

/** The real pattern pieces, drawn from the same sheet the PDF is printed from. */
export function PatternPreview({ sheet, label }: { sheet: Sheet; label: string }) {
  const pts = (ps: P[]) => ps.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} role="img" aria-label={label} className="preview-svg">
      {sheet.prims.map((pr, i) => {
        if (pr.kind === 'poly') {
          const Tag = pr.closed ? 'polygon' : 'polyline';
          const stroke = pr.style === 'stitch' ? 'var(--muted)' : 'var(--ink)';
          const width = pr.style === 'cut' ? 0.12 : 0.07;
          return (
            <Tag
              key={i}
              points={pts(pr.pts)}
              style={{ fill: pr.style === 'cut' ? 'var(--paper)' : 'none', stroke }}
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
            style={{ fontFamily: 'var(--mono)', fill: 'var(--ink)' }}
            transform={pr.rotate ? `rotate(${pr.rotate} ${pr.at.x} ${pr.at.y})` : undefined}
          >
            {pr.text}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * The front half of the skirt as it looks worn, from centre waist round to centre hem. Block skirts hang
 * much like their flat front piece; circle skirts fall into folds, so they get a drawn bell shape.
 */
function wornFront(draft: SkirtDraft): { pts: P[]; sideWaist: P } {
  const front = draft.pieces[0];
  if (draft.circleShare) {
    const wh = draft.finishedWaist / 4;
    const L = draft.lengthCm;
    const hh = wh + L * (0.25 + 0.4 * draft.circleShare);
    const pts: P[] = [{ x: 0, y: 0 }, { x: wh, y: 0 }];
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      pts.push({ x: wh + (hh - wh) * t ** 1.6, y: L * t });
    }
    // Soft folds along the hem.
    const folds = 2 + Math.round(2 * draft.circleShare);
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      pts.push({ x: hh * (1 - t), y: L + 1.6 * Math.sin(t * folds * Math.PI) ** 2 - 0.8 });
    }
    return { pts, sideWaist: { x: wh, y: 0 } };
  }
  const { pts, tags } = front.outline.taggedPoints(16);
  // Leave off the closing run up the centre front, which would show as a line down the middle.
  return { pts: pts.slice(0, -1), sideWaist: pts[tags.lastIndexOf('waist') + 1] };
}

/** A front-view sketch made by mirroring the front about the centre front. */
export function SketchPreview({ draft, label }: { draft: SkirtDraft; label: string }) {
  const d = useMemo(() => {
    const { pts: half, sideWaist } = wornFront(draft);
    const xs = half.map((q) => q.x);
    const ys = half.map((q) => q.y);
    const w = Math.max(...xs);
    const minY = Math.min(...ys);
    const right = half.map((q) => ({ x: w + 6 + q.x, y: q.y - minY + 6 }));
    const left = half.map((q) => ({ x: w + 6 - q.x, y: q.y - minY + 6 })).reverse();
    const all = [...right, ...left];
    return {
      path: all.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ') + ' Z',
      w: 2 * w + 12,
      h: Math.max(...ys) - minY + 12,
      band: { x: w + 6 - sideWaist.x, y: sideWaist.y - minY + 6 - 3, width: 2 * sideWaist.x },
    };
  }, [draft]);
  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-label={label} className="preview-svg sketch">
      <path d={d.path} style={{ fill: 'var(--fill)', stroke: 'var(--ink)' }} strokeWidth={0.25} strokeLinejoin="round" />
      <rect x={d.band.x} y={d.band.y} width={d.band.width} height={3.5} style={{ fill: 'var(--paper)', stroke: 'var(--ink)' }} strokeWidth={0.25} />
    </svg>
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
