import type { Page } from '@playwright/test';
import { expect, expectStyle, fillStepPages, goPrint, headerBack, measureMe, openFresh, openLooks, pickToMake, skipLoading, startWithExample, stepButton, test } from './fixtures';

// Back climbs a fixed ladder (Cat's B Fixed Ladder, 2026-10-24): Print, Style, Measurements, Welcome, however
// the sewist got there, so it never walks back through measuring or ping-pongs between two screens.

const main = (page: Page) => page.getByRole('main');
const h1 = (page: Page, name: string | RegExp) => main(page).getByRole('heading', { level: 1, name });
const measurements = (page: Page) => expect(h1(page, 'Your measurements')).toBeVisible();
const welcome = (page: Page) => expect(main(page).getByText('Welcome back')).toBeVisible();

test('after measuring, back from Style goes to the measurements list, not through every page', async ({ page }) => {
  test.setTimeout(150_000);
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Dress');
  await fillStepPages(page);
  await expectStyle(page, 'Dress');

  // On to a later step, then Print: back comes to Style on the step that was open.
  await main(page).getByRole('button', { name: /^Next: / }).click();
  const step = await page.getByRole('tab', { selected: true }).textContent();
  await goPrint(page);
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();
  await headerBack(page).click();
  await expectStyle(page, 'Dress');
  await expect(page.getByRole('tab', { selected: true })).toHaveText(step!);

  await page.goBack();
  await measurements(page);
  await headerBack(page).click();
  await welcome(page);
});

test('hopping between screens never makes back ping-pong', async ({ page }) => {
  test.setTimeout(150_000);
  await startWithExample(page);
  // The collection's own "Back to styling", then back: up to the measurements, not into the collection again.
  await openLooks(page);
  await main(page).getByRole('button', { name: /Start from the Maison collection/ }).click();
  await expect(h1(page, /collection/i)).toBeVisible();
  await main(page).getByRole('button', { name: 'Back to styling' }).click();
  await expectStyle(page, 'Skirt');

  // Measure, Print, Measure, Print from the header: back still climbs one rung at a time.
  await stepButton(page, 'Measure').click();
  await measurements(page);
  await stepButton(page, 'Print').click();
  await stepButton(page, 'Measure').click();
  await stepButton(page, 'Print').click();
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();

  await headerBack(page).click();
  await expectStyle(page, 'Skirt');
  await headerBack(page).click();
  await measurements(page);
  await headerBack(page).click();
  await welcome(page);
});

test('back on the enlarged drawing makes it smaller and stays on Style', async ({ page }) => {
  await startWithExample(page);
  const preview = main(page).getByRole('region', { name: 'Preview' });
  await main(page).getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await expect(preview).toHaveClass(/live-big/);
  await page.goBack();
  await expect(preview).not.toHaveClass(/live-big/);
  await expectStyle(page, 'Skirt');
  // Smaller takes the enlarged step off too: back then leaves Style for the measurements.
  await main(page).getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await expect(preview).toHaveClass(/live-big/);
  await main(page).getByRole('button', { name: /^Make the drawing .* smaller$/ }).click();
  await expect(preview).not.toHaveClass(/live-big/);
  await page.goBack();
  await measurements(page);
});

test('after a reload, back from the welcome leaves rather than reopening old pages', async ({ page, consoleErrors }) => {
  // Leaving for a blank page, the test's own storage setup can't run there.
  consoleErrors.allow(/localStorage/);
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await main(page).getByRole('textbox').fill('76');
  await main(page).getByRole('button', { name: 'Next' }).click();
  await page.reload();
  await skipLoading(page);
  await expect(h1(page, /sewing patterns for the piece/i)).toBeVisible();
  await page.goBack();
  await expect.poll(() => page.url()).not.toContain('localhost');
});
