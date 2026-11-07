import { expect, goTab, startWithExample, switchGarment, test } from './fixtures';

// The picked fabric stands beside the form as one tall palette card (Cat's D1, 2026-11-02), and follows each swatch.
test('the palette card shows the picked fabric, and a shop fabric with its shop and price', async ({ page }) => {
  // The shop lists are hidden until a shop's feed is loaded (Nov 7); this browser has them on.
  await page.addInitScript(() => localStorage.setItem('shops', 'on'));
  await startWithExample(page);
  await switchGarment(page, 'Dress');
  const main = page.getByRole('main');
  const card = main.locator('.palette-card');
  await expect(card).toHaveCount(0);
  await goTab(page, 'Fabric');
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Linen' }).click();
  await expect(card).toBeVisible();
  await expect(card.locator('.palette-name')).toHaveText('Linen');
  await main.getByRole('radiogroup', { name: 'Fabric for the sketch' }).getByRole('radio', { name: 'Cotton' }).click();
  await main.getByRole('radiogroup', { name: 'Cotton you can buy' }).getByRole('radio', { name: /Cotton denim/ }).click();
  await main.getByRole('radiogroup', { name: 'Colour' }).getByRole('radio', { name: 'Indigo twill' }).click();
  await expect(card.locator('.palette-name')).toContainText('Cotton denim, 10.5 oz · Indigo twill');
  await expect(card.locator('.palette-shop')).toHaveText('Mood Fabrics · $13.96/yd');
  // The flat drawing keeps its width: no card there.
  await main.getByRole('button', { name: 'Flat', exact: true }).click();
  await expect(card).toBeHidden();
});
