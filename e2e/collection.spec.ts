import { expect, expectStyle, startWithExample, test } from './fixtures';

test('the Maison collection: open it from styling, draw every look, make one', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Or start from the Maison collection' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'The collection' })).toBeVisible();
  // Every look is drawn flat, front and back.
  const looks = main.getByRole('listitem');
  await expect(looks).toHaveCount(13);
  await expect(main.getByRole('img', { name: /Technical flat/ })).toHaveCount(13);

  // Making Plissé opens the skirt with its knife pleats chosen.
  await looks.filter({ has: page.getByRole('heading', { name: 'Plissé' }) }).getByRole('button', { name: 'Make this look' }).click();
  await expectStyle(page, 'Skirt');
  await expect(main.getByRole('group', { name: 'Details', exact: true }).getByRole('button', { name: 'Knife pleats' })).toHaveAttribute('aria-pressed', 'true');
});
