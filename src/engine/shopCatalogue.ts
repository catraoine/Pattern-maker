// The partner shops' whole catalogues (Affiliates, Nov 7 2026; Cat: "set up fabric swatch links to the full catalogue,
// so the connection is set and we just wait on affiliation"). scripts/shop-catalogue.py reads every partner shop's
// fabrics and writes one file per fabric type to public/shops/. A type's file is fetched only when that type is
// tapped, so the app stays small; a fabric picked from it is remembered on this device, so saved work still shows
// it before its file loads again.
import type { Drape, Fibre, Weight } from './fabrics';
import type { Special } from './specialFabrics';
import type { ShopFabric } from './shopFabrics';

/** One fabric as public/shops/<type>.json lists it (a row keeps the files small). */
export type Row = [
  id: string,
  name: string,
  shop: string,
  price: number,
  fibre: Fibre,
  special: Special | '',
  weight: Weight,
  drape: Drape,
  widthCm: number,
  colour: string,
  hex: string,
  url: string,
  img: string,
  suits: string,
  print: 0 | 1,
  /** The shop's add-to-cart link with {qty} for the yards, or '' for a shop whose cart doesn't count in yards. */
  cart: string,
];

/** Shops whose listed price isn't a yard's price: Fashion Fabrics Club lists a quarter yard. Their cards say to see
 * the price at the shop rather than show a wrong one. */
const PRICE_AT_SHOP = new Set(['Fashion Fabrics Club']);

export function fromRow(r: Row): ShopFabric {
  const [id, name, shop, price, fibre, special, weight, drape, widthCm, colour, hex, url, img, suits, print, cart] = r;
  return {
    id,
    name,
    shop,
    price: PRICE_AT_SHOP.has(shop) ? 0 : price,
    currency: 'USD',
    yards: true,
    tile: special || fibre,
    fibre,
    ...(special ? { special } : {}),
    weight,
    drape,
    widthCm,
    colours: [{ name: colour, hex, url }],
    suits: suits.split(','),
    img,
    print: !!print,
    ...(cart ? { cart } : {}),
  };
}

const lists = new Map<string, ShopFabric[]>();
const byId = new Map<string, ShopFabric>();
const loading = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

/** For React's useSyncExternalStore: told when a type's file has loaded. */
export const subscribeCatalogue = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const catalogueVersion = () => version;

const PICKED = 'shopPicked';

function remembered(): Record<string, Row> {
  try {
    return JSON.parse(localStorage.getItem(PICKED) ?? '{}') as Record<string, Row>;
  } catch {
    return {};
  }
}

/** A catalogue fabric by its id: from a loaded file, or the copy kept when it was picked. */
export function catalogueFabric(id: string): ShopFabric | undefined {
  const known = byId.get(id);
  if (known) return known;
  const row = remembered()[id];
  return row ? fromRow(row) : undefined;
}

const rows = new Map<string, Row>();

/** Keep a picked fabric on this device, so saved work shows it before its type's file loads. The last 30 are kept. */
export function rememberPicked(id: string) {
  const row = rows.get(id);
  if (!row) return;
  try {
    const all = remembered();
    delete all[id];
    const kept = Object.entries(all).slice(-29);
    localStorage.setItem(PICKED, JSON.stringify(Object.fromEntries([...kept, [id, row]])));
  } catch {
    // Private browsing: the fabric still works until the page is closed.
  }
}

/** The fabrics of one type (a fibre or a special cloth), once its file has loaded. */
export const catalogueOf = (type: string | undefined) => (type ? lists.get(type) : undefined);

/** Start loading a type's file. Safe to call on every render: each file is fetched once. */
export function loadCatalogue(type: string | undefined, base = '/'): Promise<void> {
  if (!type || lists.has(type)) return Promise.resolve();
  const now = loading.get(type);
  if (now) return now;
  const p = fetch(`${base}shops/${type}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Row[]>) : []))
    .catch(() => [] as Row[])
    .then((data) => {
      const list = data.map((r) => {
        rows.set(r[0], r);
        const f = fromRow(r);
        byId.set(f.id, f);
        return f;
      });
      lists.set(type, list);
      version++;
      listeners.forEach((fn) => fn());
    });
  loading.set(type, p);
  return p;
}

/** Search words against a fabric's name, colour and shop: every word must appear. */
export function matchesSearch(f: ShopFabric, words: string): boolean {
  const hay = `${f.name} ${f.colours.map((c) => c.name).join(' ')} ${f.shop}`.toLowerCase();
  return words
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}
