// The style sketch drawn in the maker's fabric. The fabric lies flat and on the grain: corduroy ribs,
// velvet pile and satin sheen run down the garment, and a waistband, cut lengthwise, has them running
// along it. The tiles are drawn by scripts/fabric-textures.py.
import { CSSProperties, ReactNode, useId } from 'react';
import type { Finish } from '../App';
import { FIBRES, FIBRE_IDS, MyFabric, clothFor } from '../engine/fabrics';
import { SPECIALS, Special } from '../engine/specialFabrics';

/** One tile, in the sketch's own centimetres: larger than life, so ribs and twill read on a phone. */
const TILE = 16;

const SPECIAL_IDS = Object.keys(SPECIALS) as Special[];

export const tileUrl = (id: string) => `${import.meta.env.BASE_URL}fabrics/flat/${id}.jpg`;

/** The fabric the sketch shows: a special cloth wins over the fibre it is made of. */
export const flatId = (f: MyFabric | undefined): string | undefined => f?.special ?? f?.fibre;

export const fabricLabel = (f: MyFabric | undefined): string | undefined =>
  f?.special ? SPECIALS[f.special].label : f?.fibre ? FIBRES[f.fibre].label : undefined;

/** A swatch tapped on the style screen, as the finish to keep. Tapping the chosen one again clears it. */
export function pickFabric(finish: Finish, id: string): Finish {
  const now = finish.fabric ?? {};
  const fabric: MyFabric = (SPECIAL_IDS as string[]).includes(id)
    ? { ...now, special: now.special === id ? undefined : (id as Special) }
    : { ...now, special: undefined, fibre: now.fibre === id && !now.special ? undefined : (id as MyFabric['fibre']) };
  return { ...finish, fabric, cloth: clothFor(fabric, finish.cloth) };
}

/** Lends its children's sketch the fabric: shapes filled with var(--garment) take it, and a waistband
 * filled with var(--garment-band) takes it turned along the band. With no fabric chosen nothing changes. */
export function GarmentFabric({ fabric, children }: { fabric: MyFabric | undefined; children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = flatId(fabric);
  if (!id) return <>{children}</>;
  const body = `fab${uid}`;
  const band = `fabband${uid}`;
  const tile = (pid: string, turn: boolean) => (
    <pattern id={pid} patternUnits="userSpaceOnUse" width={TILE} height={TILE} patternTransform={turn ? 'rotate(90)' : undefined}>
      <image href={tileUrl(id)} width={TILE} height={TILE} preserveAspectRatio="none" />
    </pattern>
  );
  return (
    <div className="garment-fabric" style={{ '--garment': `url(#${body})`, '--garment-band': `url(#${band})` } as CSSProperties}>
      <svg className="fabric-defs" aria-hidden="true" focusable="false">
        <defs>
          {tile(body, false)}
          {tile(band, true)}
        </defs>
      </svg>
      {children}
    </div>
  );
}

/** The row of flat swatches under the sketch. */
export function FabricSwatches({ finish, onFinish }: { finish: Finish; onFinish: (f: Finish) => void }) {
  const chosen = flatId(finish.fabric);
  const label = fabricLabel(finish.fabric);
  const ids: { id: string; label: string }[] = [
    ...FIBRE_IDS.map((id) => ({ id, label: FIBRES[id].label })),
    ...SPECIAL_IDS.map((id) => ({ id, label: SPECIALS[id].label })),
  ];
  return (
    <div className="swatch-row">
      <p className="fabric-now">
        {label ? <em>{label}</em> : <span className="muted">See it in your fabric</span>}
      </p>
      <div className="swatches" role="radiogroup" aria-label="Fabric for the sketch">
        {ids.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={chosen === s.id}
            aria-label={s.label}
            title={s.label}
            className={chosen === s.id ? 'swatch on' : 'swatch'}
            style={{ backgroundImage: `url(${tileUrl(s.id)})` }}
            onClick={() => onFinish(pickFabric(finish, s.id))}
          />
        ))}
      </div>
    </div>
  );
}
