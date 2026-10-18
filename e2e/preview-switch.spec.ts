import { chooseChip, expect, startWithExample, switchGarment, test } from './fixtures';

// Two boxes say what each view shows; the fit is a switch on the pattern pieces, in plain words.
test('garment or pattern, and Show fit shades the pieces', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const look = main.getByRole('group', { name: 'Preview view' });
  await expect(look.getByRole('button', { name: /^Garment On your form/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'Back', exact: true })).toBeVisible();

  // The fit is one of the tools tucked away for a first pattern.
  await main.getByRole('button', { name: 'Show all tools' }).click();
  await look.getByRole('button', { name: /^Pattern Pieces to cut/ }).click();
  const fit = main.getByRole('switch', { name: 'Show fit' });
  await fit.click();
  await expect(fit).toHaveAttribute('aria-checked', 'true');
  const key = main.getByRole('list', { name: 'Key' });
  for (const word of ['Close', 'Comfy', 'Roomy']) await expect(key.getByText(word, { exact: true })).toBeVisible();
  // A skirt is never cut smaller than you.
  await expect(key.getByText('Held in')).toHaveCount(0);

  // A boned bodice is, on purpose, and says so.
  await switchGarment(page, 'Bodice');
  await chooseChip(page, 'Neckline', 'Strapless');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await main.getByRole('switch', { name: 'Show fit' }).click();
  await expect(main.getByRole('list', { name: 'Key' }).getByText('Held in', { exact: true })).toBeVisible();
  await expect(main.getByText('cut smaller than you on purpose, so the boning holds you.')).toBeVisible();
});
