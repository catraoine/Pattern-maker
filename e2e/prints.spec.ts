import { expect, goPrint, startWithExample, test } from './fixtures';

// The print picker (P1) replaces the checks switch: each print sets the lay, and its swatch goes under
// the pieces in the cutting layout (P4).
test('picking a print sets the lay and draws it under the pieces', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const main = page.getByRole('main');
  const prints = main.getByRole('radiogroup', { name: "What's printed on your fabric" });
  await expect(prints.getByRole('radio')).toHaveCount(6);

  const motifs = prints.getByRole('radio', { name: 'Big motifs' });
  await motifs.click();
  await expect(motifs).toHaveAttribute('aria-checked', 'true');
  await expect(main.locator('#fabrepeat')).toHaveAttribute('placeholder', '32');
  await main.locator('#fabrepeat').fill('40');
  await expect(main.locator('.yourfabric')).toContainText('40 cm repeat');
  // Placed motifs are cut every piece the same way up.
  await expect(main.getByRole('checkbox', { name: /Nap or one-way print/ })).toBeChecked();
  await expect(main.getByRole('checkbox', { name: /Nap or one-way print/ })).toBeDisabled();
  await expect(main.locator('.layplan pattern[id^="print"] image').first()).toHaveAttribute('href', /prints\/motif\.jpg$/);
  await expect(main.getByText('The front is centred on a motif.', { exact: false })).toBeVisible();
  await main.locator('.printpick').screenshot({ path: test.info().outputPath('picker.png') });
  await main.locator('.lay').first().screenshot({ path: test.info().outputPath('lay-motif.png') });

  // Checks keep their seam matching.
  await prints.getByRole('radio', { name: 'Checks, stripes' }).click();
  await expect(main.locator('#fabrepeat')).toHaveAttribute('placeholder', '10');
  await expect(main.locator('.yourfabric')).toContainText('Checks or stripes: buy about');

  await prints.getByRole('radio', { name: 'Border' }).click();
  await expect(main.locator('#fabrepeat')).toHaveCount(0);
  await main.locator('.lay').first().screenshot({ path: test.info().outputPath('lay-border.png') });

  // Tapping the chosen print again clears it.
  await prints.getByRole('radio', { name: 'Border' }).click();
  await expect(prints.getByRole('radio', { name: 'Border' })).toHaveAttribute('aria-checked', 'false');
  await expect(main.getByRole('checkbox', { name: /Nap or one-way print/ })).toBeEnabled();
});
