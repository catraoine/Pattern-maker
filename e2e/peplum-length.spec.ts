import { expect, openCollection, startWithExample, test } from './fixtures';

// On the Ice Peplum Top, picking Hip or Long took the peplum off without a word, so the tester's PDF was a plain top
// (pretend-tester walk, Nov 18). With a peplum on, the lengths it can't hang from are greyed, with the reason.
test('the Ice Peplum Top keeps its peplum: the longer lengths are greyed', async ({ page }, info) => {
  test.setTimeout(3 * 60_000);
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  const card = main.getByRole('listitem').filter({ hasText: 'Ice Peplum Top' }).first();
  await card.getByRole('button', { name: /^Make the top|^Make this look/i }).first().click();
  const change = main.getByRole('button', { name: 'Change a detail' });
  await expect(change).toBeVisible({ timeout: 30_000 });
  await change.click();
  const hip = main.getByRole('button', { name: /^Hip\b/ });
  for (let i = 0; i < 20 && !(await hip.isVisible()); i++) {
    const length = main.getByRole('button', { name: /^Length\b/ });
    if (info.project.name !== 'phone' && (await length.count())) await length.first().click();
    else await page.getByRole('button', { name: /^Next\b/ }).last().click();
  }
  await expect(hip).toBeDisabled();
  await expect(main.getByRole('button', { name: /^Long\b/ }).first()).toBeDisabled();
  await expect(main.getByRole('button', { name: /^High hip\b/ })).toBeEnabled();
  await expect(main.getByText('A peplum hangs from the waist, so the longer lengths step aside.')).toBeVisible();
});
