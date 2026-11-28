// How the cloth looks beyond its colour: what the fabric fill alone cannot show. GarmentFabric works out the
// look from the maker's fabric and passes it down; the Form view and the Drawing view draw it over each piece.
// A sheer or lace is see-through, so the form shows through it. Leather and satin catch the light in a sheen,
// velvet sinks into shadow with a soft bloom, corduroy shows its ribs, denim its twill, sequins their discs and
// lace its net. A border print sits on the hem, where it is cut to lie, over plain cloth.
import { createContext, useContext } from 'react';
import type { Special } from '../engine/specialFabrics';
import { SHADOW } from './palette';

export interface FabricLook {
  special?: Special;
  /** A sateen's soft lustre: a quiet band of light down the cloth, on a cloth that is otherwise plain. */
  sheen?: 'soft';
  /** The form shows through: a sheer or a lace. */
  sheer: boolean;
  /** See-through only faintly (MyFabric.seeThrough): laid nearly solid, the form just showing. */
  faint?: boolean;
  /** A border print: the swatch drawn along the hem, its bottom on the hem line. */
  border?: { href: string; size: number; filter?: string };
}

export const FabricLookContext = createContext<FabricLook | undefined>(undefined);
export const useFabricLook = () => useContext(FabricLookContext);

/** How much of the cloth's colour a sheer piece shows: at half, the form barely showed and Sheer read as flat pink (Cat,
 *  Nov 28), so it is laid thinner, and its doubled edges and seams (SheerEdges) say it is cloth. */
const SHEER_OPACITY = 0.32;
/** And a cloth that is only faintly see-through. */
export const FAINT_OPACITY = 0.85;
/** How solid a see-through cloth's fill is drawn, or undefined for a solid cloth. A lace is cut to its net and motifs by
 *  its mask (laceMask) instead, so its fill is laid solid. */
export const throughOpacity = (look: FabricLook | undefined) => (look?.special === 'lace' ? undefined : look?.faint ? FAINT_OPACITY : look?.sheer ? SHEER_OPACITY : undefined);

/** The lace's net and motifs as a mask, one 32 cm tile, the same size and place as the cloth's own tile (FabricFill's
 *  LACE_TILE), so the motifs of the colour tile land on the motifs of the mask: white where the motifs are solid cloth, a low
 *  grey where the net lets the form show through, clear in the eyelets. */
const LACE_NET = `${import.meta.env.BASE_URL}fabrics/flat/lace-net.png`;
const LACE_TILE = 32;

/** The mask a lace piece's cloth is drawn through, or undefined for any other cloth. */
export const laceMask = (look: FabricLook | undefined, uid: string) => (look?.special === 'lace' ? `url(#lacemask${uid})` : undefined);

const f = (n: number) => n.toFixed(2);

