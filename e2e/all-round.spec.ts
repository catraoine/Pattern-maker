import { chooseChip, expect, startWithExample, test } from './fixtures';

// All round: the skirt turning on the form, with its seams, hem and stripes as plain facts.
test('all round shows the skirt on the form, with its seams and hem all the way round', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: 'All round', exact: true }).click();
  await expect(main.getByRole('img', { name: /on your form, turning/ })).toBeVisible();
  await expect(main.getByText(/All 3 seams and \d+ darts meet at the waist and the hem/)).toBeVisible();
  await expect(main.getByText('Shape preview, not a cloth simulation')).toBeVisible();

  // A high-low hem reads shorter at the front than at the back, and nothing is flagged.
  await chooseChip(page, 'Hem', 'High-low');
  const hem = main.getByRole('button', { name: /^Hem \d/ });
  await expect(hem).toContainText(/\d+ cm at the front, \d+ at the sides, \d+ at the back/);
  await hem.click();
  await expect(main.getByText(/problem|fix/i)).toHaveCount(0);
});
