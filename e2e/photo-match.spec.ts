import { readFileSync, writeFileSync } from 'node:fs';
import { expect, openLooks, startWithExample, test } from './fixtures';

// Matching the real piece: a reading torn between two shapes asks which, what the app can't draft yet is
// named, and the photo's neckline depth carries into the pattern. The server's reading is stubbed, so no
// photo is sent anywhere. STILLS=<dir> also saves the result screen, for review.

const PHOTO = readFileSync(new URL('../evals/photo/photos/04-a-line.jpg', import.meta.url));

const reading = {
  garment: 'dress',
  worn: true,
  pieces: [{ garment: 'dress', x: 0.5, y: 0.5 }],
  silhouette: { value: 'a_line', confidence: 'medium' },
  length: { value: 'knee', confidence: 'high' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.56, hemFullness: 1.6, flareAt: null, confidence: 'medium' },
  extras: { volume: 'none', asymHem: 'none', pockets: false, elasticWaist: false },
  top: {
    fit: { value: 'regular', confidence: 'medium' },
    neckline: 'v',
    sleeve: 'none',
    sleeveShape: 'straight',
    length: 'waist',
    seams: 'darts',
    opening: 'back',
    collar: 'none',
    peplum: 'none',
    boned: false,
    knit: false,
    waistSeam: true,
    waistSeamAt: 'natural',
    belt: 'none',
  },
  trousers: null,
  outer: null,
  fabric: null,
  measures: { neckDepthCm: 22, sleeveEndsAt: null, topHemAt: null, trouserHemAt: null },
  unsure: { group: 'silhouette', other: 'half_circle' },
  missing: ['shoulder bow', 'tiered hem'],
  details: 'It has a bow at the shoulder and a tiered hem.',
};

test('an unsure reading asks once, and names what the app cannot draft yet', async ({ page }, info) => {
  await startWithExample(page);
  await page.route('**/.netlify/functions/analyze-photo', (route) => route.fulfill({ json: { ok: true, reading } }));
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from a photo' }).click();
  await main.locator('input[type=file]').setInputFiles({ name: 'dress.jpg', mimeType: 'image/jpeg', buffer: PHOTO });

  // The one question comes first, on its own, before anything else.
  await expect(main.getByRole('heading', { name: 'A-line or half circle?' })).toBeVisible();
  await expect(main.getByText('Then your dress is ready to draft.')).toBeVisible();
  await expect(main.getByText('We see a dress')).toHaveCount(0);
  const dir = process.env.STILLS;
  if (dir) await page.screenshot({ path: `${dir}/${info.project.name}-1-ask.png`, fullPage: true });

  await main.getByRole('button', { name: 'Half circle', exact: true }).click();
  await expect(main.getByText('A-line or half circle?')).toHaveCount(0);
  await expect(main.getByText('We see a dress')).toBeVisible();
  await expect(main.getByRole('heading', { name: /half circle/i })).toBeVisible();
  await expect(main.getByText(/Neckline 22 cm deep/)).toBeVisible();
  await expect(main.getByText('Not in the app yet: shoulder bow and tiered hem.')).toBeVisible();
  // The details sentence is replaced by the list, not shown as well.
  await expect(main.getByText('It has a bow at the shoulder')).toHaveCount(0);
  // Everything read sits on one line, with one Change that opens the choices.
  await main.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(main.getByRole('group', { name: 'Silhouette' })).toBeVisible();
  if (dir) await page.screenshot({ path: `${dir}/${info.project.name}-2-answered.png`, fullPage: true });
});

test('a back photo adds a low back and a slit to the dress', async ({ page }, info) => {
  await startWithExample(page);
  const front = { ...reading, unsure: null, missing: [] };
  const back = { shown: true, backNeck: 'v', opening: 'lace_up', slit: 'back', vent: false, confidence: 'high', missing: [] };
  await page.route('**/.netlify/functions/analyze-photo', (route) =>
    route.fulfill({ json: (route.request().postDataJSON() as { view?: string }).view === 'back' ? { ok: true, back } : { ok: true, reading: front } }),
  );
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from a photo' }).click();
  await main.locator('input[type=file]').first().setInputFiles({ name: 'dress.jpg', mimeType: 'image/jpeg', buffer: PHOTO });
  await expect(main.getByText('Add back photo')).toBeVisible();
  const dir = process.env.STILLS;
  if (dir) await page.screenshot({ path: `${dir}/${info.project.name}-3-back-offer.png`, fullPage: true });

  await main.locator('.photolinks label', { hasText: 'Add back photo' }).locator('input[type=file]').setInputFiles({ name: 'back.jpg', mimeType: 'image/jpeg', buffer: PHOTO });
  await expect(main.getByText('V back, back slit.')).toBeVisible();
  await expect(main.getByText('Lace-up back.')).toBeVisible();
  if (dir) await page.screenshot({ path: `${dir}/${info.project.name}-4-back-read.png`, fullPage: true });
});

test('the self-check compares the drawing with the photo, corrects it once, and can be undone', async ({ page }, info) => {
  await startWithExample(page);
  const front = { ...reading, unsure: null, missing: [], measures: { ...reading.measures, neckDepthCm: null } };
  let drawingSent = '';
  await page.route('**/.netlify/functions/analyze-photo', (route) => {
    const req = route.request().postDataJSON() as { view?: string; drawing?: string };
    if (req.view !== 'check') return route.fulfill({ json: { ok: true, reading: front } });
    drawingSent = req.drawing ?? '';
    return route.fulfill({ json: { ok: true, reading: { ...front, length: { value: 'midi', confidence: 'high' }, shape: { ...front.shape, hemAt: 0.74 } }, changes: ['hem 15 cm longer'] } });
  });
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from a photo' }).click();
  await main.locator('input[type=file]').first().setInputFiles({ name: 'dress.jpg', mimeType: 'image/jpeg', buffer: PHOTO });
  await main.getByRole('button', { name: /Draft my dress/ }).click();
  await expect(main.getByText('Changed: hem 15 cm longer.')).toBeVisible();
  // The drawing went as a picture.
  expect(Buffer.from(drawingSent, 'base64').subarray(1, 4).toString()).toBe('PNG');
  const dir = process.env.STILLS;
  if (dir) {
    await page.screenshot({ path: `${dir}/${info.project.name}-5-checked.png` });
    writeFileSync(`${dir}/${info.project.name}-5-drawing-sent.png`, Buffer.from(drawingSent, 'base64'));
  }
  await main.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await expect(main.getByText('Changed: hem 15 cm longer.')).toHaveCount(0);
});
