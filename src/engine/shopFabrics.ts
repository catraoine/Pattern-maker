// Fabric from partner shops (Cat's F3 Cart Ready) and the colours a fabric can be shown in.
// A shop fabric fills in the maker's fabric in one tap: its name, fibre, weight, drape and colour. Buying it opens the
// shop's own site with the amount from the cutting layout: straight into the cart for a shop with cart links, otherwise
// the colour's own page. Prices are what the shop listed when the fabric was added; the shop's page has today's price.
import type { Drape, Fibre, MyFabric, Weight } from './fabrics';
import type { Special } from './specialFabrics';

export interface Colour {
  name: string;
  hex: string;
  /** This colourway's own page at the shop, when each colour is its own product. */
  url?: string;
  /** This colourway's price, when it differs from the fabric's. */
  price?: number;
}

export interface ShopFabric {
  id: string;
  name: string;
  shop: string;
  /** Price per metre (or per yard for a shop that sells by the yard), in the shop's currency. */
  price: number;
  currency: string;
  /** The shop sells by the yard. */
  yards?: boolean;
  /** The flat swatch the sketch uses. */
  tile: Fibre | Special;
  fibre: Fibre;
  special?: Special;
  weight: Weight;
  drape: Drape;
  widthCm: number;
  colours: Colour[];
  /** Which garments it suits. */
  suits: string[];
  /** The shop's cart link; {qty} is replaced by the amount to buy. */
  cart?: string;
}

/** Colours for any fabric. Natural keeps the swatch as photographed. */
export const COLOURS: Colour[] = [
  { name: 'Black', hex: '#1c1b1a' },
  { name: 'White', hex: '#f7f5f0' },
  { name: 'Ivory', hex: '#efe8d6' },
  { name: 'Grey', hex: '#8d8c88' },
  { name: 'Brown', hex: '#5e3d2a' },
  { name: 'Navy', hex: '#24304d' },
  { name: 'Cobalt', hex: '#2f55a4' },
  { name: 'Olive', hex: '#6b6a3a' },
  { name: 'Emerald', hex: '#1f6b4c' },
  { name: 'Camel', hex: '#b48a5a' },
  { name: 'Rust', hex: '#a2482a' },
  { name: 'Red', hex: '#b3202a' },
  { name: 'Burgundy', hex: '#6d2133' },
  { name: 'Yellow', hex: '#d9b23a' },
  { name: 'Butter', hex: '#ecdf9e' },
  { name: 'Blush', hex: '#e2b5aa' },
  { name: 'Lilac', hex: '#a796c4' },
];

const MOOD = 'Mood Fabrics';
const mood = (path: string) => `https://www.moodfabrics.com/${path}`;

/** Each shop's affiliate tracking: Buy goes through the network so the sale earns the commission. Mood is on Awin (publisher 3131502). */
const AFFILIATE: Record<string, (url: string) => string> = {
  [MOOD]: (url) => `https://www.awin1.com/cread.php?awinmid=53817&awinaffid=3131502&ued=${encodeURIComponent(url)}`,
};
const tracked = (f: ShopFabric, url: string) => AFFILIATE[f.shop]?.(url) ?? url;

