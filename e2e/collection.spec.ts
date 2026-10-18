import { expect, expectStyle, openGroup, startWithExample, test } from './fixtures';

test('the Maison collection: open it from styling, draw every look, make one', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'The collection' })).toBeVisible();
  // Every look is drawn flat, front and back.
  const looks = main.getByRole('listitem');
  await expect(looks).toHaveCount(13);
  await expect(main.getByRole('img', { name: /Technical flat/ })).toHaveCount(13);

  // Making Plissé opens the skirt with its knife pleats chosen.
  await looks.filter({ has: page.getByRole('heading', { name: 'Plissé' }) }).getByRole('button', { name: 'Make this look' }).click();
  await expectStyle(page, 'Skirt');
  await expect((await openGroup(page, 'Details')).getByRole('button', { name: 'Knife pleats' })).toHaveAttribute('aria-pressed', 'true');
});

test('the collection: the next drop opens as a sign-up, and the Archive shows its records', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  // Drop 01 has no date yet: a gold strip and the drop alert sign-up, with the edition shown as printed.
  await expect(main.getByText('Date soon')).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Get the drop alert' })).toBeVisible();
  await expect(main.getByText('No. 0127/600')).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/house-${test.info().project.name}.png`, fullPage: false });

  await main.getByRole('group', { name: 'Collection' }).getByRole('button', { name: 'Archive' }).click();
  const records = main.getByRole('list', { name: 'The Archive' }).getByRole('listitem');
  await expect(records).toHaveCount(4);
  await expect(records.first()).toContainText('ARC · 1954 · 001');
  await expect(records.first()).toContainText('To be announced');
  // Nothing can be made until a source is licensed; the sign-up counts who wants it.
  await expect(main.getByRole('button', { name: 'Make this cut' })).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Tell me when the Archive opens' })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/archive-${test.info().project.name}.png`, fullPage: true });
});
