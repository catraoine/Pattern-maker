// The style sketch drawn in the maker's fabric. The fabric lies flat and on the grain: corduroy ribs,
// velvet pile and satin sheen run down the garment, and a waistband, cut lengthwise, has them running
// along it. The tiles are drawn by scripts/fabric-textures.py.
import { CSSProperties, ReactNode, useId, useState } from 'react';
import type { Finish } from '../App';
import { FIBRES, FIBRE_IDS, FabricGarment, MyFabric, clothFor, printRepeat } from '../engine/fabrics';
import { PRINTS, printImage, printOf, printTileCm } from '../engine/prints';
import { FabricDetails } from './FabricDetails';
import { SPECIALS, Special } from '../engine/specialFabrics';
import { CLOSENESS, closestShopColours, colourHex, coloursFor, hexToHsl, hslToHex, isHex, shopFabric, shopFabricsFor, withShopFabric } from '../engine/shopFabrics';
import { TestingTag } from './TestingTag';
import { FabricLook, FabricLookContext } from './ClothLook';

/** One tile, in the sketch's own centimetres: larger than life, so ribs and twill read on a phone. */
const TILE = 16;

const SPECIAL_IDS = Object.keys(SPECIALS) as Special[];

export const tileUrl = (id: string) => `${import.meta.env.BASE_URL}fabrics/flat/${id}.jpg`;

/** The fabric the sketch shows: a shop fabric's own swatch, else a special cloth over the fibre it is made of. */
export const flatId = (f: MyFabric | undefined): string | undefined => shopFabric(f?.shop)?.tile ?? f?.special ?? f?.fibre;

/** The print the sketch is drawn in, if one is picked: it shows over the cloth, in its own colours. */
const printShown = (f: MyFabric | undefined) => {
  const kind = printOf(f);
  return kind && kind !== 'plain' ? kind : undefined;
};

/** What the sketch is filled with, a print or a cloth; undefined when it is left in lines. */
export const fillId = (f: MyFabric | undefined): string | undefined => {
  const kind = printShown(f);
  return kind ? `print-${kind}${f?.checks?.stripes ? '-stripes' : kind === 'checks' && f?.checks?.gingham ? '-gingham' : ''}` : flatId(f);
};

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

/** A colour picked on the bars or typed as a hex: the sketch takes it as is. */
export function pickHex(finish: Finish, hex: string): Finish {
  return withFabric(finish, { ...(finish.fabric ?? {}), colour: hex.toUpperCase() });
}

/** A shop colourway tapped under the colour bars: that fabric, in that colour. */
export function pickShopColour(finish: Finish, id: string, colour: string): Finish {
  const f = shopFabric(id);
  if (!f) return finish;
  return withFabric(finish, { ...withShopFabric(finish.fabric ?? {}, f), colour });
}

/** Lightness levels for a tinted swatch: the weave keeps its shading, in the chosen colour. */
function tintTable(hex: string): [string, string, string] {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return ch.map((c) => `${(c * 0.45).toFixed(3)} ${Math.min(1, c * 1.3 + 0.06).toFixed(3)}`) as [string, string, string];
}

