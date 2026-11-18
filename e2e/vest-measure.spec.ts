import { expect, goTab, skipToExample, skipLoading, stepButton, switchGarment, test } from './fixtures';

// A Black Vest tester's Measure list was headed Jacket, said "Style your jacket", and sent her to measure her arms for
// a piece with no sleeves (pretend-tester walk, Nov 18).
test('the Black Vest\'s Measure list is the vest\'s, without arms to take', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const main = page.getByRole('main');
  await page.route('**/.netlify/functions/tester', (r) => r.fulfill({ json: { ok: true, tester: true } }));
  await page.goto('/?fresh&tester=EXAMPLE-ONLY');
  await skipLoading(page);
  await skipToExample(page);
  await switchGarment(page, 'Jacket');
  await main.locator('.tester-look button').click();
  await expect(main.getByRole('heading', { name: /Black Vest/ })).toBeVisible({ timeout: 30_000 });
  // No sleeves, so no cuffs: its rib band row is just the hem's.
  await main.getByRole('button', { name: 'Change a detail' }).click();
  await goTab(page, 'Length & hem');
  await expect(main.getByText('Rib band', { exact: false }).or(main.getByText('Plain hem', { exact: true })).first()).toBeAttached();
  await expect(main.getByText('Hem and cuffs')).toHaveCount(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/vest-hem-${test.info().project.name}.png` });
  await stepButton(page, 'Measure').click();
  await expect(main.locator('.garment-eyebrow')).toContainText(/vest/i);
  await expect(main.getByRole('button', { name: 'Style your vest' })).toBeVisible();
});
