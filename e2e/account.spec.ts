import { download, expect, expectStyle, fillStepPages, measureMe, openAccount, openFold, openFresh, openReview, startWithExample, stepButton, test } from './fixtures';

test('account: save a pattern, rename it, back up, delete it, restore', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');

  await openReview(page);
  await main.getByRole('button', { name: 'Save this pattern' }).click();
  await main.getByRole('button', { name: 'Saved patterns' }).click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();

  const saved = main.getByRole('region', { name: 'Saved patterns' });
  const rows = saved.getByRole('listitem');
  await expect(rows).toHaveCount(1);

  // Rename
  await rows.first().getByRole('button', { name: /^More for / }).click();
  await rows.first().getByRole('button', { name: 'Rename' }).click();
  const name = rows.first().getByRole('textbox', { name: 'Pattern name' });
  await name.fill('Wedding guest skirt');
  await name.press('Enter');
  await expect(rows.first()).toContainText('Wedding guest skirt');

  // Back up: a JSON file holding the pattern and the measurements.
  await openFold(page, 'Your data');
  const backup = await download(page, main.getByRole('button', { name: 'Download a backup' }), info);
  expect(backup.download.suggestedFilename()).toMatch(/^pattern-maker-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(backup.bytes.toString('utf8'));
  expect(data.app).toBe('pattern-maker');
  expect(JSON.stringify(data.account)).toContain('Wedding guest skirt');
  expect(JSON.stringify(data.account)).toContain('"waist":62');

  // Delete
  await rows.first().getByRole('button', { name: /^More for / }).click();
  await rows.first().getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(0);
  await expect(saved).toContainText('Nothing saved yet');

  // Restore from the backup brings it back, and it opens.
  await main.getByLabel('Restore').setInputFiles(backup.path);
  await expect(main.getByRole('status').filter({ hasText: 'Restored from your backup' })).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Wedding guest skirt');
  await rows.first().getByRole('button', { name: 'Open' }).click();
  await expectStyle(page, 'Skirt');
});

// A top or dress made from the collection with only the first measuring pages taken was drawn in Saved patterns
// from those numbers alone, with no estimates for the rest of the upper body, so it drew as nothing and the browser
// logged NaN in the drawing (tester personas, Nov 15). The console check fails this test on any such error.
test('a dress made after the first measuring pages still draws in Saved patterns', async ({ page }) => {
  const main = page.getByRole('main');
  await openFresh(page);
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await main.getByRole('button', { name: 'The collection ›' }).click();
  await main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Blush Shift', exact: true }) }).getByRole('button', { name: 'Make this look', exact: true }).click();
  // The dress asks for the upper body measurements it needs, as a tester is asked.
  await fillStepPages(page);
  await expect(main.getByRole('button', { name: 'Change a detail' })).toBeVisible({ timeout: 30_000 });
  // Printing keeps it in Saved patterns.
  await stepButton(page, 'Print').click();
  const dl = main.getByRole('button', { name: /^Download pattern/ });
  await expect(dl).toBeEnabled({ timeout: 60_000 });
  const got = page.waitForEvent('download');
  await dl.click();
  await got;
  await openAccount(page);
  const row = main.getByRole('region', { name: 'Saved patterns' }).getByRole('listitem').first();
  await expect(row.getByRole('img', { name: /^Technical flat of the / })).toBeVisible();
  await expect(row.locator('svg.techflat path').first()).toBeAttached();
});
