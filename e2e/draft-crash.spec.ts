import { chooseChip, expect, expectStyle, startWithExample, test } from './fixtures';

// A saved choice the engine trips on (here a skirt fit that no longer exists) puts the garment back to its
// standard choices, and the maker is told, so she checks her picks before printing (code health check, Nov 11).
test('a design that cannot be drawn goes back to the standard choices, and says so', async ({ page }) => {
  await startWithExample(page);
  await page.evaluate(() => {
    const key = 'pattern-maker:skirt';
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...saved, choices: { ...saved.choices, fit: 'no-such-fit' } }));
  });
  await page.reload();
  await expectStyle(page, 'Skirt');
  await expect(page.getByRole('main').getByText("Your skirt couldn't be drawn with the choices it had")).toBeVisible();
  const fit = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}').choices.fit);
  expect(fit).not.toBe('no-such-fit');
  // Her next pick ends the note, so the drawing has the window to itself again.
  await chooseChip(page, 'Fit', 'Relaxed');
  await expect(page.getByRole('main').getByText("Your skirt couldn't be drawn")).toHaveCount(0);
});
