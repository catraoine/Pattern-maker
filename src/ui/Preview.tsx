import { useMemo } from 'react';
import { P } from '../engine/geometry';
import { Sheet } from '../engine/export';
import { Piece } from '../engine/piece';

/** The real pattern pieces, drawn from the same sheet the PDF is printed from. */
export function PatternPreview({ sheet, label }: { sheet: Sheet; label: string }) {
  const pts = (ps: P[]) => ps.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} role="img" aria-label={label} className="preview-svg">
      {sheet.prims.map((pr, i) => {
        if (pr.kind === 'poly') {
          const Tag = pr.closed ? 'polygon' : 'polyline';
          const stroke = pr.style === 'stitch' ? '#888' : '#111';
          const width = pr.style === 'cut' ? 0.12 : 0.07;
          return (
            <Tag
              key={i}
              points={pts(pr.pts)}
              fill={pr.style === 'cut' ? '#fff' : 'none'}
              stroke={stroke}
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
            fontFamily="Space Mono, monospace"
            transform={pr.rotate ? `rotate(${pr.rotate} ${pr.at.x} ${pr.at.y})` : undefined}
          >
            {pr.text}
          </text>
        );
      })}
    </svg>
  );
}

/** A front-view sketch made by mirroring the drafted front piece about the centre front. */
export function SketchPreview({ front, label }: { front: Piece; label: string }) {
  const d = useMemo(() => {
    const half = front.outline.points(16);
    const xs = half.map((q) => q.x);
    const ys = half.map((q) => q.y);
    const w = Math.max(...xs);
    const minY = Math.min(...ys);
    const right = half.map((q) => ({ x: w + 6 + q.x, y: q.y - minY + 6 }));
    const left = half.map((q) => ({ x: w + 6 - q.x, y: q.y - minY + 6 })).reverse();
    const all = [...right, ...left];
    // The first eight segments trace the waist from centre front to the side.
    const sideWaist = half[8];
    return {
      path: all.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ') + ' Z',
      w: 2 * w + 12,
      h: Math.max(...ys) - minY + 12,
      band: { x: w + 6 - sideWaist.x, y: sideWaist.y - minY + 6 - 3, width: 2 * sideWaist.x },
    };
  }, [front]);
  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} role="img" aria-label={label} className="preview-svg sketch">
      <path d={d.path} fill="#EDEDED" stroke="#111" strokeWidth={0.35} strokeLinejoin="round" />
      <rect x={d.band.x} y={d.band.y} width={d.band.width} height={3.5} fill="#111" />
    </svg>
  );
}
