import { expect, startWithExample, switchGarment, test } from './fixtures';

// The preview on the style page opens full screen, live: its views and tools work there as on the page
// (Cat, 2026-10-24: enlarge is for using the tools with a larger view).
test('enlarge the garment drawing', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const preview = main.getByRole('region', { name: 'Preview' });
  await main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await expect(preview).toHaveClass(/live-big/);
  // Full screen, once it has grown in, with the drawing filling it.
  const view = page.viewportSize()!;
  await expect.poll(async () => (await preview.boundingBox())!.width).toBeGreaterThan(view.width - 2);
  expect((await preview.boundingBox())!.height).toBeGreaterThan(view.height - 2);
  expect((await preview.locator('.preview-svg').first().boundingBox())!.height).toBeGreaterThan(view.height / 2);
  await page.screenshot({ path: test.info().outputPath('enlarged.png') });
  await main.getByRole('button', { name: /^Make the drawing .* smaller$/ }).click();
  await expect(preview).not.toHaveClass(/live-big/);

  // The dress's views switch while it is enlarged, and Escape closes it.
  await switchGarment(page, 'Dress');
  await main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await expect(preview).toHaveClass(/live-big/);
  await preview.getByRole('button', { name: 'Drawing', exact: true }).click();
  await expect(main.getByRole('img', { name: /^Technical flat/ })).toBeVisible();
  await expect(preview).toHaveClass(/live-big/);
  await page.keyboard.press('Escape');
  await expect(preview).not.toHaveClass(/live-big/);

  // Drawing from the enlarged form opens the drawing tool enlarged too.
  await main.getByRole('button', { name: 'Form', exact: true }).click();
  await main.getByRole('button', { name: /^Enlarge the drawing/ }).click();
  await expect(preview).toHaveClass(/live-big/);
  await main.getByRole('button', { name: 'Draw on your form' }).first().evaluate((el) => (el as HTMLElement).click());
  await expect(main.getByRole('button', { name: 'Smaller', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await main.getByRole('button', { name: 'Smaller', exact: true }).click();
  await main.getByRole('button', { name: 'Done', exact: true }).click();

  // The turning form has nothing to enlarge. (Done shows the pattern; back to the garment first.)
  const garment = main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Garment/ });
  if (await garment.count()) await garment.click();
  await main.getByRole('button', { name: 'All round' }).click();
  await expect(main.getByRole('button', { name: /^Enlarge the drawing/ })).toHaveCount(0);
});
