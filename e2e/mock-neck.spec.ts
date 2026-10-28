import { chooseChip, expect, openGroup, startWithExample, switchGarment, test } from './fixtures';

// Mock and funnel necks on the bodice and the dress, and a mock neck on the T-shirt (Cat's styling gaps, 2026-10-23).
test('mock and funnel necks: bodice, dress and tee', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startWithExample(page);
  const main = page.getByRole('main');

  await switchGarment(page, 'Bodice');
  await chooseChip(page, 'Collar', 'Mock neck');
  await expect((await openGroup(page, 'Collar')).getByText(/hugs the neck/)).toBeVisible();
  await expect(main.getByText(/mock neck/i).first()).toBeAttached();
  await page.screenshot({ path: info.outputPath('bodice-mock.png'), fullPage: true });
  await chooseChip(page, 'Collar', 'Funnel neck');
  await expect(main.getByText(/funnel neck/i).first()).toBeAttached();

  await switchGarment(page, 'Dress');
  await chooseChip(page, 'Collar', 'Funnel neck');
  await page.screenshot({ path: info.outputPath('dress-funnel.png'), fullPage: true });

  await switchGarment(page, 'Tee');
  await chooseChip(page, 'Neckline', 'Mock neck');
  await expect(main.getByText(/mock-neck/i).first()).toBeAttached();
  await page.screenshot({ path: info.outputPath('tee-mock.png'), fullPage: true });
});
