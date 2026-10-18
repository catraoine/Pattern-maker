// The style sketch drawn in the maker's fabric. The fabric lies flat and on the grain: corduroy ribs,
// velvet pile and satin sheen run down the garment, and a waistband, cut lengthwise, has them running
// along it. The tiles are drawn by scripts/fabric-textures.py.
import { CSSProperties, ReactNode, useId, useState } from 'react';
import type { Finish } from '../App';
import { FIBRES, FIBRE_IDS, MyFabric, clothFor } from '../engine/fabrics';
import { SPECIALS, Special } from '../engine/specialFabrics';
import { colourHex, coloursFor, shopFabric, shopFabricsFor, withShopFabric } from '../engine/shopFabrics';

/** One tile, in the sketch's own centimetres: larger than life, so ribs and twill read on a phone. */
const TILE = 16;

const SPECIAL_IDS = Object.keys(SPECIALS) as Special[];

export const tileUrl = (id: string) => `${import.meta.env.BASE_URL}fabrics/flat/${id}.jpg`;

/** The fabric the sketch shows: a shop fabric's own swatch, else a special cloth over the fibre it is made of. */
export const flatId = (f: MyFabric | undefined): string | undefined => shopFabric(f?.shop)?.tile ?? f?.special ?? f?.fibre;

export const fabricLabel = (f: MyFabric | undefined): string | undefined =>
  shopFabric(f?.shop)?.name ?? (f?.special ? SPECIALS[f.special].label : f?.fibre ? FIBRES[f.fibre].label : undefined);

const withFabric = (finish: Finish, fabric: MyFabric): Finish => ({ ...finish, fabric, cloth: clothFor(fabric, finish.cloth) });

/** A swatch tapped on the style screen, as the finish to keep. Tapping the chosen one again clears it, as None does.
 * A plain swatch leaves any shop fabric behind. */
export function pickFabric(finish: Finish, id: string | undefined): Finish {
  const { shop, ...rest } = finish.fabric ?? {};
  const now: MyFabric = shop ? { ...rest, name: undefined } : rest;
  if (!id) return withFabric(finish, { ...now, fibre: undefined, special: undefined });
  const fabric: MyFabric = (SPECIAL_IDS as string[]).includes(id)
    ? { ...now, special: now.special === id && !shop ? undefined : (id as Special) }
    : { ...now, special: undefined, fibre: now.fibre === id && !now.special && !shop ? undefined : (id as MyFabric['fibre']) };
  return withFabric(finish, fabric);
}

/** A colour dot tapped: the sketch and the PDF take it. Tapping the chosen one again goes back to the swatch's own colour. */
export function pickColour(finish: Finish, name: string): Finish {
  const now = finish.fabric ?? {};
  const same = now.colour?.trim().toLowerCase() === name.toLowerCase();
  return withFabric(finish, { ...now, colour: same ? undefined : name });
}

/** A partner shop fabric tapped; tapping it again clears it. */
export function pickShopFabric(finish: Finish, id: string): Finish {
  const now = finish.fabric ?? {};
  const f = shopFabric(id);
  if (!f) return finish;
  if (now.shop === id) return pickFabric(finish, undefined);
  return withFabric(finish, withShopFabric(now, f));
}

/** Lightness levels for a tinted swatch: the weave keeps its shading, in the chosen colour. */
function tintTable(hex: string): [string, string, string] {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return ch.map((c) => `${(c * 0.45).toFixed(3)} ${Math.min(1, c * 1.3 + 0.06).toFixed(3)}`) as [string, string, string];
}

/** Lends its children's sketch the fabric: shapes filled with var(--garment) take it, and a waistband
 * filled with var(--garment-band) takes it turned along the band. A colour the app knows tints the swatch.
 * With no fabric chosen nothing changes. */
