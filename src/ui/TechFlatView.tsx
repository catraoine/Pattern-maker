import { useId } from 'react';
import type { Flat } from '../engine/flat';
import { SHADE_STOPS } from './FormSketch';
import { ClothDefs, ClothOverlay, SHEER_OPACITY, borderHems, useFabricLook } from './ClothLook';

/** A contrast collar cut in black or ivory. */
const SECOND_FILL = { black: '#1F1E22', ivory: '#EFE8D6' };

const d = (pts: { x: number; y: number }[], close = false) =>
  pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('') + (close ? 'Z' : '');

/** The technical flat: front and back side by side, drawn to scale in fine lines, in the fabric and under the
 *  same light as the garment on the form, so the two drawings read as one piece. */
export function TechFlatView({ flat, title }: { flat: Flat; title: string }) {
  const pad = 4;
  const size = Math.max(1.8, flat.width / 45);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const look = useFabricLook();
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${flat.width + 2 * pad} ${flat.height + 2 * pad + size * 2}`}
      className="techflat"
      role="img"
      aria-label={`Technical flat of the ${title}, front and back`}
    >
      {flat.views.map((v, k) => {
        const xs = v.shapes.flat().map((q) => q.x);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const shade = `flatshade${uid}${k}`;
        const hems = look?.border ? borderHems(v.shapes) : [];
        return (
          <g key={v.label}>
            <ClothDefs uid={`${uid}${k}`} x1={left + (right - left) * 0.1} x2={right - (right - left) * 0.1} look={look} />
            <defs>
              <linearGradient id={shade} gradientUnits="userSpaceOnUse" x1={(left + (right - left) * 0.1).toFixed(2)} x2={(right - (right - left) * 0.1).toFixed(2)} y1="0" y2="0">
                {SHADE_STOPS.map(([offset, color, opacity]) => (
                  <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
                ))}
              </linearGradient>
            </defs>
            {v.shapes.map((s, i) => {
              // A shape cut from the second fabric: black or ivory in its own colour, or the garment's fabric
              // in a deeper shade.
              const second = v.contrast?.includes(i) ? flat.second : undefined;
              const own = second === 'black' || second === 'ivory';
              return (
                <g key={i}>
                  <path d={d(s, true)} className="flat-shape" style={own ? { fill: SECOND_FILL[second] } : undefined} fillOpacity={look?.sheer && !own ? SHEER_OPACITY : undefined} />
                  {!own && <ClothOverlay d={d(s, true)} uid={`${uid}${k}`} k={`s${i}`} look={look} hemY={hems[i]} />}
                  {second === 'deep' && <path d={d(s, true)} style={{ fill: '#000', stroke: 'none' }} opacity={0.38} />}
                  <path d={d(s, true)} className="flat-shade" style={{ fill: `url(#${shade})` }} opacity={look?.sheer ? 0.6 : undefined} />
                </g>
              );
            })}
            {v.lines.map((l, i) => (
              <path key={i} d={d(l.pts)} className={`flat-${l.kind}`} />
            ))}
            <text x={(left + right) / 2} y={v.at.y + size * 1.9} fontSize={size} textAnchor="middle" className="flat-label">
              {v.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
