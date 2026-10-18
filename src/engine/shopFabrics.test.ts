import { describe, expect, it } from 'vitest';
import { COLOURS, SHOP_FABRICS, cartLink, colourHex, coloursFor, shopFabricsFor, withShopFabric } from './shopFabrics';
import { pickColour, pickFabric, pickShopFabric, flatId, fabricLabel } from '../ui/FabricFill';
import type { Finish } from '../App';

const denim = SHOP_FABRICS.find((f) => f.id === 'ex-denim-12oz')!;
const start = {} as Finish;

describe('shop fabrics', () => {
  it('fills in the fabric from a shop fabric and keeps the checks', () => {
    const f = withShopFabric({ checks: { repeat: 4 }, fibre: 'silk' }, denim);
    expect(f).toMatchObject({ shop: denim.id, name: denim.name, fibre: 'cotton', special: 'denim', weight: 'heavy', colour: 'Indigo', checks: { repeat: 4 } });
  });

  it('offers a shop fabric its own colourways, any other fabric the general set', () => {
    expect(coloursFor({ shop: denim.id })).toBe(denim.colours);
    expect(coloursFor({ fibre: 'linen' })).toBe(COLOURS);
    expect(colourHex({ shop: denim.id, colour: 'Indigo' })).toBe('#24324f');
    expect(colourHex({ fibre: 'linen', colour: 'navy' })).toBe('#24304d');
    expect(colourHex({ fibre: 'linen', colour: 'teal with flecks' })).toBeUndefined();
  });

  it('only lists fabrics that suit the garment', () => {
    expect(shopFabricsFor('bodice').every((f) => f.suits.includes('bodice'))).toBe(true);
    expect(shopFabricsFor('tee')).toHaveLength(0);
  });

  it('has no checkout until a shop has joined, then rounds the metres up', () => {
    expect(cartLink(denim, 2.4)).toBeUndefined();
    expect(cartLink({ ...denim, cart: 'https://shop.example/cart?q={qty}' }, 2.41)).toBe('https://shop.example/cart?q=2.5');
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
