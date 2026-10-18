import { GarmentName, chooseChip, expect, startWithExample, switchGarment, test } from './fixtures';

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

// Not only skirts: every garment turns on the form, from the neck (or the waist) to the hem.
test('all round works for every garment', async ({ page }) => {
  test.setTimeout(120_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  const reads: [GarmentName, RegExp][] = [
    ['Bodice', /All \d+ seams and \d+ darts meet from the neck to the hem/],
    ['Dress', /All \d+ seams and \d+ darts meet from the neck to the hem/],
    ['Tee', /All \d+ seams meet from the neck to the hem/],
    ['Jacket', /All \d+ seams( and \d+ darts)? meet from the neck to the hem/],
    ['Coat', /All \d+ seams( and \d+ darts)? meet from the neck to the hem/],
    ['Trousers', /All 6 seams and \d+ darts meet from the waist to the hems/],
  ];
  for (const [g, seams] of reads) {
    await switchGarment(page, g);
    await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: 'All round', exact: true }).click();
    await expect(main.getByRole('img', { name: /on your form, turning/ })).toBeVisible();
    await expect(main.getByText(seams)).toBeVisible();
    await expect(main.getByText('Shape preview, not a cloth simulation')).toBeVisible();
    await expect(main.getByText(/problem|fix/i)).toHaveCount(0);
  }
});
