import { expect, goPrint, goTab, openFresh, startWithExample, test } from './fixtures';
import type { Page } from '@playwright/test';

// A phone zooms the page in when a box with text under 16px is tapped, and stays zoomed: searching the lace to buy
// left Cat's Style page wider than her iPhone, its right edge cut off (Nov 28). Every box you type in is 16px or more
// on a touch screen.
test.skip(({ hasTouch }) => !hasTouch, 'Only a touch screen zooms on tapping a box.');

/** Every box on the page you can type in, with the size of its text. */
const boxes = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'))
      .filter((el) => !['checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes(el.type))
      .map((el) => ({ box: el.getAttribute('aria-label') ?? el.name ?? el.type, size: parseFloat(getComputedStyle(el).fontSize) })),
  );

test('no box you type in is small enough to zoom a phone', async ({ page }) => {
  // A shop catalogue long enough to be searched, with a one-pixel swatch for every photo, so the test needs no network.
  const row = (i: number) => [`t-${i}`, `Cotton lawn ${i}`, 'Mood Fabrics', 12.99, 'cotton', '', 'light', 'fluid', 137, 'Saffron', '#D9A030', `https://shop.example/p-${i}`, `https://shop.example/s-${i}.jpg`, 'skirt,dress,bodice,trousers', 0, ''];
  await page.route('**/shops/cotton.json', (r) => r.fulfill({ json: Array.from({ length: 40 }, (_, i) => row(i)) }));
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await page.route('https://shop.example/**', (r) => r.fulfill({ contentType: 'image/png', body: pixel }));
  await openFresh(page);
  const seen: { box: string; size: number }[] = [...(await boxes(page))];
  await startWithExample(page);
  const main = page.getByRole('main');
  await goTab(page, 'Fabric');
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Cotton' }).click();
  await expect(main.getByRole('searchbox', { name: 'Search cotton you can buy' })).toBeVisible();
  seen.push(...(await boxes(page)));
  await goPrint(page);
  seen.push(...(await boxes(page)));
  expect(seen.length).toBeGreaterThan(2);
  expect(seen.filter((b) => b.size < 16)).toEqual([]);
});
