import { expect, openFresh, startWithExample, test } from './fixtures';

const footer = (page: import('@playwright/test').Page) => page.getByRole('contentinfo');

test('legal pages open from the footer on the welcome screen', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');

  await footer(page).getByRole('button', { name: 'Privacy' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await main.getByRole('button', { name: /Read the Terms of Use/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
  await main.getByRole('button', { name: 'Back' }).first().click();
  await expect(main.getByRole('heading', { level: 1, name: /drafted to your body/i })).toBeVisible();
});

test('legal pages open from the footer mid-pattern, and Back returns there', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');

  await footer(page).getByRole('button', { name: 'Terms' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
  await footer(page).getByRole('button', { name: 'Privacy' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await main.getByRole('button', { name: 'Back' }).last().click();
  await expect(main.getByRole('heading', { level: 1, name: 'Style your skirt' })).toBeVisible();
});
