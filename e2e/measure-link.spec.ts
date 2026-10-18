import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// Measure-me links (Cat's pick L1 + L5 + L4): a client measures from their dressmaker's link, sends the numbers
// back in a reply link, the dressmaker spots a hip taken at the waist and asks for it again.

const link = (kind: 'measure' | 'measured', data: object) => `/#${kind}=${Buffer.from(JSON.stringify({ v: 1, ...data })).toString('base64url')}`;

/** The share sheet, caught: what the app hands it ends up on window.__shared. */
async function catchShares(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: ShareData) => {
        (window as unknown as { __shared: ShareData[] }).__shared = [...((window as unknown as { __shared?: ShareData[] }).__shared ?? []), d];
      },
    });
  });
}
const lastShared = (page: Page) => page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared.at(-1)!);

async function measure(page: Page, values: [string, string][]) {
  const main = page.getByRole('main');
  for (const [label, value] of values) {
    await main.getByRole('textbox', { name: label, exact: true }).fill(value);
    await main.getByRole('button', { name: /^(Next|Done|Save)$/ }).click();
  }
}

test('measure-me link: client measures, dressmaker asks for a redo, numbers land in the book', async ({ page }) => {
  await catchShares(page);
  const main = page.getByRole('main');

  // The client opens Anya's link: her studio first, with her note.
  await page.goto(link('measure', { id: 'ask1', from: 'Anya', studio: 'Atelier Noor', note: 'Wear something close-fitting.', client: 'Jo Marsh', garment: 'skirt' }));
  await expect(main.getByRole('heading', { name: 'Atelier Noor' })).toBeVisible();
  await expect(main).toContainText('Wear something close-fitting.');
  await expect(main).toContainText('6 measurements');
  await main.getByRole('button', { name: 'Start' }).click();
  await measure(page, [
    ['Full bust', '92'],
    ['Waist', '74'],
    ['Full hip', '81'],
    ['Waist to floor', '104'],
    ['Waist to hip', '20'],
    ['Waist to knee', '58'],
  ]);
  await expect(main.getByRole('heading', { name: /All done/ })).toBeVisible();
  await main.getByRole('button', { name: 'Send to Anya' }).click();
  const reply = await lastShared(page);
  expect(reply.url).toContain('/#measured=');

  // Anya opens the reply: the hip is flagged and ticked for a redo.
  await page.goto(new URL(reply.url!).hash ? `/${new URL(reply.url!).hash}` : '/');
  await expect(main.getByRole('heading', { name: /Jo/ })).toBeVisible();
  await expect(main).toContainText('11 cm under bust');
  await expect(main.getByRole('checkbox', { name: 'Ask Jo to redo Full hip' })).toBeChecked();
  await main.getByRole('textbox', { name: /Your name/ }).fill('Anya');
  await main.getByRole('button', { name: 'Ask Jo to redo 1' }).click();
  const redo = await lastShared(page);
  expect(redo.text).toContain('full hip once more');

  // Jo redoes just the hip.
  await page.goto(`/${new URL(redo.url!).hash}`);
  await expect(main).toContainText('Full hip');
  await main.getByRole('button', { name: 'Start' }).click();
  await measure(page, [['Full hip', '99']]);
  await main.getByRole('button', { name: 'Send to Anya' }).click();
  const again = await lastShared(page);

  // Back with Anya: 99, was 81, into Jo's book.
  await page.goto(`/${new URL(again.url!).hash}`);
  await expect(main).toContainText('(was 81)');
  await main.getByRole('button', { name: "Add to Jo's book" }).click();
  await expect(main.getByRole('heading', { name: 'Jo Marsh' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Seamly2D (.vit)' })).toBeVisible();
});

test('measure-me link: a damaged link says so', async ({ page }) => {
  await page.goto('/#measured=bm90LWpzb24');
  await expect(page.getByRole('main')).toContainText('That measure link is incomplete');
});
