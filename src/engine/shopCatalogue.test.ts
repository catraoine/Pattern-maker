import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueFabric, catalogueOf, fromRow, loadCatalogue, matchesSearch, rememberPicked, type Row } from './shopCatalogue';
import { buyLink, closestShopColours, shopFabric, shopFabricsFor } from './shopFabrics';

const row = (id: string, shop: string, colour: string, hex: string, price = 20, print: 0 | 1 = 0): Row => [
  id,
  'Silk crepe de chine',
  shop,
  price,
  'silk',
  '',
  'light',
  'fluid',
  114,
  colour,
  hex,
  `https://shop.example/products/${id}`,
  `https://shop.example/${id}.jpg`,
  'bodice,dress,skirt',
  print,
  shop === 'Fashion Fabrics Club' ? '' : `https://shop.example/cart/add?id=${id}&quantity={qty}`,
];

const SILK: Row[] = [
  row('nydf-1', 'NY Designer Fabrics', 'Ruby', '#9B1B30', 39.95),
  row('ffc-2', 'Fashion Fabrics Club', 'Ruby print', '#9B1B31', 1.25, 1),
  row('mood-3', 'Mood Fabrics', 'Ivory', '#EFE8D6'),
];

const store: Record<string, string> = {};
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => (store[k] = v),
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => SILK })));
});
afterEach(() => vi.unstubAllGlobals());

describe('shop catalogues', () => {
  it('reads a row into a shop fabric with its one colourway, photo and page', () => {
    const f = fromRow(SILK[0]);
    expect(f).toMatchObject({ id: 'nydf-1', shop: 'NY Designer Fabrics', price: 39.95, yards: true, tile: 'silk', fibre: 'silk', weight: 'light', drape: 'fluid', widthCm: 114 });
    expect(f.colours).toEqual([{ name: 'Ruby', hex: '#9B1B30', url: 'https://shop.example/products/nydf-1' }]);
    expect(f.img).toBe('https://shop.example/nydf-1.jpg');
    expect(f.special).toBeUndefined();
  });

  it("leaves out a price that isn't a yard's (Fashion Fabrics Club lists a quarter yard)", () => {
    expect(fromRow(SILK[1]).price).toBe(0);
  });

  it("loads a type's file once, and its fabrics join the lists for the garments they suit", async () => {
    expect(catalogueOf('silk')).toBeUndefined();
    await Promise.all([loadCatalogue('silk'), loadCatalogue('silk')]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/shops/silk.json');
    expect(catalogueOf('silk')).toHaveLength(3);
    expect(shopFabricsFor('dress', 'silk').some((f) => f.id === 'nydf-1')).toBe(true);
    expect(shopFabricsFor('coat', 'silk').some((f) => f.id === 'nydf-1')).toBe(false);
    expect(shopFabric('mood-3')?.colours[0].name).toBe('Ivory');
  });

  it("matches a colour without the prints, whose one colour can't stand for them", async () => {
    await loadCatalogue('silk');
    const [best] = closestShopColours('#9B1B31', 'dress', 3, 'silk');
    expect(best.fabric.id).toBe('nydf-1');
  });

  it("puts the yards straight in the shop's cart, plainly until its affiliate programme approves us", async () => {
    await loadCatalogue('silk');
    expect(buyLink(shopFabric('nydf-1')!, 'Ruby', 2)).toEqual({ href: 'https://shop.example/cart/add?id=nydf-1&quantity=3', inCart: true });
  });

  it("opens the fabric's page for a shop whose cart doesn't count in yards", async () => {
    await loadCatalogue('silk');
    expect(buyLink(shopFabric('ffc-2')!, undefined, 2)).toEqual({ href: 'https://shop.example/products/ffc-2', inCart: false });
  });

  it('keeps a picked fabric on the device, so saved work finds it before the file loads', async () => {
    await loadCatalogue('silk');
    rememberPicked('mood-3');
    expect(JSON.parse(store.shopPicked)['mood-3'][0]).toBe('mood-3');
    expect(catalogueFabric('nowhere')).toBeUndefined();
  });

  it('searches the name, colour and shop, every word', () => {
    const f = fromRow(SILK[0]);
    expect(matchesSearch(f, 'ruby')).toBe(true);
    expect(matchesSearch(f, 'crepe ny designer')).toBe(true);
    expect(matchesSearch(f, 'ruby wool')).toBe(false);
  });
});