export const SHOP_FABRICS: ShopFabric[] = [
  {
    id: 'mood-denim',
    name: 'Cotton denim, 10.5 oz',
    shop: MOOD,
    price: 15.96,
    currency: 'USD',
    yards: true,
    tile: 'denim',
    fibre: 'cotton',
    special: 'denim',
    weight: 'heavy',
    drape: 'crisp',
    widthCm: 147,
    colours: [
      { name: 'Night sky', hex: '#1f2a44', url: mood('products/night-sky-10-5-oz-cotton-denim-428091') },
      { name: 'Indigo twill', hex: '#24324f', url: mood('products/indigo-cotton-denim-twill-420606'), price: 13.96 },
    ],
    suits: ['skirt', 'trousers', 'jacket', 'dress'],
  },
  {
    id: 'mood-linen-cotton',
    name: 'Linen and cotton, medium weight',
    shop: MOOD,
    price: 24.96,
    currency: 'USD',
    yards: true,
    tile: 'linen',
    fibre: 'linen',
    weight: 'medium',
    drape: 'soft',
    widthCm: 137,
    colours: [
      { name: 'Black', hex: '#1c1b1a', url: mood('medium-weight-linen-and-cotton-woven-black-439241') },
      { name: 'Oatmeal', hex: '#cdbb98', url: mood('medium-weight-linen-and-cotton-woven-oatmeal-439243') },
    ],
    suits: ['skirt', 'bodice', 'dress', 'trousers', 'jacket'],
  },
  {
    id: 'mood-poplin',
    name: 'Stretch cotton poplin',
    shop: MOOD,
    price: 8,
    currency: 'USD',
    yards: true,
    tile: 'cotton',
    fibre: 'cotton',
    weight: 'light',
    drape: 'crisp',
    widthCm: 137,
    colours: [{ name: 'White', hex: '#f1ede4', url: mood('products/white-cotton-lycra-poplin-fc13379') }],
    suits: ['bodice', 'dress', 'skirt'],
  },
  {
    id: 'mood-wool-crepe',
    name: 'Double wool crepe',
    shop: MOOD,
    price: 79.96,
    currency: 'USD',
    yards: true,
    tile: 'wool',
    fibre: 'wool',
    weight: 'medium',
    drape: 'fluid',
    widthCm: 147,
    colours: [{ name: 'Black', hex: '#1c1b1a', url: mood('products/premium-black-double-wool-crepe-pv9200-black') }],
    suits: ['skirt', 'dress', 'trousers', 'jacket', 'coat'],
  },
  {
    id: 'mood-featherwale',
    name: 'Featherwale cotton corduroy',
    shop: MOOD,
    price: 26.96,
    currency: 'USD',
    yards: true,
    tile: 'corduroy',
    fibre: 'cotton',
    special: 'corduroy',
    weight: 'medium',
    drape: 'soft',
    widthCm: 142,
    colours: [
      { name: 'Black', hex: '#1c1b1a', url: mood('products/dawn-black-featherwale-cotton-corduroy-320710') },
      { name: 'Wildberry', hex: '#6d2840', url: mood('products/dawn-wildberry-featherwale-cotton-corduroy-320704') },
    ],
    suits: ['skirt', 'trousers', 'jacket', 'dress'],
  },
  {
    id: 'mood-silk-charmeuse',
    name: 'Silk charmeuse',
    shop: MOOD,
    price: 39.96,
    currency: 'USD',
    yards: true,
    tile: 'satin',
    fibre: 'silk',
    special: 'satin',
    weight: 'light',
    drape: 'fluid',
    widthCm: 112,
    colours: [
      { name: 'Black', hex: '#1c1b1a', url: mood('products/premium-black-silk-charmeuse-pv1000-196') },
      { name: 'Toasted', hex: '#b08a62', url: mood('products/premium-toasted-silk-charmeuse-pv1000-176'), price: 36.96 },
      { name: 'Chili pepper', hex: '#8e2a22', url: mood('premium-chili-pepper-silk-charmeuse-pv1000-168') },
    ],
    suits: ['bodice', 'dress', 'skirt'],
  },
  {
    id: 'mood-velveteen',
    name: 'Cotton and rayon velveteen',
    shop: MOOD,
    price: 49.96,
    currency: 'USD',
    yards: true,
    tile: 'velvet',
    fibre: 'blend',
    special: 'velvet',
    weight: 'medium',
    drape: 'soft',
    widthCm: 137,
    colours: [
      { name: 'Black', hex: '#1c1b1a', url: mood('products/black-cotton-and-rayon-velveteen-114890') },
      { name: 'Warm sand', hex: '#c4a77f', url: mood('products/warm-sand-cotton-and-rayon-velveteen-115230') },
    ],
    suits: ['skirt', 'bodice', 'dress', 'jacket', 'trousers'],
  },
];

export const shopFabric = (id: string | undefined) => SHOP_FABRICS.find((f) => f.id === id);