export function GarmentFabric({ fabric, children }: { fabric: MyFabric | undefined; children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = flatId(fabric);
  if (!id) return <>{children}</>;
  const body = `fab${uid}`;
  const band = `fabband${uid}`;
  const tint = `fabtint${uid}`;
  const hex = colourHex(fabric);
  const table = hex ? tintTable(hex) : undefined;
  const tile = (pid: string, turn: boolean) => (
    <pattern id={pid} patternUnits="userSpaceOnUse" width={TILE} height={TILE} patternTransform={turn ? 'rotate(90)' : undefined}>
      <image href={tileUrl(id)} width={TILE} height={TILE} preserveAspectRatio="none" filter={table ? `url(#${tint})` : undefined} />
    </pattern>
  );
  return (
    <div className="garment-fabric" style={{ '--garment': `url(#${body})`, '--garment-band': `url(#${band})` } as CSSProperties}>
      <svg className="fabric-defs" aria-hidden="true" focusable="false">
        <defs>
          {table && (
            <filter id={tint} colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncR type="table" tableValues={table[0]} />
                <feFuncG type="table" tableValues={table[1]} />
                <feFuncB type="table" tableValues={table[2]} />
              </feComponentTransfer>
            </filter>
          )}
          {tile(body, false)}
          {tile(band, true)}
        </defs>
      </svg>
      {children}
    </div>
  );
}

/** Under the sketch: None, then the fabric types or the partner shops' fabrics, then the colours for the one chosen. */
export function FabricSwatches({ finish, onFinish, garment }: { finish: Finish; onFinish: (f: Finish) => void; garment: string }) {
  const fabric = finish.fabric;
  const chosen = flatId(fabric);
  const label = fabricLabel(fabric);
  const shopItems = shopFabricsFor(garment);
  const [tab, setTab] = useState<'types' | 'shop'>(fabric?.shop ? 'shop' : 'types');
  const ids: { id: string; label: string }[] = [
    ...FIBRE_IDS.map((id) => ({ id, label: FIBRES[id].label })),
    ...SPECIAL_IDS.map((id) => ({ id, label: SPECIALS[id].label })),
  ];
  const colour = fabric?.colour?.trim();
  const colours = coloursFor(fabric);
  return (
    <div className="swatch-row">
      <p className="fabric-now">
        {label ? (
          <>
            <em>{label}</em>
            {colour && <span className="muted"> · {colour}</span>}
          </>
        ) : (
          <span className="muted">See it in your fabric</span>
        )}
      </p>
      {shopItems.length > 0 && (
        <div className="fabtabs" role="tablist" aria-label="Fabrics to choose from">
          <button type="button" role="tab" aria-selected={tab === 'types'} className={tab === 'types' ? 'on' : ''} onClick={() => setTab('types')}>
            Fabrics
          </button>
          <button type="button" role="tab" aria-selected={tab === 'shop'} className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>
            Shop
          </button>
        </div>
      )}
      {tab === 'types' || shopItems.length === 0 ? (
        <div className="swatches" role="radiogroup" aria-label="Fabric for the sketch">
          <button
            type="button"
            role="radio"
            aria-checked={!chosen}
            aria-label="None"
            title="None"
            className={!chosen ? 'swatch none on' : 'swatch none'}
            onClick={() => onFinish(pickFabric(finish, undefined))}
          >
            None
          </button>
          {ids.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={!fabric?.shop && chosen === s.id}
              aria-label={s.label}
              title={s.label}
              className={!fabric?.shop && chosen === s.id ? 'swatch on' : 'swatch'}
              style={{ backgroundImage: `url(${tileUrl(s.id)})` }}
              onClick={() => onFinish(pickFabric(finish, s.id))}
            />
          ))}
        </div>
      ) : (
        <div className="shopwrap">
        <div className="shopfabs" role="radiogroup" aria-label="Fabric from partner shops">
          {shopItems.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={fabric?.shop === f.id}
              className={fabric?.shop === f.id ? 'shopfab on' : 'shopfab'}
              onClick={() => onFinish(pickShopFabric(finish, f.id))}
            >
              <span className="shopfab-tile" style={{ backgroundImage: `url(${tileUrl(f.tile)})` }} aria-hidden="true" />
              <span className="shopfab-text">
                <b>{f.name}</b>
                <span className="muted small">{f.shop}</span>
                <span className="muted small">
                  ${f.price}/m · {f.colours.length} colours
                </span>
              </span>
            </button>
          ))}
        </div>
          {shopItems.some((f) => f.example) && <p className="muted small">Examples until our partner shops join.</p>}
        </div>
      )}
      {chosen && (
        <div className="colourdots" role="radiogroup" aria-label="Colour">
          {colours.map((c) => {
            const on = colour?.toLowerCase() === c.name.toLowerCase();
            return (
              <button
                key={c.name}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={c.name}
                title={c.name}
                className={on ? 'colourdot on' : 'colourdot'}
                style={{ background: c.hex }}
                onClick={() => onFinish(pickColour(finish, c.name))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
