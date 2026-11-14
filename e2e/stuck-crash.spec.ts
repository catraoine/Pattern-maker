import { expect, startWithExample, test } from './fixtures';

// A design choice the app no longer knows (an option taken out in a later release) can stop the app opening at all,
// and Reload lands back on "Something went wrong" every time. "Reset my designs" puts the designs back to their
// standard choices and keeps the measurements (code health check, Nov 13).
test('a saved choice the app no longer knows: Reset my designs gets back in, measurements kept', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/no-such-length|reading '1'|The above error occurred|recreate this component tree/);
  await startWithExample(page);
  const account = await page.evaluate(() => localStorage.getItem('pattern-maker:account'));
  await page.evaluate(() => {
    const key = 'pattern-maker:skirt';
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...saved, choices: { ...saved.choices, length: 'no-such-length' } }));
  });
  await page.reload();
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible();
  // Reload alone comes straight back here.
  await main.getByRole('button', { name: 'Reload' }).click();
  await expect(main.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible();
  await main.getByRole('button', { name: 'Reset my designs' }).click();
  await expect(main.getByRole('heading', { name: 'Something went wrong.' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pattern-maker:account'))).toBe(account);
  await expect(main.getByText('Welcome back').or(page.getByRole('heading', { name: /Style your skirt/ }))).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}').choices?.length)).not.toBe('no-such-length');
});
