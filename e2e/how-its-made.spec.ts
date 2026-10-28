import { expect, openAccount, openLooks, startWithExample, test } from './fixtures';

// Sewists know "AI patterns" as untested junk, so the app says plainly where AI is and isn't (Cat's AI stance, 2026-10-28).
test('"How your pattern is made" opens from the photo screen and Your account', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const made = main.getByRole('heading', { level: 1, name: 'Drafted, not generated' });

  await openLooks(page);
  await main.getByRole('button', { name: 'Start from a photo' }).click();
  await expect(main.getByText('We use AI to read the style from your photo. You check it, then we draft.')).toBeVisible();
  await main.getByRole('button', { name: 'How your pattern is made' }).click();
  await expect(made).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Is this an AI pattern?' })).toBeVisible();
  await page.goBack();
  await expect(main.getByRole('heading', { name: 'Snap something you love.' })).toBeVisible();

  await openAccount(page);
  await main.getByRole('button', { name: 'How your pattern is made' }).click();
  await expect(made).toBeVisible();
});
