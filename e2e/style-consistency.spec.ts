import { chooseChip, expect, expectStyle, fillStepPages, openFresh, pickToMake, startWithExample, switchGarment, test } from './fixtures';

// Every garment's style screen works the same way: Undo after a change, and the same save wording.
test('undo and save read the same on the trousers as on the skirt', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Trousers');

  const wide = main.getByRole('group', { name: 'Leg', exact: true }).getByRole('button', { name: 'Wide', exact: true });
  await expect(main.getByRole('button', { name: 'Undo the last change' })).toHaveCount(0);
  await chooseChip(page, 'Leg', 'Wide');
  await main.getByRole('button', { name: 'Undo the last change' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Undone' })).toBeVisible();
  await expect(wide).toHaveAttribute('aria-pressed', 'false');

  await expect(main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: 'Pieces', exact: true })).toBeVisible();
  await main.getByRole('button', { name: 'Save pattern' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Saved to your patterns' })).toBeVisible();
});

// A first-timer is in the simple view, and can still start a skirt from a photo.
test('a new sewist sees Start from a photo', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await main.getByRole('button', { name: 'Start measuring' }).click();
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  await fillStepPages(page);
  await expectStyle(page, 'Skirt');
  await expect(main.getByRole('button', { name: 'Show all tools' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Start from a photo' })).toBeVisible();
});
