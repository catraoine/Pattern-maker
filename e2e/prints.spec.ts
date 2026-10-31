import { expect, goPrint, goTab, startWithExample, test } from './fixtures';
import type { Page } from '@playwright/test';

// The print picker (P1) replaces the checks switch, under "About your fabric" on the Fabric tab (the one
// place fabric is chosen, #108): each print sets the lay, and its swatch goes under the pieces in the
// cutting layout (P4).
async function openPrints(page: Page) {
  const main = page.getByRole('main');
  await goTab(page, 'Fabric');
  await main.locator('.fabric-more > summary').click();
  return main.getByRole('radiogroup', { name: "What's printed on your fabric" });
}

test('picking a print sets the lay and draws it under the pieces', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const prints = await openPrints(page);
  await expect(prints.getByRole('radio')).toHaveCount(6);

  // Checks keep their seam matching.
  await prints.getByRole('radio', { name: 'Checks, stripes' }).click();
  await expect(main.locator('#fabrepeat')).toHaveAttribute('placeholder', '10');
  await expect(main.locator('.fabric-more')).toContainText('Checks or stripes: buy about');

  const motifs = prints.getByRole('radio', { name: 'Big motifs' });
  await motifs.click();
  await expect(motifs).toHaveAttribute('aria-checked', 'true');
  await expect(main.locator('#fabrepeat')).toHaveAttribute('placeholder', '32');
  await main.locator('#fabrepeat').fill('40');
  await expect(main.locator('.fabric-more')).toContainText('40 cm repeat');
  await main.locator('.printpick').screenshot({ path: test.info().outputPath('picker.png') });

  await goPrint(page);
  // Placed motifs are cut every piece the same way up.
  await expect(main.getByRole('checkbox', { name: /Nap or one-way print/ })).toBeChecked();
  await expect(main.getByRole('checkbox', { name: /Nap or one-way print/ })).toBeDisabled();
  await expect(main.locator('.layplan pattern[id^="print"] image').first()).toHaveAttribute('href', /prints\/motif\.jpg$/);
  await expect(main.getByText('The front is centred on a motif.', { exact: false })).toBeVisible();
  await main.locator('.lay').first().screenshot({ path: test.info().outputPath('lay-motif.png') });
});

test('a border print turns the hemmed pieces crosswise, and tapping it again clears it', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const prints = await openPrints(page);
  await prints.getByRole('radio', { name: 'Border' }).click();
  await expect(main.locator('#fabrepeat')).toHaveCount(0);
  await prints.getByRole('radio', { name: 'Border' }).click();
  await expect(prints.getByRole('radio', { name: 'Border' })).toHaveAttribute('aria-checked', 'false');
  await prints.getByRole('radio', { name: 'Border' }).click();

  await goPrint(page);
  await expect(main.locator('.lay').first()).toContainText('turned crosswise');
  await main.locator('.lay').first().screenshot({ path: test.info().outputPath('lay-border.png') });
});
