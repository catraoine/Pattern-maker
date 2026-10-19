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
  { name: 'Ivory', hex: '#efe8d6' },
  { name: 'Grey', hex: '#8d8c88' },
  { name: 'Navy', hex: '#24304d' },
  { name: 'Cobalt', hex: '#2f55a4' },
  { name: 'Olive', hex: '#6b6a3a' },
  { name: 'Emerald', hex: '#1f6b4c' },
  { name: 'Camel', hex: '#b48a5a' },
  { name: 'Rust', hex: '#a2482a' },
  { name: 'Burgundy', hex: '#6d2133' },
  { name: 'Blush', hex: '#e2b5aa' },
  { name: 'Lilac', hex: '#a796c4' },
];

const MOOD = 'Mood Fabrics';
const mood = (path: string) => `https://www.moodfabrics.com/${path}`;

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

/** The colour to tint the sketch with, when the fabric's colour is one the app knows. */
export function colourHex(f: MyFabric | undefined): string | undefined {
  const name = f?.colour?.trim().toLowerCase();
  if (!name) return undefined;
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

/** Where Buy goes: the shop's cart with the amount filled in, or the colour's own page; none if the shop has neither. */
export function buyLink(f: ShopFabric, colour: string | undefined, metres: number): { href: string; inCart: boolean } | undefined {
  if (f.cart) return { href: f.cart.replace('{qty}', String(buyAmount(f, metres).qty)), inCart: true };
  const url = colourway(f, colour)?.url;
  return url ? { href: url, inCart: false } : undefined;
}
