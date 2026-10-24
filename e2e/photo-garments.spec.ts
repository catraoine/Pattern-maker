import type { Page } from '@playwright/test';
import { expect, startWithExample, test, openLooks } from './fixtures';

// Photos of any garment: the reading names the garment and opens its result, an outfit photo asks which
// piece to draft, and "Not a ...?" switches garment without reading the photo again. The server's reading
// is stubbed, so no photo is sent anywhere.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const top = {
  fit: { value: 'regular', confidence: 'medium' },
  neckline: 'crew',
  sleeve: 'long',
  sleeveShape: 'straight',
  length: 'hip',
  seams: 'darts',
  opening: 'back',
  collar: 'none',
  peplum: 'none',
  boned: false,
  knit: true,
  waistSeam: false,
};

const outfit = {
  garment: 'jacket',
  worn: true,
  pieces: [
    { garment: 'jacket', x: 0.5, y: 0.3 },
    { garment: 'trousers', x: 0.5, y: 0.75 },
  ],
  silhouette: { value: 'straight', confidence: 'low' },
  length: { value: 'maxi', confidence: 'low' },
  fit: { value: 'regular', confidence: 'low' },
  shape: { hemAt: 0.93, hemFullness: 1, flareAt: null, confidence: 'low' },
  extras: { volume: 'none', asymHem: 'none', pockets: false, elasticWaist: false },
  top,
  trousers: { fit: { value: 'regular', confidence: 'high' }, leg: 'wide', length: 'full', elasticWaist: false, opening: 'fly', pockets: 'slant' },
  outer: { fit: { value: 'regular', confidence: 'high' }, length: 'hip', front: 'double', collar: 'notched', pockets: 'welt', shaping: 'darts', pads: 'structured', flare: 'straight' },
  details: '',
};

async function readPhoto(page: Page, reading: object) {
  let calls = 0;
  await page.route('**/.netlify/functions/analyze-photo', (route) => {
    calls++;
    return route.fulfill({ json: { ok: true, reading } });
  });
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from a photo' }).click();
  await expect(main.getByRole('heading', { name: 'Snap something you love.' })).toBeVisible();
  await main.locator('input[type=file]').setInputFiles({ name: 'look.png', mimeType: 'image/png', buffer: PNG });
  return () => calls;
}

test('an outfit photo asks which piece, and drafts the jacket', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const calls = await readPhoto(page, outfit);
  await expect(main.getByRole('heading', { name: 'Which piece shall we draft?' })).toBeVisible();
  await main.getByRole('button', { name: 'Jacket', exact: true }).click();
  await expect(main.getByText('We see a jacket')).toBeVisible();
  await expect(main.getByRole('heading', { name: /double-breasted jacket with notched lapels/ })).toBeVisible();

  // Back to the photo for the other piece, then the wrong-garment switch, all from the one reading.
  await main.getByRole('button', { name: 'Draft another piece from this photo' }).click();
  await main.getByRole('button', { name: 'Trousers', exact: true }).click();
  await expect(main.getByRole('heading', { name: /Wide-leg trousers with a fly front and slant pockets/i })).toBeVisible();
  await main.getByRole('button', { name: 'Not trousers? Choose the garment' }).click();
  await main.getByRole('group', { name: 'Garment' }).getByRole('button', { name: 'Coat', exact: true }).click();
  await expect(main.getByText('We see a coat')).toBeVisible();
  await main.getByRole('button', { name: 'Draft my coat' }).click();

  await expect(main.getByRole('heading', { name: 'Style your coat' })).toBeVisible();
  await openLooks(page);
  await expect(main.getByText('Matched to your photo')).toBeVisible();
  expect(calls()).toBe(1);
});

test('a dress photo drafts a dress, with its skirt to change', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await readPhoto(page, {
    ...outfit,
    garment: 'dress',
    pieces: [{ garment: 'dress', x: 0.5, y: 0.5 }],
    silhouette: { value: 'a_line', confidence: 'high' },
    length: { value: 'knee', confidence: 'high' },
    shape: { hemAt: 0.56, hemFullness: 1.5, flareAt: null, confidence: 'high' },
    top: { ...top, neckline: 'v', sleeve: 'short', knit: false, length: 'waist', waistSeam: true },
    trousers: null,
    outer: null,
  });
  await expect(main.getByText('We see a dress')).toBeVisible();
  await expect(main.getByRole('heading', { name: /dress with a V-neck and short sleeves/i })).toBeVisible();
  await expect(main.getByText('Silhouette', { exact: true })).toBeVisible();
  await main.getByRole('button', { name: 'Draft my dress' }).click();
  await expect(main.getByRole('heading', { name: 'Style your dress' })).toBeVisible();
  await openLooks(page);
  await expect(main.getByText('Matched to your photo')).toBeVisible();
});