const IVORY = '#efe8d6';
const INK = '#2a2826';
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const light = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
};
const dark = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.12;
};
/** The two colours a print is drawn in: the chosen colour on ivory, or, when the colour is a light one, ink on it. */
const twoTone = (hex: string | undefined): { tone: string; ground: string } => (!hex ? { tone: INK, ground: IVORY } : light(hex) ? { tone: INK, ground: hex } : { tone: hex, ground: IVORY });
/** A print's darks in the tone and its lights in the ground, so the print keeps its drawing in the chosen colour. */
function printTable(tone: string, ground: string): [string, string, string] {
  const t = rgb(tone);
  const g = rgb(ground);
  return t.map((c, i) => `${c.toFixed(3)} ${g[i].toFixed(3)}`) as [string, string, string];
}
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((c, i) => Math.round((c * (1 - t) + y[i] * t) * 255).toString(16).padStart(2, '0')).join('')}`;
};

/** The look the drawings give the cloth beyond its fill: sheer, sheen, weave, and a border print on the hem. */
export function fabricLook(fabric: MyFabric | undefined, base: string): FabricLook | undefined {
  const special = shopFabric(fabric?.shop)?.special ?? fabric?.special;
  const kind = printShown(fabric);
  if (!special && kind !== 'border') return undefined;
  return { special, sheer: special === 'sheer' || special === 'lace', ...(kind === 'border' ? { border: { href: printImage('border', base), size: printTileCm('border', undefined) } } : {}) };
}

/** How a fabric is painted: the swatch (or drawn checks) at its size in cm, the colour table that tints it,
 * and its look. The sketch's fill and All round's cloth both take it from here, so they always agree. */
export interface FabricPaint {
  /** The swatch to tile; with neither it nor drawn checks, the cloth is plain `plain`. */
  href?: string;
  /** Lightness to colour, per channel, as SVG feFuncR/G/B tableValues: the swatch is greyed, then mapped. */
  table?: [string, string, string];
  /** One tile, in cm. */
  size: number;
  /** Checks or stripes, drawn in the tone on the ground. */
  drawn?: 'checks' | 'stripes';
  tone: string;
  ground: string;
  half: string;
  plain: string;
  look?: FabricLook;
}

/** The paint for a fabric, or undefined when the garment is left in lines. */
export function fabricPaint(fabric: MyFabric | undefined, base: string): FabricPaint | undefined {
  const id = flatId(fabric);
  const kind = printShown(fabric);
  if (!id && !kind) return undefined;
  const hex = colourHex(fabric);
  const look = fabricLook(fabric, base);
  // A border print lies on the hem (see ClothLook); the body is plain cloth under it.
  const bodyKind = kind === 'border' ? undefined : kind;
  // Checks and stripes are drawn, not pictured, so they come at the repeat entered and in the colour chosen.
  const drawn = bodyKind === 'checks';
  const two = twoTone(hex);
  // A pictured print in a dark colour is mostly that colour: its ground, with the drawing picked out pale.
  const { tone, ground } = hex && bodyKind && !drawn && dark(hex) ? { tone: mix(IVORY, hex, 0.3), ground: hex } : two;
  // A cloth is tinted in its colour; a pictured print keeps its drawing but takes the colour, when one is chosen.
  const table = bodyKind ? (hex ? printTable(tone, ground) : undefined) : hex ? tintTable(hex) : undefined;
  const repeat = printRepeat(fabric);
  const stripes = !!fabric?.checks?.stripes;
  const size = drawn ? printTileCm('checks', repeat, stripes) / 3 : bodyKind ? printTileCm(bodyKind, repeat, stripes) : TILE;
  // Under a border print the cloth is the print's own ivory ground, unless a colour is chosen for it.
  const href = drawn ? undefined : bodyKind ? printImage(bodyKind, base, stripes) : id && (kind !== 'border' || hex) ? tileUrl(id) : undefined;
  return { href, table, size, drawn: drawn ? (stripes ? 'stripes' : 'checks') : undefined, tone, ground, half: mix(tone, ground, 0.5), plain: hex ?? IVORY, look };
}

/** Lends its children's sketch the fabric: shapes filled with var(--garment) take it, and a waistband
 * filled with var(--garment-band) takes it turned along the band. A colour the app knows tints the swatch;
 * a picked print is drawn instead, at its own scale and in its own colours, except checks, which take the colour
 * picked against near black (a camel check reads black and gold). With no fabric chosen nothing changes. */
export function GarmentFabric({ fabric, children }: { fabric: MyFabric | undefined; children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const paint = fabricPaint(fabric, import.meta.env.BASE_URL);
  if (!paint) return <>{children}</>;
  const body = `fab${uid}`;
  const band = `fabband${uid}`;
  const tint = `fabtint${uid}`;
  const { href, table, size, tone, ground, half, look } = paint;
  const drawn = !!paint.drawn;
  const stripes = paint.drawn === 'stripes';
  const tile = (pid: string, turn: boolean) => (
    <pattern id={pid} patternUnits="userSpaceOnUse" width={size} height={size} patternTransform={turn ? 'rotate(90)' : undefined}>
      {drawn ? (
        stripes ? (
          <>
            <rect width={size} height={size} fill={ground} />
            <rect width={size * 0.42} height={size} fill={tone} />
          </>
        ) : (
          <>
            <rect width={size} height={size} fill={ground} />
            <rect width={size / 2} height={size / 2} fill={tone} />
            <rect x={size / 2} width={size / 2} height={size / 2} fill={half} />
            <rect y={size / 2} width={size / 2} height={size / 2} fill={half} />
          </>
        )
      ) : href ? (
        <image href={href} width={size} height={size} preserveAspectRatio="none" filter={table ? `url(#${tint})` : undefined} />
      ) : (
        <rect width={size} height={size} fill={paint.plain} />
      )}
    </pattern>
  );
  return (
    <div className="garment-fabric" style={{ '--garment': `url(#${body})`, '--garment-band': `url(#${band})` } as CSSProperties}>
      <svg className="fabric-defs" aria-hidden="true" focusable="false">
        <defs>
          {table && (
            <filter id={tint} className="fabric-tint" colorInterpolationFilters="sRGB">
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
      <FabricLookContext.Provider value={look}>{children}</FabricLookContext.Provider>
    </div>
  );
}

/** Under the sketch: None, then the fabric types or the partner shops' fabrics, then the colours for the one chosen.
 * Every swatch is a palette card (Cat's A1 + A5, 2026-10-25): the cloth above a cream name strip, the picked one taller. */
/** The Fabric tab's swatches; `details` adds the folded "About your fabric" under them, the one place it's asked. */
export function FabricSwatches({ finish, onFinish, garment, details }: { finish: Finish; onFinish: (f: Finish) => void; garment: FabricGarment; details?: boolean }) {
  const fabric = finish.fabric;
  const chosen = flatId(fabric);
  const label = fabricLabel(fabric);
  const shopItems = shopFabricsFor(garment);
  const [tab, setTab] = useState<'types' | 'shop'>(fabric?.shop ? 'shop' : 'types');
  const ids: { id: string; label: string }[] = [
    ...FIBRE_IDS.map((id) => ({ id, label: FIBRES[id].label })),
    ...SPECIAL_IDS.map((id) => ({ id, label: SPECIALS[id].label })),
  ];
  // A picked print is what the sketch shows, so it names the cloth in place of the colour.
  const printed = printShown(fabric);
  const colour = printed ? (printed === 'checks' ? (fabric?.checks?.stripes ? 'Stripes' : fabric?.checks?.gingham ? 'Gingham' : 'Checks') : PRINTS[printed].label) : fabric?.colour?.trim();
  const colours = coloursFor(fabric);
  const picked = isHex(fabric?.colour) ? fabric!.colour!.trim().toUpperCase() : undefined;
  const [anyOpen, setAnyOpen] = useState(!!picked);
  // Any colour is for the fabric types: a shop fabric comes only in its own colourways.
  const anyColour = !fabric?.shop && !printed;
  return (
    <div className="swatch-row">
      <p className="fabric-now">
        {label ? (
          <>
            <em>{label}</em>
            {colour && <span className="muted"> · {picked ? <span className="hexname">{picked}</span> : colour}</span>}
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
            <span className="card-tex" aria-hidden="true" />
            <span className="card-name" aria-hidden="true">None</span>
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
              onClick={() => onFinish(pickFabric(finish, s.id))}
            >
              <span className="card-tex" style={{ backgroundImage: `url(${tileUrl(s.id)})` }} aria-hidden="true" />
              <span className="card-name" aria-hidden="true">{s.label}</span>
            </button>
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
                <span>{f.shop}</span>
                <span>
                  ${f.price}/{f.yards ? 'yd' : 'm'} · {f.colours.length === 1 ? '1 colour' : `${f.colours.length} colours`}
                </span>
              </span>
            </button>
          ))}
        </div>
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
                onClick={() => onFinish(pickColour(finish, c.name))}
              >
                {/* The chosen fabric's weave over the colour, so each card reads as that cloth dyed. */}
                <span className="card-tex" style={{ backgroundColor: c.hex, '--tex': `url(${tileUrl(chosen)})` } as CSSProperties} aria-hidden="true" />
                <span className="card-name" aria-hidden="true">{c.name}</span>
              </button>
            );
          })}
          {anyColour && (
            <button
              type="button"
              aria-expanded={anyOpen}
              aria-label="Any colour"
              title="Any colour"
              className={picked ? 'colourdot anycolour on' : 'colourdot anycolour'}
              onClick={() => setAnyOpen(!anyOpen)}
            >
              <span className="card-tex" style={picked ? { backgroundColor: picked } : undefined} aria-hidden="true" />
              <span className="card-name" aria-hidden="true">{picked ?? 'Any'}</span>
            </button>
          )}
        </div>
      )}
      {chosen && anyColour && anyOpen && <ColourBars finish={finish} onFinish={onFinish} garment={garment} onShop={() => setTab('shop')} />}
      {details && <FabricDetails fabric={fabric} garment={garment} onFabric={(f) => onFinish({ ...finish, fabric: f, cloth: clothFor(f, finish.cloth) })} />}
    </div>
  );
}

