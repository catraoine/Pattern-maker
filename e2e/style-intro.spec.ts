import { expect, expectStyle, openFresh, openLengthStep, skipToExample, test } from './fixtures';

// How styling works (Cat's A, Nov 14): a screen of its own the first time Style's questions open, then never again.
test('the first Style shows how styling works once, then the questions', async ({ page }) => {
  // This visitor hasn't seen it (the other tests have).
  await page.addInitScript(() => localStorage.removeItem('maison-trace-style-intro'));
  await openFresh(page);
  await skipToExample(page);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: /How styling works/ })).toBeVisible();
  await expect(main.getByRole('listitem')).toHaveCount(4);
  await expect(main.getByText('Tap an option card', { exact: true })).toBeVisible();
  await expect(main.getByText('The next screens take you through styling your skirt, one choice at a time.')).toBeVisible();
  const start = main.getByRole('button', { name: 'Start styling' });
  await expect(start).toBeInViewport();
  await start.click();
  await expectStyle(page, 'Skirt');
  expect(await page.evaluate(() => localStorage.getItem('maison-trace-style-intro'))).toBe('1');
});

// DQ walk, Nov 20: "Drag the dot, or tap the length to type it" showed on no piece. The hint watched the page for the
// length label only from Style's first opening, which for anyone new was this screen, with no drawing to watch.
test('after how styling works, the length hint shows', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('maison-trace-style-intro'));
  await openFresh(page);
  await skipToExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Start styling' }).click();
  await expectStyle(page, 'Skirt');
  for (let i = 0; i < 8 && !(await main.getByRole('button', { name: 'Type the skirt length' }).count()); i++) await main.getByRole('button', { name: /^Next/ }).first().click();
  await expect(main.getByRole('button', { name: 'Type the skirt length' })).toBeAttached();
  // Shown where the length is asked, not over every question (declutter, Cat's E, Nov 21).
  await openLengthStep(page);
  await expect(main.getByText('Drag the dot, or tap the length to type it.')).toBeVisible();
});
