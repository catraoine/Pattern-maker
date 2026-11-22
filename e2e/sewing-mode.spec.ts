import { GarmentName, expect, goPrint, startWithExample, switchGarment, test } from './fixtures';

// Sewing mode (Cat's C, Nov 21): Start sewing on Print goes to the Sew tab, which opens the steps one at a time, each
// with a picture drawn from the garment's own pieces, and keeps the steps' words exactly as Print's list has them.
for (const g of ['Skirt', 'Trousers', 'Bodice', 'Dress', 'Tee', 'Jacket'] as GarmentName[]) {
  test(`sewing mode walks every ${g.toLowerCase()} step with a picture`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await startWithExample(page);
    if (g !== 'Skirt') await switchGarment(page, g);
    await goPrint(page);
    const main = page.getByRole('main');
    // The list, read before, so the words can be checked against it.
    const list = main.locator('details.sew');
    await list.locator('> summary').click();
    const titles = await list.locator('.sewsteps strong').allTextContents();
    expect(titles.length).toBeGreaterThan(3);
    // Print's Start sewing goes straight into Sewing mode, on the Sew tab.
    await main.getByRole('button', { name: /^Start sewing/ }).click();
    const mode = page.getByRole('dialog', { name: /^Sewing your / });
    await expect(mode).toBeVisible();
    for (let i = 0; i < titles.length; i++) {
      await expect(mode.locator('.eyebrow').first()).toHaveText(`Step ${i + 1} of ${titles.length}`);
      await expect(mode.locator('.sewmode-title .sew-title-words')).toHaveText(titles[i]);
      await expect(mode.locator('.sewmode-title .sew-num')).toHaveText(String(i + 1));
      // Every step has its picture, and it isn't empty.
      const pic = mode.locator('.sewmode-pic > *').first();
      await expect(pic).toBeVisible();
      expect((await pic.boundingBox())!.height).toBeGreaterThan(80);
      await page.waitForTimeout(2100);
      await mode.screenshot({ path: info.outputPath(`${g.toLowerCase()}-${String(i + 1).padStart(2, '0')}.png`) });
      if (i < titles.length - 1) await mode.getByRole('button', { name: /^Next step/ }).click();
    }
    await mode.getByRole('button', { name: 'Done' }).click();
    await expect(mode).toHaveCount(0);
    // Sewn to the end: a finished state, not "You stopped at the last step".
    await expect(main.getByText(/^You've sewn all \d+ steps\./)).toBeVisible();
  });
}

// The Sew tab: Print sends you there, it remembers the step you stopped at, and any step opens from its picture.
test('the sew tab keeps your place', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: /^Start sewing/ }).click();
  const mode = page.getByRole('dialog', { name: /^Sewing your / });
  await expect(mode).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Sew' })).toHaveAttribute('aria-current', 'step');
  // Each line of a step ticks off, and stays ticked when you come back to it.
  const lines = mode.getByRole('list', { name: 'Tick each one as you do it' }).getByRole('checkbox');
  expect(await lines.count()).toBeGreaterThan(1);
  await lines.first().check();
  await expect(lines.first()).toBeChecked();
  await mode.getByRole('button', { name: /^Next step/ }).click();
  await mode.getByRole('button', { name: /^Next step/ }).click();
  await expect(mode.locator('.eyebrow').first()).toHaveText(/^Step 3 of /);
  await page.keyboard.press('Escape');
  await expect(mode).toHaveCount(0);
  await expect(main.getByText(/^You stopped at step 3 of /)).toBeVisible();
  await main.getByRole('button', { name: /^Carry on sewing/ }).click();
  await expect(mode.locator('.eyebrow').first()).toHaveText(/^Step 3 of /);
  await mode.getByRole('button', { name: /^Back/ }).click();
  await expect(mode.locator('.eyebrow').first()).toHaveText(/^Step 2 of /);
  await mode.getByRole('button', { name: /^Back/ }).click();
  await expect(lines.first()).toBeChecked();
  await expect(main.getByRole('heading', { level: 1, name: 'Sew it' })).toBeAttached();
  await mode.getByRole('button', { name: /^Close/ }).click();
  // A step picked from its picture opens there.
  await main.getByRole('list').filter({ has: page.locator('.sew-index-pic') }).getByRole('button').nth(4).click();
  await expect(mode.locator('.eyebrow').first()).toHaveText(/^Step 5 of /);
  await mode.getByRole('button', { name: /^Close/ }).click();
  // The written steps stay on Print.
  await main.getByRole('button', { name: 'Print', exact: true }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Print it' })).toBeVisible();
});
