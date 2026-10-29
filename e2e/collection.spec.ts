import { expect, expectStyle, openGroup, openLooks, startWithExample, test } from './fixtures';

test('the Maison collection: open it from styling, draw every look, make one', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'The collection' })).toBeVisible();
  // Every look is drawn flat, front and back.
  const looks = main.getByRole('listitem');
  await expect(looks).toHaveCount(10);
  await expect(main.getByRole('img', { name: /Technical flat/ })).toHaveCount(10);
  // The House shows one season at a time.
  await expect(main.getByText('SS27 · Spring Summer 2027')).toBeVisible();

  // Making Olive Pleat opens the skirt with its knife pleats chosen.
  await looks.filter({ has: page.getByRole('heading', { name: 'Olive Pleat' }) }).getByRole('button', { name: 'Make this look' }).click();
  await expectStyle(page, 'Skirt');
  await expect((await openGroup(page, 'Details')).getByRole('button', { name: 'Knife pleats' })).toHaveAttribute('aria-pressed', 'true');
});

test('the collection: the next drop stays hidden until it has a piece, and the Archive shows its records', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  // Drop 01 has no piece yet, so it stays hidden: no strip and no sign-up (Cat, 2026-10-29).
  await expect(main.getByText('Date soon')).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Get the drop alert' })).toHaveCount(0);
  await main.getByRole('group', { name: 'Collection' }).getByRole('button', { name: 'Archive' }).click();
  const records = main.getByRole('list', { name: 'The Archive' }).getByRole('listitem');
  await expect(records).toHaveCount(14);
  await expect(records.first()).toContainText('ARC · 1954 · 001');
  await expect(records.first()).toContainText('To be announced');
  // A history cut can't be made until its source is licensed; the sign-up counts who wants it. Last season's
  // house looks are the house's own, so each of those can be made.
  await expect(records.first().getByRole('button', { name: 'Make this cut' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Make this cut' })).toHaveCount(10);
  await expect(records.filter({ hasText: 'Tailleur' })).toContainText('Maison Tracé, AW26');
  await expect(main.getByRole('heading', { name: 'Tell me when the Archive opens' })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/archive-${test.info().project.name}.png`, fullPage: true });
});