const HUES = 'hsl(0 60% 50%), hsl(40 65% 50%), hsl(60 60% 50%), hsl(120 40% 40%), hsl(180 40% 40%), hsl(240 45% 45%), hsl(300 40% 45%), hsl(360 60% 50%)';

/** Any colour (Cat's W2 Two Bars + W4 Shop Match, 2026-10-25): a colour bar, a shade bar and a hex box, then the
 * partner shops' nearest colourways, one tap to use that fabric in that colour. */
function ColourBars({ finish, onFinish, garment, onShop }: { finish: Finish; onFinish: (f: Finish) => void; garment: FabricGarment; onShop: () => void }) {
  const now = finish.fabric?.colour;
  const hex = isHex(now) ? now.trim().toUpperCase() : undefined;
  const hsl = hex ? hexToHsl(hex) : { h: 15, s: 50, l: 48 };
  // A grey has no colour to turn, so turning the colour bar gives it some.
  const sat = Math.max(hsl.s, 35);
  const [typed, setTyped] = useState<string | undefined>();
  const matches = hex ? closestShopColours(hex, garment) : [];
  const set = (h: number, s: number, l: number) => {
    setTyped(undefined);
    onFinish(pickHex(finish, hslToHex(h, s, l)));
  };
  const onType = (v: string) => {
    const t = v.trim().replace(/^#?/, '#');
    setTyped(v);
    if (isHex(t)) onFinish(pickHex(finish, t));
  };
  return (
    <div className="colourbars">
      <p className="colourbars-q">
        Any colour <TestingTag />
      </p>
      <label className="colourbar">
        <span>Colour</span>
        <input type="range" min={0} max={359} value={Math.round(hsl.h)} style={{ background: `linear-gradient(90deg, ${HUES})` }} onChange={(e) => set(+e.target.value, sat, hsl.l)} />
      </label>
      <label className="colourbar">
        <span>Shade</span>
        <input
          type="range"
          min={6}
          max={94}
          value={Math.round(Math.min(94, Math.max(6, hsl.l)))}
          style={{ background: `linear-gradient(90deg, ${hslToHex(hsl.h, sat, 6)}, ${hslToHex(hsl.h, sat, 50)}, ${hslToHex(hsl.h, sat, 94)})` }}
          onChange={(e) => set(hsl.h, sat, +e.target.value)}
        />
      </label>
      <label className="hexbox">
        <span>Hex</span>
        <input type="text" inputMode="text" spellCheck={false} autoCapitalize="characters" maxLength={7} placeholder="#B8613F" value={typed ?? hex ?? ''} onChange={(e) => onType(e.target.value)} onBlur={() => setTyped(undefined)} />
        {hex && <i className="colourdot" style={{ background: hex }} aria-hidden="true" />}
      </label>
      {matches.length > 0 && (
        <div className="colourmatch">
          <p className="colourmatch-q">Closest at the shops</p>
          {matches.map((m) => (
            <button
              key={`${m.fabric.id}-${m.colour.name}`}
              type="button"
              className="colourmatch-row"
              onClick={() => {
                onShop();
                onFinish(pickShopColour(finish, m.fabric.id, m.colour.name));
              }}
            >
              <span className="colourmatch-split" aria-hidden="true">
                <i style={{ background: hex }} />
                <i style={{ background: m.colour.hex }} />
              </span>
              <span className="colourmatch-text">
                <b>{m.colour.name}</b>
                <span className="muted small">
                  {m.fabric.name} · {m.fabric.shop}
                </span>
              </span>
              <span className={`colourmatch-tag ${m.closeness}`}>{CLOSENESS[m.closeness]}</span>
            </button>
          ))}
          <p className="muted small">Tap one to use that fabric in that colour. Screens vary, so order a swatch first.</p>
        </div>
      )}
    </div>
  );
}
