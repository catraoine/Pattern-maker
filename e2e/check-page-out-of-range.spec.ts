import { expect, fillStepPages, headerBack, measureMe, openFresh, test } from './fixtures';

// A height out of range is refused by Next but kept as typed, so leaving the page leaves it on "Do these look right?".
// That page showed it as a plain number with no word on it, and a fresh reader carried on (cold read of release EF,
// Nov 24): its row now says Check, the reason shows, and the button opens it.
test('an out-of-range number on "Do these look right?" is marked, explained and one tap away', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await expect(main.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
  const list = main.getByRole('list', { name: 'Tap one to change it' });
  await list.getByRole('button', { name: /^Height/ }).click();
  const box = main.getByRole('textbox').first();
  await box.fill('66');
  await box.press('Enter');
  await expect(main.getByText(/can be from/).first()).toBeVisible();
  await headerBack(page).click();
  await expect(main.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
  await expect(list.getByRole('button', { name: /^Height Check$/ })).toBeVisible();
  await expect(main.locator('.msg.error')).toContainText(/can be from/);
  await expect(main.getByRole('button', { name: 'Choose what to make' })).toHaveCount(0);
  await main.getByRole('button', { name: 'Check height' }).click();
  await expect(main.getByRole('textbox').first()).toBeVisible();
});

// A bust of 300 cm passed as an ordinary row while the good hip and waist were asked "Was it measured in inches?",
// which could lead a tester to make two good numbers wrong (EF walk, Nov 24). Only the impossible one is spoken of.
test('an impossible bust on "Do these look right?" is the one named, not the good numbers beside it', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  const list = main.getByRole('list', { name: 'Tap one to change it' });
  await list.getByRole('button', { name: /^Bust/ }).click();
  const box = main.getByRole('textbox').first();
  await box.fill('300');
  await box.press('Enter');
  await headerBack(page).click();
  await expect(list.getByRole('button', { name: /^Bust Check$/ })).toBeVisible();
  await expect(main.locator('.msg.error')).toContainText(/can be from/);
  await expect(main.getByText(/in inches/)).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Check bust' })).toBeVisible();
});
