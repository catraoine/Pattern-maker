import type { Page } from '@playwright/test';
import { expect, goPrint, showAllTools, startWithExample, test } from './fixtures';

// Describe your toile in your own words (Cat, Nov 28): the reader's answer is stood in for here, so the walk checks
// what the page does with it. Nothing is ticked until the person confirms, and they set the amounts.

const main = (page: Page) => page.getByRole('main');

async function openFitting(page: Page, answer: object) {
  await page.route('**/.netlify/functions/describe-fit', (route) => route.fulfill({ json: answer }));
  await startWithExample(page);
  await goPrint(page);
  const all = await showAllTools(page);
  if (await all.count()) await all.click();
  await main(page).getByRole('button', { name: 'I’ve tried on my toile' }).click();
  await main(page).getByLabel(/^Describe it in your own words/).fill('Folds under the waistband at the back, and my sleeves are tight');
  await main(page).getByRole('button', { name: 'Find the problems' }).click();
}

test('a described toile ticks the matching problems only once confirmed', async ({ page }) => {
  await openFitting(page, { ok: true, reading: { matches: [{ id: 'skirt-sway-back', side: null }], notCovered: ['tight sleeves'] } });
  const found = main(page).locator('.describe-fit-found');
  await expect(found).toContainText('Folds below the back waist');
  await expect(found).toContainText("The app can't correct tight sleeves yet");
  // Found, but not ticked in the list yet.
  const row = main(page).locator('.issue').filter({ hasText: 'Folds below the back waist' });
  await expect(row.getByRole('checkbox')).not.toBeChecked();
  await expect(main(page).getByRole('button', { name: 'No changes yet' })).toBeVisible();

  await found.getByRole('button', { name: 'Tick this one' }).click();
  await expect(row.getByRole('checkbox')).toBeChecked();
  await expect(row.getByRole('group', { name: /^How much/ })).toContainText('1.5 cm');
  await expect(main(page).getByText('Ticked in the list below.')).toBeVisible();
  await expect(main(page).getByRole('button', { name: /^Save as version 2$/ })).toBeEnabled();
});

test('a description that matches nothing says so kindly and points to the list', async ({ page }) => {
  await openFitting(page, { ok: true, reading: { matches: [], notCovered: [] } });
  await expect(main(page).locator('.describe-fit-found')).toContainText('Nothing on the list quite matches that yet');
  await main(page).getByRole('button', { name: 'Try again' }).click();
  await expect(main(page).getByRole('button', { name: 'Find the problems' })).toBeVisible();
});
