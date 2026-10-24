// How the cloth looks beyond its colour: what the fabric fill alone cannot show. GarmentFabric works out the
// look from the maker's fabric and passes it down; the Form view and the Drawing view draw it over each piece.
// A sheer or lace is see-through, so the form shows through it. Leather and satin catch the light in a sheen,
// velvet sinks into shadow with a soft bloom, corduroy shows its ribs, denim its twill, sequins their discs and
// lace its net. A border print sits on the hem, where it is cut to lie, over plain cloth.
import { createContext, useContext } from 'react';
import type { Special } from '../engine/specialFabrics';

export interface FabricLook {
  special?: Special;
  /** The form shows through: a sheer or a lace. */
  sheer: boolean;
  /** A border print: the swatch drawn along the hem, its bottom on the hem line. */
  border?: { href: string; size: number; filter?: string };
}

export const FabricLookContext = createContext<FabricLook | undefined>(undefined);
export const useFabricLook = () => useContext(FabricLookContext);

/** How much of the cloth's colour a sheer piece shows. */
export const SHEER_OPACITY = 0.5;

const f = (n: number) => n.toFixed(2);

/** The defs one drawing needs for its cloth's look: lit from the left across x1 to x2, as the shade is. */
export function ClothDefs({ uid, x1, x2, look }: { uid: string; x1: number; x2: number; look: FabricLook | undefined }) {
  if (!look) return null;
  const s = look.special;
  return (
    <defs>
      {(s === 'leather' || s === 'satin' || s === 'velvet') && (
        <linearGradient id={`sheen${uid}`} gradientUnits="userSpaceOnUse" x1={f(x1)} x2={f(x2)} y1="0" y2="0">
          {s === 'velvet' ? (
            <>
              <stop offset="0" stopColor="#000" stopOpacity="0.28" />
              <stop offset="0.22" stopColor="#fff8e6" stopOpacity="0.1" />
              <stop offset="0.38" stopColor="#000" stopOpacity="0.1" />
              <stop offset="0.7" stopColor="#000" stopOpacity="0.3" />
              <stop offset="1" stopColor="#000" stopOpacity="0.55" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#000" stopOpacity="0.12" />
              <stop offset="0.18" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.3" stopColor="#fff" stopOpacity={s === 'satin' ? 0.55 : 0.36} />
              <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.6" stopColor="#000" stopOpacity="0.1" />
              <stop offset="0.72" stopColor="#fff" stopOpacity={s === 'satin' ? 0.2 : 0.1} />
              <stop offset="0.82" stopColor="#000" stopOpacity="0.15" />
              <stop offset="1" stopColor="#000" stopOpacity="0.45" />
            </>
          )}
        </linearGradient>
      )}
      {s === 'corduroy' && (
        <pattern id={`weave${uid}`} patternUnits="userSpaceOnUse" width="1" height="4">
          <rect x="0" y="0" width="0.45" height="4" fill="#000" fillOpacity="0.28" />
          <rect x="0.45" y="0" width="0.15" height="4" fill="#fff" fillOpacity="0.14" />
        </pattern>
      )}
      {s === 'denim' && (
        <pattern id={`weave${uid}`} patternUnits="userSpaceOnUse" width="1.2" height="1.2" patternTransform="rotate(-60)">
          <rect x="0" y="0" width="0.5" height="1.2" fill="#000" fillOpacity="0.16" />
          <rect x="0.5" y="0" width="0.2" height="1.2" fill="#fff" fillOpacity="0.1" />
        </pattern>
      )}
      {s === 'sequins' && (
        <pattern id={`weave${uid}`} patternUnits="userSpaceOnUse" width="1.1" height="1.1">
          <circle cx="0.55" cy="0.55" r="0.46" fill="#fff" fillOpacity="0.32" />
          <circle cx="0.4" cy="0.4" r="0.18" fill="#fff" fillOpacity="0.5" />
        </pattern>
      )}
      {s === 'lace' && (
        <pattern id={`weave${uid}`} patternUnits="userSpaceOnUse" width="2.4" height="2.4">
          <circle cx="1.2" cy="1.2" r="0.95" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.16" />
          <circle cx="1.2" cy="1.2" r="0.4" fill="#fff" fillOpacity="0.4" />
          <circle cx="0" cy="0" r="0.3" fill="#fff" fillOpacity="0.35" />
          <circle cx="2.4" cy="0" r="0.3" fill="#fff" fillOpacity="0.35" />
          <circle cx="0" cy="2.4" r="0.3" fill="#fff" fillOpacity="0.35" />
          <circle cx="2.4" cy="2.4" r="0.3" fill="#fff" fillOpacity="0.35" />
        </pattern>
      )}
      {s === 'sheer' && (
        <pattern id={`weave${uid}`} patternUnits="userSpaceOnUse" width="0.6" height="0.6">
          <rect x="0" y="0" width="0.6" height="0.12" fill="#fff" fillOpacity="0.1" />
          <rect x="0" y="0" width="0.12" height="0.6" fill="#fff" fillOpacity="0.1" />
        </pattern>
      )}
    </defs>
  );
}

/** The look drawn over one piece, given its path and, when its hem carries the border, that hem's y. */
export function ClothOverlay({ d, uid, look, hemY, k }: { d: string; uid: string; look: FabricLook | undefined; hemY?: number; k: string }) {
  if (!look) return null;
  const s = look.special;
  const sheen = s === 'leather' || s === 'satin' || s === 'velvet';
  const weave = s === 'corduroy' || s === 'denim' || s === 'sequins' || s === 'lace' || s === 'sheer';
  const B = look.border;
  return (
    <>
      {B && hemY !== undefined && (
        <>
          <defs>
            <clipPath id={`bclip${uid}${k}`}>
              <path d={d} />
            </clipPath>
            <pattern id={`band${uid}${k}`} patternUnits="userSpaceOnUse" x="0" y={f(hemY - B.size)} width={B.size} height={B.size}>
              <image href={B.href} width={B.size} height={B.size} preserveAspectRatio="none" filter={B.filter} />
            </pattern>
          </defs>
          <rect x="-1000" y={f(hemY - B.size)} width="2000" height={f(B.size)} fill={`url(#band${uid}${k})`} clipPath={`url(#bclip${uid}${k})`} />
        </>
      )}
      {weave && <path d={d} fill={`url(#weave${uid})`} stroke="none" fillOpacity={look.sheer ? 0.6 : 1} />}
      {sheen && <path d={d} fill={`url(#sheen${uid})`} stroke="none" />}
    </>
  );
}

/** Which pieces carry the border: those whose hem is the garment's lowest, within a few centimetres. */
export function borderHems(pieces: { x: number; y: number }[][]): (number | undefined)[] {
  const hems = pieces.map((s) => (s.length ? Math.max(...s.map((q) => q.y)) : -Infinity));
  const low = Math.max(...hems);
  return hems.map((h) => (h > low - 4 ? h : undefined));
}
