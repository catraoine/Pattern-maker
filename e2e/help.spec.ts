import type { Page } from '@playwright/test';
import { expect, openAccount, startWithExample, test } from './fixtures';

const main = (page: Page) => page.getByRole('main');

// Help & feedback (Cat's H3, Nov 6, 2026): the first small link on Your account opens short answers and a note to us.
// The note carries the screen you came from, the version and the browser, and a screenshot if you add one.

// A tiny real PNG, so the browser can read and shrink it like a phone screenshot.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAIAAABrW6giAAAAFElEQVR4nGPUkBNhgAEmBiRADgcAHO4AZhZTKcoAAAAASUVORK5CYII=', 'base64');

test('help: answers, then a note with a screenshot reaches the server', async ({ page }) => {
  let sent: Record<string, string> | undefined;
  await page.route('**/.netlify/functions/note', async (route) => {
    sent = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({ json: { ok: true } });
  });
  await startWithExample(page);
  await openAccount(page);
  await main(page).getByRole('button', { name: 'Help & feedback' }).click();
  await expect(main(page).getByRole('heading', { name: 'Help & feedback' })).toBeVisible();
  // The first answer is open; the others open on a tap.
  await expect(main(page).getByText(/Measure the 10 cm test square on page A1/)).toBeVisible();
  await main(page).getByText('Letter or A4?').click();
  await expect(main(page).getByText(/Letter in North America/)).toBeVisible();

  await main(page).getByRole('button', { name: 'Send us a note' }).click();
  const send = main(page).getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeDisabled();
  await main(page).getByLabel('What happened, or what would make it better?').fill('The length marks overlap the skirt on Maxi.');
  await main(page).getByLabel('Add a screenshot').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
  await expect(main(page).getByText('Screenshot added')).toBeVisible();
  await send.click();
  await expect(main(page).getByRole('heading', { name: 'Thank you' })).toBeVisible();

  expect(sent?.note).toBe('The length marks overlap the skirt on Maxi.');
  // The screen they came from is Style, not the account page they opened Help from.
  expect(sent?.view).toBe('style');
  expect(sent?.shot).toMatch(/^data:image\/jpeg;base64,/);
  expect(Object.keys(sent ?? {}).sort()).toEqual(['browser', 'note', 'shot', 'version', 'view']);

  await main(page).getByRole('button', { name: 'Done' }).click();
  await expect(main(page).getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
});

test('help: a note that does not go through keeps what was written', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of 502/);
  await page.route('**/.netlify/functions/note', (route) => route.fulfill({ status: 502, json: { ok: false } }));
  await startWithExample(page);
  await openAccount(page);
  await main(page).getByRole('button', { name: 'Help & feedback' }).click();
  await main(page).getByRole('button', { name: 'Send us a note' }).click();
  const box = main(page).getByLabel('What happened, or what would make it better?');
  await box.fill('Print button did nothing.');
  await main(page).getByRole('button', { name: 'Send', exact: true }).click();
  await expect(main(page).getByText(/didn’t go through/)).toBeVisible();
  await expect(box).toHaveValue('Print button did nothing.');
});
