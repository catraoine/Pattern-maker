import { expect, expectStyle, openLooks, startWithExample, test } from './fixtures';

test('the Eras shelf: each era as a whole line, and a piece made from it', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  await main.getByRole('group', { name: 'Collection' }).getByRole('button', { name: 'Eras' }).click();
  // The 1950s line: its three skirt looks, then a blouse, a dress and a trouser, every one drawn flat.
  await main.getByRole('group', { name: 'Era' }).getByRole('button', { name: '1950s' }).click();
  const line = main.getByRole('list', { name: 'The 1950s line' });
  await expect(line.getByRole('listitem')).toHaveCount(6);
  await expect(line.getByRole('img', { name: /Technical flat/ })).toHaveCount(6);
  if (process.env.SHOTS)
    for (const era of ['Edwardian', '1920s', '1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s']) {
      await main.getByRole('group', { name: 'Era' }).getByRole('button', { name: era }).click();
      const items = main.getByRole('list', { name: `The ${era} line` }).getByRole('listitem');
      for (let i = 0; i < (await items.count()); i++) await items.nth(i).screenshot({ path: `${process.env.SHOTS}/${era}-${i + 1}.png` });
    }
  await main.getByRole('group', { name: 'Era' }).getByRole('button', { name: '1950s' }).click();
  await line.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Wiggle dress' }) }).getByRole('button', { name: 'Make this look' }).click();
  await expectStyle(page, 'Dress');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(saved.dress).toMatchObject({ fit: 'fitted', bodice: { neckline: 'square' }, skirt: { silhouette: 'pencil', length: 'knee' } });
});
