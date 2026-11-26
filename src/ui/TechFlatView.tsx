import { CSSProperties, useId } from 'react';
import type { Flat } from '../engine/flat';
import { SHADE_STOPS } from './FormSketch';
import { ClothDefs, ClothOverlay, throughOpacity, borderHems, useFabricLook } from './ClothLook';
import { useEnlarged } from './EnlargeSketch';
import { useMedia } from './StyleLayout';

const d = (pts: { x: number; y: number }[], close = false) =>
  pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('') + (close ? 'Z' : '');

/** The technical flat: front and back side by side, drawn to scale in fine lines, in the fabric and under the
 *  same light as the garment on the form, so the two drawings read as one piece. */
export function TechFlatView({ flat, title, labelCm, style, part }: { flat: Flat; title: string; labelCm?: number; style?: CSSProperties; part?: boolean }) {
  const pad = 4;
  // (The label's size in cm: given, when several drawings are shown at one scale, so their labels match.)
  const size = labelCm ?? Math.max(1.8, flat.width / 45);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const look = useFabricLook();
  // Enlarged on a tall phone, front and back side by side filled only a third of the window (Cat's phone, Nov 23), so
  // there the back goes under the front, each drawn bigger.
  const big = useEnlarged();
  // (Watched, so turning the phone while it is enlarged lays the two views out again.)
  const tall = useMedia('(max-aspect-ratio: 3/4)');
  const spans = flat.views.map((v) => {
    const xs = v.shapes.flat().map((q) => q.x);
    return [Math.min(...xs), Math.max(...xs)];
  });
  // A label's height more between the rows, so FRONT reads with the drawing above it, not the back below (cold read EF).
  const rowH = flat.height + size * 3 + pad;
  const stackW = flat.views.length === 2 ? Math.max(spans[0][1], spans[0][0] + spans[1][1] - spans[1][0]) : flat.width;
  // Only when it draws them bigger: a wide garment (the peplum top, sleeves out) stacked into a narrow column, no larger
  // than side by side and with black either side (pretend tester EE walk, Nov 24).
  const aspect = typeof window !== 'undefined' && window.innerHeight ? window.innerWidth / window.innerHeight : 1;
  const scaleOf = (w: number, h: number) => Math.min(aspect / (w + 2 * pad), 1 / (h + 2 * pad));
  const stack = big && tall && flat.views.length === 2 && scaleOf(stackW, flat.height + size * 2 + rowH) > 1.2 * scaleOf(flat.width, flat.height + size * 2);
  const shift = (k: number) => (stack && k === 1 ? `translate(${(spans[0][0] - spans[1][0]).toFixed(2)} ${rowH.toFixed(2)})` : undefined);
  const width = stack ? stackW : flat.width;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${flat.height + 2 * pad + size * 2 + (stack ? rowH : 0)}`}
      className="techflat"
      style={style}
      // (One view of several, drawn apart: the group they are in carries the name.)
      aria-hidden={part || undefined}
      role={part ? undefined : 'img'}
      aria-label={part ? undefined : `Technical flat of the ${title}, front and back`}
    >
      {flat.views.map((v, k) => {
        const xs = v.shapes.flat().map((q) => q.x);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const shade = `flatshade${uid}${k}`;
        const hems = look?.border ? borderHems(v.shapes) : [];
        return (
          <g key={v.label} transform={shift(k)}>
            <ClothDefs uid={`${uid}${k}`} x1={left + (right - left) * 0.1} x2={right - (right - left) * 0.1} look={look} flat />
            <defs>
              <linearGradient id={shade} gradientUnits="userSpaceOnUse" x1={(left + (right - left) * 0.1).toFixed(2)} x2={(right - (right - left) * 0.1).toFixed(2)} y1="0" y2="0">
                {SHADE_STOPS.map(([offset, color, opacity]) => (
                  <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
                ))}
              </linearGradient>
            </defs>
            {v.shapes.map((s, i) => (
              <g key={i}>
                <path d={d(s, true)} className="flat-shape" fillOpacity={throughOpacity(look)} />
                <ClothOverlay d={d(s, true)} uid={`${uid}${k}`} k={`s${i}`} look={look} hemY={hems[i]} />
                <path d={d(s, true)} className="flat-shade" style={{ fill: `url(#${shade})` }} opacity={look?.faint ? 0.9 : look?.sheer ? 0.6 : undefined} />
              </g>
            ))}
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
