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
  // The print screen's photo swatches keep their own size: the sketch's round swatches once squeezed them
  // into overlapping circles that jumped about when the row was dragged.
  const photo = main.locator('.yourfabric .swatch').first();
  expect((await photo.boundingBox())!.width).toBeGreaterThan(60);
  await expect(photo).toHaveCSS('border-radius', '0px');
  await expect(photo.locator('img')).toHaveAttribute('draggable', 'false');
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
  await goPrint(page);
  await expect(main.locator('#fabname')).toHaveValue('Cotton denim, 10.5 oz');
  await expect(main.locator('#fabcolour')).toHaveValue('Indigo twill');
  await expect(main.locator('.shopbuy')).toContainText('Mood Fabrics');
  await expect(main.locator('.shopbuy a')).toHaveAttribute('href', /indigo-cotton-denim-twill-420606$/);
});
