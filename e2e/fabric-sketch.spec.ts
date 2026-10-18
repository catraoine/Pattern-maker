import { expect, startWithExample, switchGarment, test, type GarmentName } from './fixtures';

// The sketch is drawn in the fabric tapped under it, and the print screen keeps that fabric.
test('a swatch dresses the skirt sketch and carries to the print screen', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const swatches = main.getByRole('radiogroup', { name: 'Fabric for the sketch' });
  const corduroy = swatches.getByRole('radio', { name: 'Corduroy' });
  await corduroy.click();
  await expect(corduroy).toHaveAttribute('aria-checked', 'true');
  await expect(main.locator('.garment-fabric pattern image').first()).toHaveAttribute('href', /fabrics\/flat\/corduroy\.jpg$/);
  // Tapping it again goes back to the plain sketch.
  await corduroy.click();
  await expect(corduroy).toHaveAttribute('aria-checked', 'false');
  await expect(main.locator('.garment-fabric')).toHaveCount(0);
  await swatches.getByRole('radio', { name: 'Linen' }).click();
  await main.getByRole('button', { name: 'Print my pattern' }).click();
  await expect(main.getByText('Linen', { exact: true }).first()).toBeVisible();
});

for (const g of ['Dress', 'Trousers'] as GarmentName[]) {
  test(`the ${g.toLowerCase()} sketch takes the fabric too`, async ({ page }) => {
    await startWithExample(page);
    await switchGarment(page, g);
    const main = page.getByRole('main');
    await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Denim' }).click();
    await expect(main.locator('.garment-fabric .techflat')).toBeVisible();
  });
}