/** The defs one drawing needs for its cloth's look: lit from the left across x1 to x2, as the shade is. */
export function ClothDefs({ uid, x1, x2, look, flat }: { uid: string; x1: number; x2: number; look: FabricLook | undefined; flat?: boolean }) {
  if (!look) return null;
  const s = look.special;
  return (
    <defs>
      {(s === 'leather' || s === 'satin' || s === 'velvet') && (
        <linearGradient id={`sheen${uid}`} gradientUnits="userSpaceOnUse" x1={f(x1)} x2={f(x2)} y1="0" y2="0">
          {s === 'velvet' ? (
            <>
              <stop offset="0" stopColor={SHADOW} stopOpacity="0.28" />
              <stop offset="0.22" stopColor="#fff8e6" stopOpacity="0.1" />
              <stop offset="0.38" stopColor={SHADOW} stopOpacity="0.1" />
              <stop offset="0.7" stopColor={SHADOW} stopOpacity="0.3" />
              <stop offset="1" stopColor={SHADOW} stopOpacity="0.55" />
            </>
          ) : s === 'leather' && flat ? (
            // A flat lies wide and unshaped, so the form's narrow catch of light reads as a hard stripe on it: here it is broad and low.
            <>
              <stop offset="0" stopColor={SHADOW} stopOpacity="0.1" />
              <stop offset="0.08" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.3" stopColor="#fff" stopOpacity="0.17" />
              <stop offset="0.54" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.66" stopColor={SHADOW} stopOpacity="0.08" />
              <stop offset="0.76" stopColor="#fff" stopOpacity="0.05" />
              <stop offset="0.86" stopColor={SHADOW} stopOpacity="0.15" />
              <stop offset="1" stopColor={SHADOW} stopOpacity="0.4" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={SHADOW} stopOpacity="0.12" />
              <stop offset="0.18" stopColor="#fff" stopOpacity="0" />
              {/* On a flat the satin's catch of light is half as bright: at full it read as streaks down the Ivory Bias Slip (Cat, Nov 14: "soften"). */}
              <stop offset="0.3" stopColor="#fff" stopOpacity={s === 'satin' ? (flat ? 0.3 : 0.55) : 0.36} />
              <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.6" stopColor={SHADOW} stopOpacity="0.1" />
              <stop offset="0.72" stopColor="#fff" stopOpacity={s === 'satin' ? (flat ? 0.1 : 0.2) : 0.1} />
              <stop offset="0.82" stopColor={SHADOW} stopOpacity="0.15" />
              <stop offset="1" stopColor={SHADOW} stopOpacity="0.45" />
            </>
          )}
        </linearGradient>
      )}
      {!s && look.sheen === 'soft' && (
        <linearGradient id={`sheen${uid}`} gradientUnits="userSpaceOnUse" x1={f(x1)} x2={f(x2)} y1="0" y2="0">
          <stop offset="0" stopColor={SHADOW} stopOpacity="0.04" />
          <stop offset="0.16" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.46" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor={SHADOW} stopOpacity="0.04" />
          <stop offset="0.73" stopColor="#fff" stopOpacity="0.07" />
          <stop offset="0.84" stopColor={SHADOW} stopOpacity="0.06" />
          <stop offset="1" stopColor={SHADOW} stopOpacity="0.16" />
        </linearGradient>
      )}
      {s === 'corduroy' && (
        <pattern id={`weave${uid}`} patternUnits="userSpaceOnUse" width="1" height="4">
          <rect x="0" y="0" width="0.45" height="4" fill={SHADOW} fillOpacity="0.28" />
          <rect x="0.45" y="0" width="0.15" height="4" fill="#fff" fillOpacity="0.14" />
        </pattern>
      )}
      {s === 'denim' && (
        <pattern id={`weave${uid}`} patternUnits="userSpaceOnUse" width="1.2" height="1.2" patternTransform="rotate(-60)">
          <rect x="0" y="0" width="0.5" height="1.2" fill={SHADOW} fillOpacity="0.16" />
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
        <>
          <pattern id={`lacenet${uid}`} patternUnits="userSpaceOnUse" width={LACE_TILE} height={LACE_TILE}>
            <image href={LACE_NET} width={LACE_TILE} height={LACE_TILE} preserveAspectRatio="none" />
          </pattern>
          <mask id={`lacemask${uid}`} maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
            <rect x="-1000" y="-1000" width="3000" height="3000" fill={`url(#lacenet${uid})`} />
          </mask>
        </>
      )}
    </defs>
  );
}

/** The look drawn over one piece, given its path and, when its hem carries the border, that hem's y. */
export function ClothOverlay({ d, uid, look, hemY, k }: { d: string; uid: string; look: FabricLook | undefined; hemY?: number; k: string }) {
  if (!look) return null;
  const s = look.special;
  const soft = !s && look.sheen === 'soft';
  const sheen = s === 'leather' || s === 'satin' || s === 'velvet' || soft;
  // (A sheer has no weave drawn: its fine grid of light read as a check. A lace's net is its mask.)
  const weave = s === 'corduroy' || s === 'denim' || s === 'sequins';
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
      {/* Fills are set by style: the flat's own rule (.techflat path) switches off a fill attribute, which left flats without shine or weave. */}
      {weave && <path d={d} style={{ fill: `url(#weave${uid})` }} stroke="none" />}
      {sheen && <path d={d} style={{ fill: `url(#sheen${uid})` }} stroke="none" />}
    </>
  );
}

/** A sheer's edges and seams lie double, so in a real chiffon they show as narrow, more solid bands: the rolled hem,
 *  the bound neck, the seam allowances seen through the cloth. Drawn just inside each piece's edge (and along any seams
 *  given), they are what makes a thin colour read as sheer cloth and not a pale wash (Cat, Nov 28). */
export function SheerEdges({ d, uid, k, look, seams = [], band = 1.1 }: { d: string; uid: string; k: string; look: FabricLook | undefined; seams?: string[]; band?: number }) {
  if (look?.special !== 'sheer') return null;
  const clip = `sheeredge${uid}${k}`;
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`} style={{ stroke: 'var(--garment)' }} fill="none" strokeLinejoin="round">
        <path d={d} strokeWidth={band * 2} strokeOpacity={0.75} />
        {seams.map((sd, i) => (
          <path key={i} d={sd} strokeWidth={band * 0.9} strokeOpacity={0.5} strokeLinecap="round" />
        ))}
      </g>
    </>
  );
}

/** Which pieces carry the border: those whose hem is the garment's lowest, within a few centimetres. */
export function borderHems(pieces: { x: number; y: number }[][]): (number | undefined)[] {
  const hems = pieces.map((s) => (s.length ? Math.max(...s.map((q) => q.y)) : -Infinity));
  const low = Math.max(...hems);
  return hems.map((h) => (h > low - 4 ? h : undefined));
}
