// The style sketch drawn in the maker's fabric. The fabric lies flat and on the grain: corduroy ribs,
// velvet pile and satin sheen run down the garment, and a waistband, cut lengthwise, has them running
// along it. The tiles are drawn by scripts/fabric-textures.py.
import { CSSProperties, ReactNode, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { Finish } from '../savedWork';
import { FIBRES, FIBRE_IDS, FabricGarment, MyFabric, clothFor, printRepeat } from '../engine/fabrics';
import { PRINTS, printImage, printOf, printTileCm } from '../engine/prints';
import { FabricDetails } from './FabricDetails';
import { SPECIALS, Special } from '../engine/specialFabrics';
import { KNITS, KNIT_IDS, isKnit } from '../engine/knitFabrics';
import { CLOSENESS, ShopFabric, buyAmount, buyLink, closestShopColours, colourHex, coloursFor, hexToHsl, hslToHex, isHex, shopFabric, shopFabricsFor, shopListsOn, shopPrice, withShopFabric } from '../engine/shopFabrics';
import { catalogueVersion, loadCatalogue, matchesSearch, rememberPicked, subscribeCatalogue } from '../engine/shopCatalogue';
import { FabricMetres } from './FabricCard';
import { ExactColour } from './ExactColour';
import { TestingTag } from './TestingTag';
import { FabricLook, FabricLookContext } from './ClothLook';
import { fabricPhotoUrl, saveFabricPhoto, useFabricPhoto } from '../fabricPhoto';

/** One tile, in the sketch's own centimetres: larger than life, so ribs and twill read on a phone. */
const TILE = 16;

const SPECIAL_IDS = Object.keys(SPECIALS) as Special[];

export const tileUrl = (id: string) => `${import.meta.env.BASE_URL}fabrics/flat/${id}.jpg`;

/** The fabric the sketch shows: a shop fabric's own swatch, else a special cloth or a knit over the fibre it is made of. */
export const flatId = (f: MyFabric | undefined): string | undefined => shopFabric(f?.shop)?.tile ?? f?.special ?? f?.knit ?? f?.fibre;

/** The print the sketch is drawn in, if one is picked: it shows over the cloth, in its own colours. */
const printShown = (f: MyFabric | undefined) => {
  const kind = printOf(f);
  return kind && kind !== 'plain' ? kind : undefined;
};

export const fabricLabel = (f: MyFabric | undefined): string | undefined =>
  f?.photo ? 'Your fabric' : shopFabric(f?.shop)?.name ?? (f?.special ? SPECIALS[f.special].label : f?.knit ? KNITS[f.knit].label : f?.fibre ? FIBRES[f.fibre].label : undefined);

const withFabric = (finish: Finish, fabric: MyFabric): Finish => ({ ...finish, fabric, cloth: clothFor(fabric, finish.cloth) });

/** A swatch tapped on the style screen, as the finish to keep. Tapping the chosen one again clears it, as None does.
 * A plain swatch leaves any shop fabric behind. A knit (the T-shirt's swatches) brings the fibre, weight and drape it
 * usually comes in, so the fabric check can speak to it. */
export function pickFabric(finish: Finish, id: string | undefined): Finish {
  const { shop, ...rest } = finish.fabric ?? {};
  const now: MyFabric = shop ? { ...rest, name: undefined } : rest;
  if (!id) return withFabric(finish, { ...now, fibre: undefined, special: undefined, knit: undefined, photo: undefined });
  if (isKnit(id)) {
    if (now.knit === id && !shop) return withFabric(finish, { ...now, knit: undefined, fibre: undefined });
    const k = KNITS[id];
    return withFabric(finish, { ...now, special: undefined, knit: id, fibre: k.fibre, weight: k.weight, drape: k.drape });
  }
  const fabric: MyFabric = (SPECIAL_IDS as string[]).includes(id)
    ? { ...now, knit: undefined, special: now.special === id && !shop ? undefined : (id as Special) }
    : { ...now, knit: undefined, special: undefined, fibre: now.fibre === id && !now.special && !shop ? undefined : (id as MyFabric['fibre']) };
  return withFabric(finish, fabric);
}

/** How wide one tile of a fabric photo shows on the garment, in cm: a photo taken from about 30 cm away. */
const PHOTO_SIZES: { cm: number; label: string }[] = [
  { cm: 10, label: 'Small' },
  { cm: 20, label: 'Medium' },
  { cm: 40, label: 'Large' },
];
const PHOTO_CM = 20;

/** The maker's own fabric photo, kept: the drawings show it, in place of a shop fabric or a colour. The fabric type
 * picked stays, as what the cloth is, for the advice and the cutting. */
export function pickPhoto(finish: Finish, id: string): Finish {
  const { shop, ...rest } = finish.fabric ?? {};
  const now: MyFabric = shop ? { ...rest, name: undefined } : rest;
  return withFabric(finish, { ...now, colour: undefined, photo: { id, size: finish.fabric?.photo?.size ?? PHOTO_CM } });
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
  rememberPicked(id);
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
  rememberPicked(id);
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
function fabricLook(fabric: MyFabric | undefined, base: string): FabricLook | undefined {
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
  /** All round's plain calico: how much of its own colour it gives off, so the lamps don't grey it. */
  lift?: number;
}

/** The paint for a fabric, or undefined when the garment is left in lines. */
export function fabricPaint(fabric: MyFabric | undefined, base: string): FabricPaint | undefined {
  // The maker's own photo, once loaded: in its own colours, at the size picked, over whatever else is picked.
  const photo = fabricPhotoUrl(fabric?.photo?.id);
  if (photo && fabric?.photo) {
    const special = fabric.special;
    return { href: photo, size: fabric.photo.size, tone: INK, ground: IVORY, half: mix(INK, IVORY, 0.5), plain: IVORY, look: special ? { special, sheer: special === 'sheer' || special === 'lace' } : undefined };
  }
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
  // Loads a fabric photo from this device's store; the drawing redraws in it once it's there.
  useFabricPhoto(fabric?.photo?.id);
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

/** Loads a fabric type's whole shop catalogue (shopCatalogue.ts) and redraws when it arrives. */
function useShopCatalogue(type: string | undefined) {
  useSyncExternalStore(subscribeCatalogue, catalogueVersion);
  useEffect(() => {
    if (type && shopListsOn()) void loadCatalogue(type, import.meta.env.BASE_URL);
  }, [type]);
}

/** A shop card's swatch: the shop's own photo, small, or the app's tile for the cloth. */
const shopTile = (f: ShopFabric) => `url(${f.img ? `${f.img}${f.img.includes('?') ? '&' : '?'}width=160` : tileUrl(f.tile)})`;

/** A catalogue card's name: the cloth, then its colour unless the name already says it ("Gray Silk Chiffon"). */
const shopCardName = (f: ShopFabric) => {
  const colour = f.img && f.colours[0]?.name !== 'As shown' ? f.colours[0]?.name : undefined;
  return colour && !f.name.toLowerCase().includes(colour.toLowerCase()) ? `${f.name}, ${colour}` : f.name;
};

/** How many shop fabrics show at first, and each "More" adds: on a phone the cards stack two across, so a dozen. */
const SHOP_PAGE = 12;

/** Under the sketch: None and the fabric types, then the shop fabrics of the type chosen, then its colours, then
 * what the chosen shop fabric costs for this garment and the way to buy it. Every swatch is a palette card (Cat's
 * A1 + A5, 2026-10-25): the cloth above a cream name strip, the picked one taller.
 * One list, no Fabrics / Shop switch (Cat's D + C, 2026-11-02): cotton shows only the cottons you can buy, and the
 * colours under them are always the ones for what's picked. */
/** The Fabric tab's swatches; `details` adds the folded "About your fabric" under them, the one place it's asked. */
export function FabricSwatches({ finish, onFinish, garment, details }: { finish: Finish; onFinish: (f: Finish) => void; garment: FabricGarment; details?: boolean }) {
  const fabric = finish.fabric;
  const chosen = flatId(fabric);
  const label = fabricLabel(fabric);
  const metres = useContext(FabricMetres);
  // The T-shirt is drafted for stretch, so it offers knits; every other garment offers woven fibres and special cloths.
  const knits = garment === 'tee';
  const ids: { id: string; label: string }[] = knits
    ? KNIT_IDS.map((id) => ({ id, label: KNITS[id].label }))
    : [...FIBRE_IDS.map((id) => ({ id, label: FIBRES[id].label })), ...SPECIAL_IDS.map((id) => ({ id, label: SPECIALS[id].label }))];
  // The type the shop fabrics are listed under: the one last tapped, while it still holds the picked shop fabric
  // (denim sits under Cotton and under Denim), else the picked shop fabric's own fibre, else the plain type picked.
  const shop = shopFabric(fabric?.shop);
  const [tapped, setTapped] = useState<string>();
  const under = (f: ShopFabric, id: string | undefined) => !!id && (f.fibre === id || f.special === id);
  const type = shop ? (under(shop, tapped) ? tapped : shop.fibre) : chosen;
  const typeLabel = ids.find((s) => s.id === type)?.label;
  // Shops' catalogues are woven cloth: the T-shirt's knits have none to load.
  useShopCatalogue(knits ? undefined : type);
  const shopItems = shopListsOn() ? shopFabricsFor(garment, type) : [];
  const allToBuy = shopItems.filter((f) => under(f, type));
  // A whole shop catalogue runs to thousands, so the list is searchable and shows a page at a time.
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(SHOP_PAGE);
  useEffect(() => setShown(SHOP_PAGE), [type, search]);
  const found = search.trim() ? allToBuy.filter((f) => matchesSearch(f, search)) : allToBuy;
  const toBuy = found.slice(0, shown);
  // A picked print is what the sketch shows, so it names the cloth in place of the colour.
  const printed = printShown(fabric);
  const colour = fabric?.photo ? (chosen ? ids.find((i) => i.id === chosen)?.label : undefined) : printed ? (printed === 'checks' ? (fabric?.checks?.stripes ? 'Stripes' : fabric?.checks?.gingham ? 'Gingham' : 'Checks') : PRINTS[printed].label) : fabric?.colour?.trim();
  const colours = coloursFor(fabric);
  const picked = isHex(fabric?.colour) ? fabric!.colour!.trim().toUpperCase() : undefined;
  const [anyOpen, setAnyOpen] = useState(!!picked);
  // A photo of the maker's own fabric carries its own colour, so no colours are offered under it.
  const photoOn = !!fabric?.photo;
  // Any colour is for the fabric types: a shop fabric comes only in its own colourways.
  const anyColour = !fabric?.shop && !printed && !photoOn;
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
      <div className="swatches" role="radiogroup" aria-label="Fabric for the sketch">
        <button
          type="button"
          role="radio"
          aria-checked={!chosen && !photoOn}
          aria-label="None"
          title="None"
          className={!chosen && !photoOn ? 'swatch none on' : 'swatch none'}
          onClick={() => onFinish(pickFabric(finish, undefined))}
        >
          <span className="card-tex" aria-hidden="true" />
          <span className="card-name" aria-hidden="true">None</span>
        </button>
        <PhotoSwatch finish={finish} onFinish={onFinish} />
        {ids.map((s) => {
          const on = type === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={s.label}
              title={s.label}
              className={on ? 'swatch on' : 'swatch'}
              onClick={() => {
                // With a shop fabric picked, tapping a type it sits under just lists that type's fabrics.
                if (shop && under(shop, s.id)) return setTapped(s.id);
                setTapped(s.id);
                onFinish(pickFabric(finish, s.id));
              }}
            >
              <span className="card-tex" style={{ backgroundImage: `url(${tileUrl(s.id)})` }} aria-hidden="true" />
              <span className="card-name" aria-hidden="true">{s.label}</span>
              {s.id === 'lace' && <TestingTag tool="lace" />}
            </button>
          );
        })}
      </div>
      {allToBuy.length > 0 && typeLabel && (
        <div className="shopwrap">
          <p className="shopwrap-q">
            {typeLabel} you can buy <span className="muted">· {allToBuy.length.toLocaleString('en-US')}</span>
          </p>
          {allToBuy.length > SHOP_PAGE && (
            <input
              type="search"
              className="shopsearch"
              placeholder="Search a colour, a cloth or a shop"
              aria-label={`Search ${typeLabel.toLowerCase()} you can buy`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {found.length === 0 && <p className="muted small">Nothing matches. Try one word, like a colour.</p>}
          <div className="shopfabs" role="radiogroup" aria-label={`${typeLabel} you can buy`}>
            {toBuy.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={fabric?.shop === f.id}
                className={fabric?.shop === f.id ? 'shopfab on' : 'shopfab'}
                onClick={() => onFinish(pickShopFabric(finish, f.id))}
              >
                <span className={f.img ? 'shopfab-tile photo' : 'shopfab-tile'} style={{ backgroundImage: shopTile(f) }} aria-hidden="true" />
                <span className="shopfab-text">
                  <b>{shopCardName(f)}</b>
                  <span>
                    {f.shop} · {f.price ? `$${f.price}/${f.yards ? 'yd' : 'm'}` : 'price at the shop'}
                  </span>
                </span>
              </button>
            ))}
            {found.length > shown && (
              <button type="button" className="shopfab more" onClick={() => setShown(shown + SHOP_PAGE)}>
                <span className="shopfab-text">
                  <b>More</b>
                  <span>{(found.length - shown).toLocaleString('en-US')} to go</span>
                </span>
              </button>
            )}
          </div>
          {shop && type && (
            <button type="button" className="later plaintype" onClick={() => onFinish(pickFabric(finish, type))}>
              Or just see it in plain {typeLabel.toLowerCase()}, any colour <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
      )}
      {photoOn && <PhotoSize finish={finish} onFinish={onFinish} named={!!chosen} />}
      {chosen && !photoOn && (
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
      {chosen && anyColour && anyOpen && <ColourBars finish={finish} onFinish={onFinish} garment={garment} type={chosen} onShop={() => setTapped(undefined)} />}
      {shop && <BuyStrip shop={shop} colour={fabric?.colour} metres={metres} garment={garment} />}
      {details && <FabricDetails fabric={fabric} garment={garment} onFabric={(f) => onFinish({ ...finish, fabric: f, cloth: clothFor(f, finish.cloth) })} />}
    </div>
  );
}

/** "Your photo" (Design: Fabric, Nov 7): a photo of the maker's own fabric, taken now or picked from the phone's photos,
 * shown on the drawings. The photo is made into a tile here and kept on this device; it is never sent. */
function PhotoSwatch({ finish, onFinish }: { finish: Finish; onFinish: (f: Finish) => void }) {
  const input = useRef<HTMLInputElement>(null);
  // The finish as it is when the photo is ready, not when it was picked: other taps made while it is read are kept.
  const latest = useRef(finish);
  latest.current = finish;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = finish.fabric?.photo?.id;
  const url = useFabricPhoto(id);
  const on = !!id;
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? 'Your photo: take or pick another' : 'Your photo: photograph your own fabric'}
        title="Your photo"
        className={on ? 'swatch photo on' : 'swatch photo'}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <span className="card-tex" style={url ? { backgroundImage: `url(${url})` } : undefined} aria-hidden="true">
          {!url && (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 8h3l2-2.5h6L17 8h3v11H4z M12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="card-name" aria-hidden="true">{busy ? 'Reading' : 'Your photo'}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          const got = await saveFabricPhoto(file);
          setBusy(false);
          setFailed(!got);
          if (got) onFinish(pickPhoto(latest.current, got));
        }}
      />
      {failed && (
        <p className="photo-fail small" role="alert">
          That photo couldn't be read. Try another, or take a new one.
        </p>
      )}
    </>
  );
}

/** Under the swatches once a photo is in: how big it shows, a way to take it off, and where it is kept. */
function PhotoSize({ finish, onFinish, named }: { finish: Finish; onFinish: (f: Finish) => void; named: boolean }) {
  const photo = finish.fabric?.photo;
  if (!photo) return null;
  return (
    <div className="photosize">
      <p className="photosize-q">
        Size on the garment <TestingTag tool="fabric_photo" />
      </p>
      <div className="chips" role="radiogroup" aria-label="Size on the garment">
        {PHOTO_SIZES.map((s) => (
          <button
            key={s.cm}
            type="button"
            role="radio"
            aria-checked={photo.size === s.cm}
            className={photo.size === s.cm ? 'chip on' : 'chip'}
            onClick={() => onFinish(withFabric(finish, { ...finish.fabric, photo: { ...photo, size: s.cm } }))}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="muted small">
        {named ? 'Lay it flat in daylight and fill the frame for the truest match.' : 'Tap what it is made of above, so the advice and the cutting suit it.'} Your photo stays on this device and is never sent.
      </p>
      <button type="button" className="later" onClick={() => onFinish(withFabric(finish, { ...finish.fabric, photo: undefined }))}>
        Take the photo off
      </button>
    </div>
  );
}

const GARMENT_WORD: Record<FabricGarment, string> = {
  skirt: 'skirt',
  bodice: 'top',
  dress: 'dress',
  trousers: 'trousers',
  tee: 'T-shirt',
  jacket: 'jacket',
  coat: 'coat',
  lingerie: 'set',
};

/** The picked shop fabric in words (Cat's C Buy Strip, 2026-11-02): what it is, how much this garment needs, about
 * what it costs, and the way to the shop with that amount. */
function BuyStrip({ shop, colour, metres, garment }: { shop: ShopFabric; colour?: string; metres?: number; garment: FabricGarment }) {
  const amount = metres ? buyAmount(shop, metres) : undefined;
  const cost = amount && shopPrice(shop, colour) ? Math.ceil(amount.qty * shopPrice(shop, colour)) : undefined;
  const link = buyLink(shop, colour, metres ?? 0);
  const word = GARMENT_WORD[garment];
  return (
    <div className="buystrip" aria-label="The fabric you picked">
      <p className="buystrip-name">{shop.name}</p>
      <p className="small">
        {shop.shop}
        {colour && !isHex(colour) ? ` · ${colour}` : ''}
      </p>
      {amount && (
        <p className="small">
          {amount.qty} {amount.unit} for your {word}
          {cost ? (
            <>
              {' · '}
              <b>about ${cost}</b>
            </>
          ) : (
            ' · price at the shop'
          )}
        </p>
      )}
      {link && (
        <a className="buylink" href={link.href} target="_blank" rel="noopener noreferrer">
          Buy at {shop.shop.replace(/ Fabrics$/, '')} <span aria-hidden="true">›</span>
        </a>
      )}
      <p className="muted small">Prices are the shop's when we added it. We may earn a commission when you buy.</p>
    </div>
  );
}

const HUES = 'hsl(0 60% 50%), hsl(40 65% 50%), hsl(60 60% 50%), hsl(120 40% 40%), hsl(180 40% 40%), hsl(240 45% 45%), hsl(300 40% 45%), hsl(360 60% 50%)';

/** Any colour (Cat's W2 Two Bars + W4 Shop Match, 2026-10-25): a colour bar, a shade bar and a hex box, then the
 * partner shops' nearest colourways, one tap to use that fabric in that colour. */
function ColourBars({ finish, onFinish, garment, type, onShop }: { finish: Finish; onFinish: (f: Finish) => void; garment: FabricGarment; type?: string; onShop: () => void }) {
  useShopCatalogue(type);
  const now = finish.fabric?.colour;
  const hex = isHex(now) ? now.trim().toUpperCase() : undefined;
  const hsl = hex ? hexToHsl(hex) : { h: 15, s: 50, l: 48 };
  // A grey has no colour to turn, so turning the colour bar gives it some.
  const sat = Math.max(hsl.s, 35);
  const [typed, setTyped] = useState<string | undefined>();
  const matches = hex && shopListsOn() ? closestShopColours(hex, garment, 3, type) : [];
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
        Any colour <TestingTag tool="any_colour" />
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
                {/* A catalogue fabric's own name already says its colour ("Rust Handkerchief Linen"); its tagged colour is broader. */}
                <b>{m.fabric.img ? shopCardName(m.fabric) : m.colour.name}</b>
                <span className="muted small">{m.fabric.img ? m.fabric.shop : `${m.fabric.name} · ${m.fabric.shop}`}</span>
              </span>
              <span className={`colourmatch-tag ${m.closeness}`}>{CLOSENESS[m.closeness]}</span>
            </button>
          ))}
          <p className="muted small">Tap one to use that fabric in that colour. Screens vary, so order a swatch first.</p>
        </div>
      )}
      {hex && (matches.length === 0 || matches[0].closeness !== 'near') && <ExactColour hex={hex} garment={garment} />}
    </div>
  );
}
