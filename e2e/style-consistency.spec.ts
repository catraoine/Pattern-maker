import { chooseChip, expect, expectStyle, fillStepPages, measureMe, openFresh, openPhoto, openReview, pickToMake, showAllTools, startWithExample, stepButton, switchGarment, test } from './fixtures';

// Every garment's style screen works the same way: no Undo or Redo on the questions, as a pick is changed by picking
// again (Cat, Nov 14: undo and redo are for the draw and drag tools), and the same save wording.
test('the questions have no undo or redo, and save reads the same on the trousers as on the skirt', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await switchGarment(page, 'Trousers');

  const wide = main.getByRole('group', { name: 'Leg', exact: true }).getByRole('button', { name: 'Wide', exact: true });
  await chooseChip(page, 'Leg', 'Wide');
  await expect(wide).toHaveAttribute('aria-pressed', 'true');
  // Not by the question, nor beside it on a computer: only the enlarged window keeps its own pair, for the hem dragged there.
  await expect(main.locator('button[aria-label="Undo the last change"]:visible')).toHaveCount(0);
  await expect(main.locator('button[aria-label="Redo the change you undid"]:visible')).toHaveCount(0);

  await expect(main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ })).toBeVisible();
  await openReview(page);
  await main.getByRole('button', { name: 'Save this pattern' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Saved in Saved patterns' })).toBeVisible();
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
  // The name's drop-down goes straight to the photo (Cat, Nov 12).
  await openPhoto(page);
  await expect(main.getByRole('heading', { name: 'Snap something you love.' })).toBeVisible();
  await page.goBack();
  await expectStyle(page, 'Skirt');
  await expect(await showAllTools(page)).toBeVisible();
});

// The name's drop-down is the four ways to start or find a piece (Cat's pick, Nov 12), not the list of garments; each
// goes where it says.
test('the garment drop-down offers a new garment, the collection, a photo and saved patterns', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const drop = main.getByRole('group', { name: 'Garment' });
  const open = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await drop.locator('.drop-button').click();
  };
  await open();
  await expect(drop.getByRole('menuitemradio')).toHaveText(['Start a new garment ›', 'The collection ›', 'Start from a photo ›', 'Saved patterns ›']);
  await drop.getByRole('menuitemradio', { name: 'The collection ›' }).click();
  await expect(main.getByRole('heading', { name: 'Leopard Shirt Dress' })).toBeVisible();
  await page.goBack();
  await expectStyle(page, 'Skirt');
  await open();
  await drop.getByRole('menuitemradio', { name: 'Saved patterns ›' }).click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
  await page.goBack();
  await expectStyle(page, 'Skirt');
  await open();
  await drop.getByRole('menuitemradio', { name: 'Start a new garment ›' }).click();
  await expect(main.getByRole('heading', { name: 'What would you like to make?' })).toBeVisible();
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
  await expect(page.getByRole('status').filter({ hasText: /Style and Print open once your measurements are in/ })).toBeVisible();
  // The waist comes first; the bust in the wrong unit is caught on its own page.
  await box.fill('76');
  await next();
  await box.fill('9');
  await next();
  await expect(main.getByText(/Full bust should be between/)).toBeVisible();
  for (const v of ['92', '102', '72', '165']) {
    await box.fill(v);
    await next();
  }
  // Weight is optional, on its own page after the base set.
  await main.getByRole('button', { name: 'Skip this step' }).click();
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  for (const v of ['20.5', '74']) {
    await box.fill(v);
    await main.getByRole('button', { name: /^Next/ }).click();
  }
  await expect(main.getByRole('heading', { level: 1, name: 'Your measurements' })).toBeVisible();
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
  expect(await fillStepPages(page)).toBe(5);
  await expectStyle(page, 'Dress');
  await openReview(page);
  await main.getByRole('button', { name: 'Edit measurements' }).click();
  await expect(main.getByRole('button', { name: /more for a closer fit$/ })).toBeVisible();
});

// The enlarged window's Undo and Redo: a new change clears what could be redone.
test('a new change on the skirt clears redo in the enlarged window', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const enlarge = () => main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  const undo = page.locator('.big-undo').getByRole('button', { name: 'Undo the last change' });
  const redo = page.locator('.big-undo').getByRole('button', { name: 'Redo the change you undid' });
  await chooseChip(page, 'Fit', 'Relaxed');
  await enlarge();
  await undo.click();
  await expect(redo).toBeEnabled();
  await page.keyboard.press('Escape');
  await chooseChip(page, 'Fit', 'Relaxed');
  await enlarge();
  await expect(redo).toBeDisabled();
  await expect(undo).toBeEnabled();
});