/** Shop fabrics for this garment. */
export const shopFabricsFor = (garment: string) => SHOP_FABRICS.filter((f) => f.suits.includes(garment));

/** The colours offered for this fabric: a shop fabric's own colourways, otherwise the general set. */
export const coloursFor = (f: MyFabric | undefined): Colour[] => shopFabric(f?.shop)?.colours ?? COLOURS;

/** A colour picked on the colour bars or typed in: kept as its hex, like #B8613F. */
export const isHex = (s: string | undefined): s is string => !!s && /^#[0-9a-f]{6}$/i.test(s.trim());

/** The colour to tint the sketch with: a picked hex, or a colour the app knows by name. */
export function colourHex(f: MyFabric | undefined): string | undefined {
  const name = f?.colour?.trim().toLowerCase();
  if (!name) return undefined;
  if (isHex(name)) return name;
  return coloursFor(f).find((c) => c.name.toLowerCase() === name)?.hex ?? COLOURS.find((c) => c.name.toLowerCase() === name)?.hex;
}

/** The maker's fabric once a shop fabric is picked; the checks and ease choice are kept. */
export function withShopFabric(now: MyFabric, f: ShopFabric): MyFabric {
  return {
    ...now,
    shop: f.id,
    name: f.name,
    fibre: f.fibre,
    special: f.special,
    weight: f.weight,
    drape: f.drape,
    colour: f.colours[0]?.name,
  };
}

/** How much to buy for this many metres: metres rounded up to the next tenth, or whole yards for a shop that sells by the yard. */
export function buyAmount(f: ShopFabric, metres: number): { qty: number; unit: 'm' | 'yd' } {
  return f.yards ? { qty: Math.ceil(metres / 0.9144 - 1e-9), unit: 'yd' } : { qty: Math.ceil(metres * 10 - 1e-9) / 10, unit: 'm' };
}

/** The chosen colourway, or the fabric's first. */
const colourway = (f: ShopFabric, colour: string | undefined) =>
  f.colours.find((c) => c.name.toLowerCase() === colour?.trim().toLowerCase()) ?? f.colours[0];

/** The price per metre or yard for this colour. */
export const shopPrice = (f: ShopFabric, colour?: string) => colourway(f, colour)?.price ?? f.price;

/** Where Buy goes: the shop's cart with the amount filled in, or the colour's own page; none if the shop has neither. Sent through the shop's affiliate link when it has one. */
export function buyLink(f: ShopFabric, colour: string | undefined, metres: number): { href: string; inCart: boolean } | undefined {
  if (f.cart) return { href: tracked(f, f.cart.replace('{qty}', String(buyAmount(f, metres).qty))), inCart: true };
  const url = colourway(f, colour)?.url;
  return url ? { href: tracked(f, url), inCart: false } : undefined;
}

/** Hue (0-360), saturation and lightness (0-100) of a hex colour, for the colour and shade bars. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** A colour in CIELAB, where distance is roughly how different two colours look. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92));
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** How different two colours look (CIE76): under 10 reads as the same colour, under 28 as close. */
export function colourDistance(a: string, b: string): number {
  const p = lab(a);
  const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

type Closeness = 'near' | 'close' | 'far';
export const CLOSENESS: Record<Closeness, string> = { near: 'Near match', close: 'Close', far: 'Different shade' };

interface ColourMatch {
  fabric: ShopFabric;
  colour: Colour;
  distance: number;
  closeness: Closeness;
}

/** The partner shops' colourways nearest a picked colour, best first, among the fabrics that suit the garment (Cat's W4 Shop Match). */
export function closestShopColours(hex: string, garment: string, n = 3): ColourMatch[] {
  return shopFabricsFor(garment)
    .flatMap((fabric) => fabric.colours.map((colour) => ({ fabric, colour, distance: colourDistance(hex, colour.hex) })))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n)
    .map((m) => ({ ...m, closeness: m.distance < 10 ? 'near' : m.distance < 28 ? 'close' : 'far' }));
}
