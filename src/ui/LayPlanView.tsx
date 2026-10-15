import type { Lay } from '../engine/layplan';

/**
 * A cutting layout: the fabric drawn lengthwise, the fold (or a selvedge) along the top, each piece's
 * cutting line where it is cut. In cm, scaled to fit.
 */
export function LayPlanView({ lay }: { lay: Lay }) {
  const L = lay.length + 4;
  const H = lay.across;
  const pts = (ps: { x: number; y: number }[]) => ps.map((q) => `${(q.y + 2).toFixed(2)},${q.x.toFixed(2)}`).join(' ');
  const size = Math.max(1.6, Math.min(2.4, L / 60));
  return (
    <svg viewBox={`0 ${-size * 2.2} ${L} ${H + size * 4.4}`} className="layplan" role="img" aria-label={`Cutting layout on ${lay.width} cm fabric, ${lay.metres.toFixed(1)} metres`}>
      <rect x={0} y={0} width={L} height={H} className="lay-fabric" />
      <line x1={0} y1={0} x2={L} y2={0} className={lay.folded ? 'lay-fold' : 'lay-edge'} />
      <text x={0} y={-size * 0.7} fontSize={size} className="lay-note">
        {lay.folded ? 'FOLD' : 'SELVEDGE'}
      </text>
      <text x={0} y={H + size * 1.6} fontSize={size} className="lay-note">
        {lay.folded ? 'SELVEDGES' : 'SELVEDGE'}
      </text>
      <text x={L} y={H + size * 1.6} fontSize={size} textAnchor="end" className="lay-note">
        {`${lay.metres.toFixed(1)} M  ·  ${lay.width} CM WIDE`}
      </text>
      {lay.placements.map((pl, i) => (
        <g key={i}>
          <polygon points={pts(pl.pts)} className="lay-piece" />
          <text x={pl.at.y + 2} y={pl.at.x} fontSize={size * 0.8} textAnchor="middle" className="lay-name">
            {pl.name.toUpperCase()}
          </text>
          {pl.single && (
            <text x={pl.at.y + 2} y={pl.at.x + size} fontSize={size * 0.65} textAnchor="middle" className="lay-note">
              1 LAYER
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
