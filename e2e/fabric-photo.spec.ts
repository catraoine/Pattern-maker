import { expect, goTab, startWithExample, switchGarment, test } from './fixtures';

// Your photo (Design: Fabric, Nov 7): a photo of the maker's own fabric dresses the sketch, is kept on the device, and
// comes off again.
test('a photo of your own fabric dresses the sketch and comes off again', async ({ page }) => {
  await startWithExample(page);
  await switchGarment(page, 'Dress');
  const main = page.getByRole('main');
  await goTab(page, 'Fabric');
  // A small made-up photo: warm stripes, drawn in the page itself.
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const g = c.getContext('2d')!;
    for (let x = 0; x < 300; x += 20) {
      g.fillStyle = x % 40 ? '#b8613f' : '#efe8d6';
      g.fillRect(x, 0, 20, 200);
    }
    return c.toDataURL('image/png').split(',')[1];
  });
  await main.locator('.swatch.photo + input[type=file]').setInputFiles({ name: 'my-fabric.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const card = main.getByRole('button', { name: /^Your photo/ });
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(main.locator('.garment-fabric pattern image').first()).toHaveAttribute('href', /^blob:/);
  await expect(main.getByText('Your photo stays on this device', { exact: false })).toBeVisible();
  // Its size on the garment can change.
  const sizes = main.getByRole('radiogroup', { name: 'Size on the garment' });
  await sizes.getByRole('radio', { name: 'Large' }).click();
  await expect(sizes.getByRole('radio', { name: 'Large' })).toHaveAttribute('aria-checked', 'true');
  await expect(main.locator('.garment-fabric pattern').first()).toHaveAttribute('width', '40');
  // Back after a reload: the photo is kept in this browser.
  await page.reload();
  await page.getByRole('button', { name: 'Carry on with your dress' }).click();
  await goTab(page, 'Fabric');
  await expect(main.locator('.garment-fabric pattern image').first()).toHaveAttribute('href', /^blob:/);
  await main.getByRole('button', { name: 'Take the photo off' }).click();
  await expect(main.getByRole('button', { name: /^Your photo/ })).toHaveAttribute('aria-pressed', 'false');
});
