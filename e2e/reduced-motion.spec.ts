import { fillStepPages, goPrint, measureMe, openFresh, startWithExample, test, expect } from './fixtures';

// With less motion asked for, every animation finishes at once: measuring and printing still carry on (2026-10-23).
test.use({ reducedMotion: 'reduce' });
test('reduced motion: measuring through to the check page', async ({ page }) => {
  await openFresh(page);
  await page.getByRole('main').getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await expect(page.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
});
test('reduced motion: example to print', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
});
