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
    // The garment on the form wears it, and the page stays on the form; the Drawing view wears it too.
    await expect(main.locator('.garment-fabric .form-still .cloth-fill').first()).toBeVisible();
    await main.getByRole('button', { name: 'Flat', exact: true }).click();
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
  await expect(main.locator('.garment-fabric filter.fabric-tint')).toHaveCount(1);
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

// Any colour (Cat's W2 + W4): the bars and the hex box tint the sketch, and the shops' nearest colourway is one tap away.
test('any colour tints the sketch and finds the closest shop colourway', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('tab', { name: 'Fabric' }).click();
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Linen' }).click();
  await main.getByRole('button', { name: 'Any colour' }).click();
  await expect(main.locator('.testing-tag[title*="shop colourways match"]')).toBeVisible();
  await main.getByLabel('Hex').fill('#b8613f');
  await expect(main.locator('.fabric-now')).toContainText('#B8613F');
  await expect(main.locator('.garment-fabric filter.fabric-tint')).toHaveCount(1);
  if (process.env.SHOTS) {
    await main.locator('.colourbars').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    await page.screenshot({ path: `${process.env.SHOTS}/any-colour.png` });
  }
  const rows = main.locator('.colourmatch-row');
  await expect(rows).toHaveCount(3);
  await main.getByLabel('Shade').fill('70');
  await expect(main.locator('.fabric-now')).not.toContainText('#B8613F');
  await rows.first().click();
  await expect(main.getByRole('tab', { name: 'Shop' })).toHaveAttribute('aria-selected', 'true');
  await expect(main.locator('.shopfab.on')).toHaveCount(1);
  if (process.env.SHOTS) {
    await main.locator('.fabric-now').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.SHOTS}/any-colour-match.png` });
  }
});

// Exact Colour Card (Cat's X1): when no shop colourway is a near match, print it or have it dyed in the exact colour.
test('a colour the shops lack can be printed or dyed exactly', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('tab', { name: 'Fabric' }).click();
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Linen' }).click();
  await main.getByRole('button', { name: 'Any colour' }).click();
  await main.getByLabel('Hex').fill('#b8613f');
  const card = main.locator('.exactcolour');
  await expect(card).toContainText('Get #B8613F exactly');
  // Spoonflower opens in a new tab; answer it here so the test needs no network.
  await page.context().route('https://www.spoonflower.com/**', (r) => r.fulfill({ body: 'Spoonflower' }));
  const download = page.waitForEvent('download');
  const popup = page.waitForEvent('popup');
  await card.getByRole('button', { name: 'Print it' }).click();
  expect((await download).suggestedFilename()).toBe('maison-trace-B8613F.png');
  await (await popup).waitForURL(/spoonflower\.com/);
  await expect(card.locator('.exactcolour-steps')).toContainText('maison-trace-B8613F.png');
  if (process.env.SHOTS) {
    await main.locator('.colourmatch').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.SHOTS}/exact-colour-${test.info().project.name}.png` });
  }
  await card.getByRole('button', { name: 'Dyed to order' }).click();
  await expect(card.getByRole('button', { name: 'Tell me when it opens' })).toBeVisible();
});
