import type { Page } from '@playwright/test';
import { expect, expectStyle, fillStepPages, measureMe, openFresh, test } from './fixtures';

// "Something else" on the list of what to make: described in words, then "We can make that" measures for and
// styles the matched garment, and "Not yet" offers the full set for a dressmaker. The reading is stubbed.

const reading = {
  garment: 'dress',
  worn: true,
  pieces: [{ garment: 'dress', x: 0.5, y: 0.5 }],
  silhouette: { value: 'straight', confidence: 'medium' },
  length: { value: 'midi', confidence: 'high' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.6, hemFullness: 1.2, flareAt: null, confidence: 'medium' },
  extras: { volume: 'none', asymHem: 'none', pockets: false, elasticWaist: false },
  top: { fit: { value: 'regular', confidence: 'medium' }, neckline: 'cowl', sleeve: 'none', sleeveShape: 'straight', length: 'waist', seams: 'darts', opening: 'back', collar: 'none', peplum: 'none', boned: false, knit: false, waistSeam: true },
  trousers: null,
  outer: null,
  details: '',
};

async function toDescribe(page: Page, idea: object) {
  const sent: string[] = [];
  await page.route('**/.netlify/functions/describe-idea', (route) => {
    sent.push((route.request().postDataJSON() as { text: string }).text);
    return route.fulfill({ json: { ok: true, idea } });
  });
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await main.getByRole('radio', { name: 'Something else' }).click();
  await main.getByRole('button', { name: 'Continue measurements' }).click();
  await expect(main.getByRole('heading', { name: 'Tell us what you have in mind.' })).toBeVisible();
  const ask = main.getByRole('button', { name: 'See what we can make' });
  await expect(ask).toBeDisabled();
  await main.getByLabel('Describe it').fill('A bias-cut slip dress with a cowl neck');
  await ask.click();
  return sent;
}

test('a described slip dress measures for the dress and opens it cut on the bias', async ({ page }) => {
  const sent = await toDescribe(page, { verdict: 'make', name: 'slip dress', note: 'We set it up cut on the bias with a cowl neck.', start: 'dress', bias: true, reading });
  expect(sent).toEqual(['A bias-cut slip dress with a cowl neck']);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'A slip dress.' })).toBeVisible();
  const picks = main.getByRole('list', { name: 'Your dress' });
  await expect(picks).toContainText('Cowl');
  await expect(picks).toContainText('Bias slip');
  await expect(main).toContainText(/It needs \d+ more measurements?\./);
  await main.getByRole('button', { name: 'Continue measurements' }).click();
  await fillStepPages(page);
  await expectStyle(page, 'Dress');
  await expect(main.getByRole('button', { name: 'Bias slip', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
});

test('something the app can not make yet offers the full set of measurements', async ({ page }) => {
  await toDescribe(page, { verdict: 'not_yet', name: 'swimsuit', note: 'Swimwear needs patterns drafted for stretch fabric, which we don’t do yet.', start: null, bias: false, reading: { ...reading, garment: 'other' } });
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: "We can't draft a swimsuit yet." })).toBeVisible();
  await main.getByRole('button', { name: 'Take my full measurements for a dressmaker' }).click();
  await fillStepPages(page);
  await expect(main.getByRole('heading', { name: 'Every measurement is saved.' })).toBeVisible();
});
