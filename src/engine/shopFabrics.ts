// Fabric from partner shops (Cat's F3 Cart Ready) and the colours a fabric can be shown in.
// A shop fabric fills in the maker's fabric in one tap: its name, fibre, weight, drape and colour. Buying it opens the
// shop's own checkout with the metres from the cutting layout; until partner shops join, the fabrics below are examples
// and buying is not open yet.
import type { Drape, Fibre, MyFabric, Weight } from './fabrics';
import type { Special } from './specialFabrics';

export interface Colour {
  name: string;
  hex: string;
}

export interface ShopFabric {
  id: string;
  name: string;
  shop: string;
  /** Price per metre, in the shop's currency. */
  price: number;
  currency: string;
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
  /** The shop's cart link; {qty} is replaced by the metres to buy. Empty until the shop has joined. */
  cart?: string;
  /** Example fabric shown until partner shops join. */
  example?: boolean;
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

const ALL = ['skirt', 'bodice', 'dress', 'trousers', 'jacket', 'coat'];

export const SHOP_FABRICS: ShopFabric[] = [
  {
    id: 'ex-denim-12oz',
    name: '12 oz organic denim',
    shop: 'Example shop',
    price: 18,
    currency: 'USD',
    tile: 'denim',
    fibre: 'cotton',
    special: 'denim',
    weight: 'heavy',
    drape: 'crisp',
    widthCm: 150,
    colours: [
      { name: 'Indigo', hex: '#24324f' },
      { name: 'Mid wash', hex: '#5d7aa3' },
      { name: 'Black', hex: '#1c1b1a' },
      { name: 'Ecru', hex: '#d8c9a6' },
    ],
    suits: ['skirt', 'trousers', 'jacket', 'dress'],
    example: true,
  },
  {
    id: 'ex-linen-mid',
    name: 'Washed mid-weight linen',
    shop: 'Example shop',
    price: 24,
    currency: 'USD',
    tile: 'linen',
    fibre: 'linen',
    weight: 'medium',
    drape: 'soft',
    widthCm: 140,
    colours: [
      { name: 'Natural', hex: '#cdbb98' },
      { name: 'Olive', hex: '#6b6a3a' },
      { name: 'Rust', hex: '#a2482a' },
      { name: 'Black', hex: '#1c1b1a' },
      { name: 'White', hex: '#f1ede4' },
    ],
    suits: ALL,
    example: true,
  },
  {
    id: 'ex-poplin',
    name: 'Cotton poplin',
    shop: 'Example shop',
    price: 14,
    currency: 'USD',
    tile: 'cotton',
    fibre: 'cotton',
    weight: 'light',
    drape: 'crisp',
    widthCm: 145,
    colours: [
      { name: 'White', hex: '#f1ede4' },
      { name: 'Sky', hex: '#9fb6d4' },
      { name: 'Cobalt', hex: '#2f55a4' },
      { name: 'Black', hex: '#1c1b1a' },
    ],
    suits: ['bodice', 'dress', 'skirt'],
    example: true,
  },
  {
    id: 'ex-wool-crepe',
    name: 'Wool crepe',
    shop: 'Example shop',
    price: 38,
    currency: 'USD',
    tile: 'wool',
    fibre: 'wool',
    weight: 'medium',
    drape: 'soft',
    widthCm: 150,
    colours: [
      { name: 'Charcoal', hex: '#3c3b3a' },
      { name: 'Camel', hex: '#b48a5a' },
      { name: 'Navy', hex: '#24304d' },
      { name: 'Burgundy', hex: '#6d2133' },
    ],
    suits: ALL,
    example: true,
  },
  {
    id: 'ex-baby-cord',
    name: 'Baby cord, 16 wale',
    shop: 'Example shop',
    price: 22,
    currency: 'USD',
    tile: 'corduroy',
    fibre: 'cotton',
    special: 'corduroy',
    weight: 'medium',
    drape: 'soft',
    widthCm: 145,
    colours: [
      { name: 'Tan', hex: '#a07a4a' },
      { name: 'Chocolate', hex: '#4a3022' },
      { name: 'Forest', hex: '#2f4a33' },
      { name: 'Cream', hex: '#e6dcc4' },
    ],
    suits: ['skirt', 'trousers', 'jacket', 'dress'],
    example: true,
  },
  {
    id: 'ex-silk-satin',
    name: 'Silk charmeuse',
    shop: 'Example shop',
    price: 46,
    currency: 'USD',
    tile: 'satin',
    fibre: 'silk',
    special: 'satin',
    weight: 'light',
    drape: 'fluid',
    widthCm: 114,
    colours: [
      { name: 'Champagne', hex: '#d9c49b' },
      { name: 'Black', hex: '#1c1b1a' },
      { name: 'Emerald', hex: '#1f6b4c' },
      { name: 'Blush', hex: '#e2b5aa' },
    ],
    suits: ['skirt', 'bodice', 'dress'],
    example: true,
  },
  {
    id: 'ex-velvet',
    name: 'Cotton velvet',
    shop: 'Example shop',
    price: 32,
    currency: 'USD',
    tile: 'velvet',
    fibre: 'cotton',
    special: 'velvet',
    weight: 'medium',
    drape: 'soft',
    widthCm: 140,
    colours: [
      { name: 'Black', hex: '#1c1b1a' },
      { name: 'Burgundy', hex: '#6d2133' },
      { name: 'Midnight', hex: '#1f2742' },
    ],
    suits: ['skirt', 'bodice', 'dress', 'jacket', 'trousers'],
    example: true,
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

/** The shop's checkout for this many metres, rounded up to the next tenth; none until the shop has joined. */
export function cartLink(f: ShopFabric, metres: number): string | undefined {
  if (!f.cart) return undefined;
  return f.cart.replace('{qty}', String(Math.ceil(metres * 10) / 10));
}
