import { expect, expectStyle, openFresh, skipToExample, test } from './fixtures';

// How styling works (Cat's A, Nov 14): a screen of its own the first time Style's questions open, then never again.
test('the first Style shows how styling works once, then the questions', async ({ page }) => {
  // This visitor hasn't seen it (the other tests have).
  await page.addInitScript(() => localStorage.removeItem('maison-trace-style-intro'));
  await openFresh(page);
  await skipToExample(page);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: /How styling works/ })).toBeVisible();
  await expect(main.getByRole('listitem')).toHaveCount(4);
  await expect(main.getByText('The next screens take you through styling your skirt, one choice at a time.')).toBeVisible();
  const start = main.getByRole('button', { name: 'Start styling' });
  await expect(start).toBeInViewport();
  await start.click();
  await expectStyle(page, 'Skirt');
  expect(await page.evaluate(() => localStorage.getItem('maison-trace-style-intro'))).toBe('1');
});
