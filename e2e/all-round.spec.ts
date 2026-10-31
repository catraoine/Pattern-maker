import { GarmentName, chooseChip, expect, goTab, startWithExample, switchGarment, test } from './fixtures';

// All round: the skirt turning on the form, with its seams, hem and stripes as plain facts.
test('all round shows the skirt on the form, with its seams and hem all the way round', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
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
    await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
    await expect(main.getByRole('img', { name: /on your form, turning/ })).toBeVisible();
    await expect(main.getByText(seams)).toBeVisible();
    await expect(main.getByText('Shape preview, not a cloth simulation')).toBeVisible();
    await expect(main.getByText(/problem|fix/i)).toHaveCount(0);
  }
});

// In the maker's fabric (Cat, 2026-10-26): with a print picked, the garment turns in it, the jade python of the
// one-way swatch wrapped round it; with none, it stays in lines.
test('all round shows the garment in the fabric picked', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const tealAt = async () =>
    main.locator('canvas.all-round-canvas').evaluate((cv: HTMLCanvasElement) => {
      const g = cv.getContext('2d')!;
      // Across the middle of the skirt: count cloth that is more green-blue than gold.
      const y = Math.round(cv.height * 0.45);
      const d = g.getImageData(0, y, cv.width, 1).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 60 && d[i + 2] > d[i] + 20) n++;
      return n;
    });
  const round = main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true });
  await round.click();
  await page.waitForTimeout(400);
  expect(await tealAt()).toBe(0);
  await goTab(page, 'Fabric');
  await main.locator('.fabric-more > summary').click();
  await main.getByRole('radiogroup', { name: "What's printed on your fabric" }).getByRole('radio', { name: 'One-way' }).click();
  await round.click();
  await expect.poll(tealAt).toBeGreaterThan(40);
});
