import { useId } from 'react';
import type { Lay } from '../engine/layplan';
import { tileUrl } from './FabricFill';

/** One fabric tile, in cm, as on the style sketch. */
const TILE = 16;

/**
 * A cutting layout: the fabric drawn lengthwise, the fold (or a selvedge) along the top, each piece's
 * cutting line where it is cut. In cm, scaled to fit. The fabric is drawn in the maker's cloth with its
 * grain running along the length, and the pieces lie on it as pattern paper (Cat's P4 Paper on Fabric).
 */
export function LayPlanView({ lay, cloth = 'default' }: { lay: Lay; cloth?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const L = lay.length + 4;
  const H = lay.across;
  const pts = (ps: { x: number; y: number }[]) => ps.map((q) => `${(q.y + 2).toFixed(2)},${q.x.toFixed(2)}`).join(' ');
  const size = Math.max(1.6, Math.min(2.4, L / 60));
  return (
    <svg viewBox={`0 ${-size * 2.2} ${L} ${H + size * 4.4}`} className="layplan" role="img" aria-label={`Cutting layout on ${lay.width} cm fabric, ${lay.metres.toFixed(1)} metres`}>
      <defs>
        <pattern id={`cloth${uid}`} patternUnits="userSpaceOnUse" width={TILE} height={TILE} patternTransform="rotate(90)">
          <image href={tileUrl(cloth)} width={TILE} height={TILE} preserveAspectRatio="none" />
        </pattern>
        <pattern id={`dots${uid}`} patternUnits="userSpaceOnUse" width={2} height={2}>
          <circle cx={1} cy={1} r={0.12} className="lay-dot" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={L} height={H} className="lay-fabric" fill={`url(#cloth${uid})`} />
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
          <polygon points={pts(pl.pts)} className="lay-paper-dots" fill={`url(#dots${uid})`} />
          <text x={pl.at.y + 2} y={pl.at.x} fontSize={size * 0.8} textAnchor="middle" className="lay-name">
            {pl.name.toUpperCase()}
          </text>
          {pl.single && (
            <text x={pl.at.y + 2} y={pl.at.x + size} fontSize={size * 0.65} textAnchor="middle" className="lay-name lay-sub">
              1 LAYER
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
