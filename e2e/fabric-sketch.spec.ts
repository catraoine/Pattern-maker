import { expect, goPrint, openGroup, startWithExample, switchGarment, test, type GarmentName } from './fixtures';

// The sketch is drawn in the fabric tapped under it, and the print screen keeps that fabric.
test('a swatch dresses the skirt sketch and carries to the print screen', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('tab', { name: 'Fabric' }).click();
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
  await goPrint(page);
  await expect(main.getByText('Linen', { exact: true }).first()).toBeVisible();
  // The cutting layout lays the paper pieces on that same cloth.
  await expect(main.locator('.layplan pattern image').first()).toHaveAttribute('href', /fabrics\/flat\/linen\.jpg$/);
  // Print sums the fabric up, and its button goes back to the Fabric tab, the one place to choose it.
  await expect(main.locator('.yourfabric h2')).toContainText('Linen');
  await main.getByRole('button', { name: 'Change fabric' }).click();
  await expect(main.getByRole('tab', { name: 'Fabric', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(swatches.getByRole('radio', { name: 'Linen' })).toHaveAttribute('aria-checked', 'true');
});

// Shape choices are drawn, each group on its own tab, and the chip keeps its name.
test('the skirt silhouettes are little drawings on their own tab', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const silhouette = await openGroup(page, 'Silhouette');
  await expect(silhouette.locator('.chips.pics')).toBeVisible();
  const trumpet = silhouette.getByRole('button', { name: 'Trumpet' });
  await expect(trumpet.locator('svg.pic')).toBeVisible();
  await trumpet.click();
  await expect(trumpet).toHaveAttribute('aria-pressed', 'true');
  await expect(main.getByRole('heading', { name: 'Style your skirt' })).toBeVisible();
});

for (const g of ['Dress', 'Trousers'] as GarmentName[]) {
  test(`the ${g.toLowerCase()} sketch takes the fabric too`, async ({ page }) => {
    await startWithExample(page);
    await switchGarment(page, g);
    const main = page.getByRole('main');
    await main.getByRole('tab', { name: 'Fabric' }).click();
    await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Denim' }).click();
    await expect(main.locator('.garment-fabric .techflat')).toBeVisible();
  });
}

// None takes the fabric off, a colour dot tints the swatch, and a shop fabric fills in the print screen's fabric card.
test('None, a colour and a shop fabric on the skirt sketch', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('tab', { name: 'Fabric' }).click();
  const swatches = main.getByRole('radiogroup', { name: 'Fabric for the sketch' });
  const none = swatches.getByRole('radio', { name: 'None' });
  await expect(none).toHaveAttribute('aria-checked', 'true');
  await swatches.getByRole('radio', { name: 'Wool' }).click();
  await main.getByRole('radiogroup', { name: 'Colour' }).getByRole('radio', { name: 'Camel' }).click();
  await expect(main.locator('.garment-fabric filter')).toHaveCount(1);
  await none.click();
  await expect(main.locator('.garment-fabric')).toHaveCount(0);
  await main.getByRole('tab', { name: 'Shop' }).click();
  await main.getByRole('radiogroup', { name: 'Fabric from partner shops' }).getByRole('radio', { name: /Cotton denim/ }).click();
  await expect(main.locator('.garment-fabric pattern image').first()).toHaveAttribute('href', /fabrics\/flat\/denim\.jpg$/);
  await main.getByRole('radiogroup', { name: 'Colour' }).getByRole('radio', { name: 'Indigo twill' }).click();
  await main.locator('.fabric-more > summary').click();
  await expect(main.locator('#fabname')).toHaveValue('Cotton denim, 10.5 oz');
  await expect(main.locator('#fabcolour')).toHaveValue('Indigo twill');
  await goPrint(page);
  await expect(main.locator('.yourfabric h2')).toContainText('Cotton denim, 10.5 oz');
  await expect(main.locator('.shopbuy')).toContainText('Mood Fabrics');
  await expect(main.locator('.shopbuy a')).toHaveAttribute('href', /indigo-cotton-denim-twill-420606$/);
});
