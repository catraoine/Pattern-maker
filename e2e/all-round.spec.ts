import { GarmentName, chooseChip, expect, goTab, startWithExample, switchGarment, test } from './fixtures';

// All round: the skirt turning on the form, its checks folded into one quiet line (Cat's Q2 Quiet in Calico).
test('all round shows the skirt on the form, with its seams and hem checked in one quiet line', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  await expect(main.getByRole('img', { name: /on your form, turning/ })).toBeVisible();
  await expect(main.getByText('Seams and hem checked', { exact: true })).toBeVisible();
  await expect(main.getByText('A shape preview, not a cloth simulation.')).toBeVisible();
  // No hem chart under the form: its CF / Left / CB / Right labels were drawn on the canvas, so the figure fills it.

  // A high-low hem is still checked, and nothing is flagged.
  await chooseChip(page, 'Hem', 'High-low');
  await expect(main.getByText('Seams and hem checked', { exact: true })).toBeVisible();
  await expect(main.getByText(/problem|fix/i)).toHaveCount(0);
});

// Not only skirts: every garment turns on the form, from the neck (or the waist) to the hem.
test('all round works for every garment', async ({ page }) => {
  test.setTimeout(120_000);
  await startWithExample(page);
  const main = page.getByRole('main');
  const seams = /^Seams, hem and sleeves checked$|^Seams and hem checked$/;
  const reads: GarmentName[] = ['Bodice', 'Dress', 'Tee', 'Jacket', 'Coat', 'Trousers'];
  for (const g of reads) {
    await switchGarment(page, g);
    await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
    await expect(main.getByRole('img', { name: /on your form, turning/ })).toBeVisible();
    await expect(main.getByText(seams)).toBeVisible();
    await expect(main.getByText('A shape preview, not a cloth simulation.')).toBeVisible();
    await expect(main.getByText(/problem|fix/i)).toHaveCount(0);
  }
});

// In the maker's fabric (Cat, 2026-10-26): with a print picked, the garment turns in it, the jade python of the
// one-way swatch wrapped round it; with none, it turns in plain calico (Cat's Q2, 2026-10-31).
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
