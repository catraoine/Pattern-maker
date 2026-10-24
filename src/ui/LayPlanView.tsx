import { useId } from 'react';
import type { Lay } from '../engine/layplan';
import { PrintKind, printImage, printTileCm } from '../engine/prints';
import { tileUrl } from './FabricFill';

/** One fabric tile, in cm, as on the style sketch. */
const TILE = 16;

/**
 * A cutting layout: the fabric drawn lengthwise, the fold (or a selvedge) along the top, each piece's
 * cutting line where it is cut. In cm, scaled to fit. The fabric is drawn in the maker's cloth with its
 * grain running along the length, and the pieces lie on it as pattern paper (Cat's P4 Paper on Fabric).
 * With a print chosen, the print is drawn instead, at its own scale (Cat's P4 Place the Motifs): big
 * motifs are lined up so one sits in the middle of the front, and a border runs along the selvedge.
 */
export function LayPlanView({ lay, cloth = 'default', print }: { lay: Lay; cloth?: string; print?: { kind: PrintKind; repeat?: number; stripes?: boolean; gingham?: boolean } }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const L = lay.length + 4;
  const H = lay.across;
  const pts = (ps: { x: number; y: number }[]) => ps.map((q) => `${(q.y + 2).toFixed(2)},${q.x.toFixed(2)}`).join(' ');
  const size = Math.max(1.6, Math.min(2.4, L / 60));
  const shown = print && print.kind !== 'plain' ? print : undefined;
  const printTile = shown ? printTileCm(shown.kind, shown.repeat, shown.stripes) : TILE;
  // A motif in the middle of the front: the first front piece cut, else the first piece.
  const front = lay.placements.find((pl) => /front/i.test(pl.name)) ?? lay.placements[0];
  const centre = shown?.kind === 'motif' && front ? { x: front.at.y + 2, y: front.at.x } : undefined;
  const borderDepth = printTile * 0.42;
  return (
    <svg viewBox={`0 ${-size * 2.2} ${L} ${H + size * 4.4}`} className={shown ? 'layplan lay-printed' : 'layplan'} role="img" aria-label={`Cutting layout on ${lay.width} cm fabric, ${lay.metres.toFixed(1)} metres`}>
      <defs>
        <pattern id={`cloth${uid}`} patternUnits="userSpaceOnUse" width={TILE} height={TILE} patternTransform="rotate(90)">
          <image href={tileUrl(cloth)} width={TILE} height={TILE} preserveAspectRatio="none" />
        </pattern>
        {shown && (
          <pattern
            id={`print${uid}`}
            patternUnits="userSpaceOnUse"
            x={centre ? -printTile / 2 : 0}
            y={shown.kind === 'border' ? H - printTile : centre ? -printTile / 2 : 0}
            width={printTile}
            height={printTile}
            patternTransform={shown.kind === 'border' ? undefined : centre ? `translate(${centre.x} ${centre.y}) rotate(90)` : 'rotate(90)'}
          >
            <image href={printImage(shown.kind, import.meta.env.BASE_URL, shown.stripes, shown.gingham)} width={printTile} height={printTile} preserveAspectRatio="none" />
          </pattern>
        )}
        <pattern id={`dots${uid}`} patternUnits="userSpaceOnUse" width={2} height={2}>
          <circle cx={1} cy={1} r={0.12} className="lay-dot" />
        </pattern>
      </defs>
      {shown?.kind === 'border' ? (
        <>
          <rect x={0} y={0} width={L} height={H} className="lay-fabric lay-border-ground" />
          <rect x={0} y={H - borderDepth} width={L} height={borderDepth} fill={`url(#print${uid})`} />
        </>
      ) : (
        <rect x={0} y={0} width={L} height={H} className="lay-fabric" fill={shown ? `url(#print${uid})` : `url(#cloth${uid})`} />
      )}
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
