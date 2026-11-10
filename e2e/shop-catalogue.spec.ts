import { expect, goPrint, goTab, startWithExample, test } from './fixtures';

// The partner shops' whole catalogues (Affiliates, Nov 7): a type's fabrics load when it is tapped, each with the
// shop's own swatch photo, searchable, a page at a time; picking one fills in the fabric and Buy opens its own page.
const row = (i: number, shop: string, colour: string, hex: string, price = 12.99) => [
  `t-${i}`,
  i === 0 ? 'Cotton lawn' : `Cotton twill ${i}`,
  shop,
  price,
  'cotton',
  '',
  i === 0 ? 'light' : 'medium',
  i === 0 ? 'fluid' : 'crisp',
  137,
  colour,
  hex,
  `https://shop.example/products/cotton-${i}`,
  `https://shop.example/swatch-${i}.jpg`,
  'skirt,dress,bodice,trousers',
  0,
  shop === 'Fashion Fabrics Club' ? '' : `https://shop.example/cart/add?id=${i}&quantity={qty}`,
];
const COTTON = [
  row(0, 'NY Designer Fabrics', 'Saffron', '#D9A030', 18.5),
  row(1, 'Fashion Fabrics Club', 'Navy', '#24304D', 0.87),
  ...Array.from({ length: 40 }, (_, i) => row(i + 2, 'Mood Fabrics', 'Black', '#1C1B1A')),
];

test('a shop catalogue lists its fabrics, searchable, and a pick goes to the shop', async ({ page }) => {
  await page.route('**/shops/cotton.json', (r) => r.fulfill({ json: COTTON }));
  // A one-pixel swatch for every photo, so the test needs no network.
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await page.route('https://shop.example/**', (r) => r.fulfill({ contentType: 'image/png', body: pixel }));
  await startWithExample(page);
  const main = page.getByRole('main');
  await goTab(page, 'Fabric');
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Cotton' }).click();
  const toBuy = main.getByRole('radiogroup', { name: 'Cotton you can buy' });
  // The hand-picked cottons first, then the catalogue, a page at a time with a More card.
  await expect(main.locator('.shopwrap-q')).toContainText('Cotton you can buy');
  await expect(main.locator('.shopfab.more')).toBeVisible();
  await expect(toBuy.locator('.shopfab-tile.photo').first()).toHaveAttribute('style', /swatch-0\.jpg\?width=160/);
  // A shop that lists a quarter yard says to see the price at the shop.
  await expect(toBuy.getByRole('radio', { name: /Cotton twill 1, Navy/ })).toContainText('price at the shop');
  await main.getByRole('searchbox', { name: 'Search cotton you can buy' }).fill('saffron');
  await expect(toBuy.getByRole('radio')).toHaveCount(1);
  await toBuy.getByRole('radio', { name: /Cotton lawn, Saffron/ }).click();
  const strip = main.locator('.buystrip');
  await expect(strip).toContainText('NY Designer Fabrics · Saffron');
  await expect(strip).toContainText(/\d+ yd for your skirt · about \$\d+/);
  // Buy puts the yards in the shop's cart; not yet approved by its affiliate programme, so the link is plain.
  await expect(strip.getByRole('link', { name: /Buy \d+ yd at NY Designer/ })).toHaveAttribute('href', /^https:\/\/shop\.example\/cart\/add\?id=0&quantity=\d+$/);
  // Saved work keeps the pick after a reload, before the catalogue loads again.
  await page.route('**/shops/cotton.json', (r) => r.fulfill({ json: [] }));
  await page.reload();
  await page.getByRole('button', { name: /Carry on with your skirt/i }).click();
  await goPrint(page);
  await expect(main.locator('.yourfabric h2')).toContainText('Cotton lawn');
  await expect(main.locator('.shopbuy')).toContainText('NY Designer Fabrics');
});
