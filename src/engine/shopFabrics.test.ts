import { describe, expect, it } from 'vitest';
import { COLOURS, SHOP_FABRICS, buyAmount, buyLink, colourHex, coloursFor, shopFabricsFor, withShopFabric } from './shopFabrics';
import { pickColour, pickFabric, pickShopFabric, flatId, fabricLabel } from '../ui/FabricFill';
import type { Finish } from '../App';

const denim = SHOP_FABRICS.find((f) => f.id === 'mood-denim')!;
const start = {} as Finish;

describe('shop fabrics', () => {
  it('fills in the fabric from a shop fabric and keeps the checks', () => {
    const f = withShopFabric({ checks: { repeat: 4 }, fibre: 'silk' }, denim);
    expect(f).toMatchObject({ shop: denim.id, name: denim.name, fibre: 'cotton', special: 'denim', weight: 'heavy', colour: 'Night sky', checks: { repeat: 4 } });
  });

  it('offers a shop fabric its own colourways, any other fabric the general set', () => {
    expect(coloursFor({ shop: denim.id })).toBe(denim.colours);
    expect(coloursFor({ fibre: 'linen' })).toBe(COLOURS);
    expect(colourHex({ shop: denim.id, colour: 'Indigo twill' })).toBe('#24324f');
    expect(colourHex({ fibre: 'linen', colour: 'navy' })).toBe('#24304d');
    expect(colourHex({ fibre: 'linen', colour: 'teal with flecks' })).toBeUndefined();
  });

  it('only lists fabrics that suit the garment', () => {
    expect(shopFabricsFor('bodice').every((f) => f.suits.includes('bodice'))).toBe(true);
    expect(shopFabricsFor('tee')).toHaveLength(0);
  });

  it('buys whole yards from a shop that sells by the yard, tenths of a metre otherwise', () => {
    expect(buyAmount(denim, 2.4)).toEqual({ qty: 3, unit: 'yd' });
    expect(buyAmount(denim, 1.8288)).toEqual({ qty: 2, unit: 'yd' });
    expect(buyAmount({ ...denim, yards: false }, 2.41)).toEqual({ qty: 2.5, unit: 'm' });
  });

  it("opens the colour's own page, or the cart with the amount when the shop has cart links", () => {
    const awin = (url: string) => `https://www.awin1.com/cread.php?awinmid=53817&awinaffid=3131502&ued=${encodeURIComponent(url)}`;
    expect(buyLink(denim, 'Indigo twill', 2.4)).toEqual({ href: awin(denim.colours[1].url!), inCart: false });
    expect(buyLink(denim, undefined, 2.4)?.href).toBe(awin(denim.colours[0].url!));
    expect(buyLink({ ...denim, shop: 'Other', cart: 'https://shop.example/cart?q={qty}' }, 'Black', 2.4)).toEqual({ href: 'https://shop.example/cart?q=3', inCart: true });
    expect(buyLink({ ...denim, colours: [{ name: 'Black', hex: '#000' }] }, 'Black', 2.4)).toBeUndefined();
  });

  it('every shop fabric has a page to buy each colour from', () => {
    for (const f of SHOP_FABRICS) for (const c of f.colours) expect(c.url ?? f.cart, `${f.id} ${c.name}`).toMatch(/^https:\/\//);
  });
});

describe('fabric on the style sketch', () => {
  it('None takes the fabric off the sketch', () => {
    const on = pickFabric(start, 'wool');
    expect(flatId(on.fabric)).toBe('wool');
    expect(flatId(pickFabric(on, undefined).fabric)).toBeUndefined();
  });

  it('a shop fabric shows its own swatch and name, and a plain swatch leaves it behind', () => {
    const shop = pickShopFabric(start, denim.id);
    expect(flatId(shop.fabric)).toBe('denim');
    expect(fabricLabel(shop.fabric)).toBe(denim.name);
    const plain = pickFabric(shop, 'linen');
    expect(plain.fabric?.fibre).toBe('linen');
    expect(plain.fabric?.shop).toBeUndefined();
    expect(plain.fabric?.name).toBeUndefined();
    expect(pickShopFabric(shop, denim.id).fabric?.shop).toBeUndefined();
  });

  it('a colour dot sets the colour, and tapping it again clears it', () => {
    const blue = pickColour(pickFabric(start, 'cotton'), 'Cobalt');
    expect(blue.fabric?.colour).toBe('Cobalt');
    expect(pickColour(blue, 'cobalt').fabric?.colour).toBeUndefined();
  });
});
