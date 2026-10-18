import { chooseChip, expect, expectStyle, fillStepPages, measureMe, openFresh, pickToMake, startWithExample, stepButton, switchGarment, test } from './fixtures';

// Every garment's style screen works the same way: Undo and Redo always in place, and the same save wording.
test('undo, redo and save read the same on the trousers as on the skirt', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Trousers');

  const wide = main.getByRole('group', { name: 'Leg', exact: true }).getByRole('button', { name: 'Wide', exact: true });
  const undo = main.getByRole('button', { name: 'Undo the last change' });
  const redo = main.getByRole('button', { name: 'Redo the change you undid' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await chooseChip(page, 'Leg', 'Wide');
  await undo.click();
  await expect(main.getByRole('status').filter({ hasText: 'Undone' })).toBeVisible();
  await expect(wide).toHaveAttribute('aria-pressed', 'false');
  await redo.click();
  await expect(main.getByRole('status').filter({ hasText: 'Redone' })).toBeVisible();
  await expect(wide).toHaveAttribute('aria-pressed', 'true');
  await expect(redo).toBeDisabled();

  await expect(main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: 'Pieces', exact: true })).toBeVisible();
  await main.getByRole('button', { name: 'Save pattern' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Saved to your patterns' })).toBeVisible();
});

// A first-timer is in the simple view, and can still start a skirt from a photo.
test('a new sewist sees Start from a photo', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  await fillStepPages(page);
  await expectStyle(page, 'Skirt');
  await expect(main.getByRole('button', { name: 'Show all tools' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Start from a photo' })).toBeVisible();
});

// A measurement that fails a check is caught: a bust in the wrong unit on its own page, and two that
// disagree (waist to knee longer than waist to floor) on the measurements list, never a loop back through the guided pages.
test('a wrong measurement is explained, not looped', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  const box = main.getByRole('textbox');
  const next = () => main.getByRole('button', { name: /^(Next|Done)\b/ }).click();
  // Print in the header waits for the measurements, and says so.
  await stepButton(page, 'Print').click();
  await expect(page.getByRole('status').filter({ hasText: /Measure first: the skirt needs a few more measurements before it can be printed/ })).toBeVisible();
  await box.fill('9');
  await next();
  await expect(main.getByText(/Full bust should be between/)).toBeVisible();
  for (const v of ['92', '76', '102', '72']) {
    await box.fill(v);
    await next();
  }
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  for (const v of ['20.5', '74']) {
    await box.fill(v);
    await main.getByRole('button', { name: /^Next/ }).click();
  }
  await expect(main.getByRole('heading', { level: 1, name: 'Your skirt measurements' })).toBeVisible();
  await expect(main.getByRole('status').filter({ hasText: /Waist to knee should be shorter than waist to floor/ })).toBeVisible();
});

// A first dress asks only the essentials; the harder upper-body measurements wait for "a closer fit".
test('a first dress asks five more measurements, not thirteen', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Dress');
  await expect(main.getByRole('heading', { level: 1, name: 'Your high bust' })).toBeVisible();
  await expect(main.locator('.dots .dot')).toHaveCount(5);
  await fillStepPages(page);
  await expectStyle(page, 'Dress');
  await main.getByRole('button', { name: 'Edit measurements' }).click();
  await expect(main.getByRole('button', { name: 'Add measurements for a closer fit' })).toBeVisible();
});

// The skirt uses the same Undo and Redo, and a new change clears what could be redone.
test('a new change on the skirt clears redo', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const undo = main.getByRole('button', { name: 'Undo the last change' });
  const redo = main.getByRole('button', { name: 'Redo the change you undid' });
  await expect(undo).toBeDisabled();
  await chooseChip(page, 'Fit', 'Relaxed');
  await undo.click();
  await expect(redo).toBeEnabled();
  await chooseChip(page, 'Fit', 'Relaxed');
  await expect(redo).toBeDisabled();
  await expect(undo).toBeEnabled();
});
