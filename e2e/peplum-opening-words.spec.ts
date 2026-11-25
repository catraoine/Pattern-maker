import { expect, openCollection, startWithExample, test } from './fixtures';

// The Ice Peplum closes with buttons and loops down the back, as its pattern and booklet say, but Style named its
// opening "Back zip": a tester buying notions from Style would buy a zip (EG walk, Nov 24).
test('the Ice Peplum Top names its opening as buttons and loops', async ({ page }, info) => {
  test.setTimeout(3 * 60_000);
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  const card = main.getByRole('listitem').filter({ hasText: 'Ice Peplum Top' }).first();
  await card.getByRole('button', { name: /^Make the top|^Make this look/i }).first().click();
  const change = main.getByRole('button', { name: 'Change a detail' });
  await expect(change).toBeVisible({ timeout: 30_000 });
  await change.click();
  const loops = main.getByRole('button', { name: /^Back buttons and loops\b/ });
  for (let i = 0; i < 20 && !(await loops.isVisible()); i++) {
    const opening = main.getByRole('button', { name: /^Opening\b/ });
    if (info.project.name !== 'phone' && (await opening.count())) await opening.first().click();
    else await page.getByRole('button', { name: /^Next\b/ }).last().click();
  }
  await expect(loops).toBeVisible();
  await expect(main.getByRole('button', { name: /^Back zip\b/ })).toHaveCount(0);
});
