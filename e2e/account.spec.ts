import { download, expect, expectStyle, openReview, startWithExample, test } from './fixtures';

test('account: save a pattern, rename it, back up, delete it, restore', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');

  await openReview(page);
  await main.getByRole('button', { name: 'Save pattern' }).click();
  await main.getByRole('button', { name: 'your patterns' }).click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();

  const saved = main.getByRole('region', { name: 'Saved patterns' });
  const rows = saved.getByRole('listitem');
  await expect(rows).toHaveCount(1);

  // Rename
  await rows.first().getByRole('button', { name: 'Rename' }).click();
  const name = rows.first().getByRole('textbox', { name: 'Pattern name' });
  await name.fill('Wedding guest skirt');
  await name.press('Enter');
  await expect(rows.first()).toContainText('Wedding guest skirt');

  // Back up: a JSON file holding the pattern and the measurements.
  const backup = await download(page, main.getByRole('button', { name: 'Download a backup' }), info);
  expect(backup.download.suggestedFilename()).toMatch(/^pattern-maker-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(backup.bytes.toString('utf8'));
  expect(data.app).toBe('pattern-maker');
  expect(JSON.stringify(data.account)).toContain('Wedding guest skirt');
  expect(JSON.stringify(data.account)).toContain('"waist":76');

  // Delete
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
