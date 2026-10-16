import type { Flat } from '../engine/flat';

const d = (pts: { x: number; y: number }[], close = false) =>
  pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('') + (close ? 'Z' : '');

/** The technical flat: front and back side by side, drawn to scale in fine lines. */
export function TechFlatView({ flat, title }: { flat: Flat; title: string }) {
  const pad = 4;
  const size = Math.max(1.8, flat.width / 45);
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${flat.width + 2 * pad} ${flat.height + 2 * pad + size * 2}`}
      className="techflat"
      role="img"
      aria-label={`Technical flat of the ${title}, front and back`}
    >
      {flat.views.map((v) => (
        <g key={v.label}>
          {v.shapes.map((s, i) => (
            <path key={i} d={d(s, true)} className="flat-shape" />
          ))}
          {v.lines.map((l, i) => (
            <path key={i} d={d(l.pts)} className={`flat-${l.kind}`} />
          ))}
          <text x={(Math.min(...v.shapes[0].map((q) => q.x)) + Math.max(...v.shapes[0].map((q) => q.x))) / 2} y={v.at.y + size * 1.9} fontSize={size} textAnchor="middle" className="flat-label">
            {v.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
