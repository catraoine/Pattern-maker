import { asMan, expect, expectStyle, fillStepPages, measureMe, openFresh, pickToMake, skipLoading, startWithExample, stepButton, switchGarment, test } from './fixtures';
import { EXAMPLE_MAN } from '../src/engine/randomBodies';

// The menswear form (Cat's B2 Two Forms, 2026-10-18): picked before the first measurement, it asks for the
// chest, skips the bust measurements, and the bodice is drafted with no bust dart.
test('menswear form: chest, no bust measurements, a bodice with no bust dart', async ({ page }) => {
  // Menswear is shown but shut while this fit round tests womenswear only (Cat, Nov 14); this check opens it.
  await page.addInitScript(() => localStorage.setItem('maison-trace-menswear', 'on'));
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page, 'Menswear');

  // The waist comes first for every form (Cat, 2026-10-21); the chest is next.
  await main.getByRole('textbox', { name: 'Waist' }).fill('84');
  await main.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Your chest' })).toBeVisible();
  await expect(main.getByRole('textbox', { name: 'Chest' })).toBeVisible();
  await expect(main).not.toContainText(/bust/i);
  await fillStepPages(page);
  await expect(main.getByRole('list')).toContainText('Chest');
  await main.getByRole('button', { name: 'Choose what to make' }).click();

  await pickToMake(page, 'Bodice');
  // No high bust: straight on to the shoulders.
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText(/bust/i);
  await fillStepPages(page);
  await expectStyle(page, 'Bodice');
  await expect(page.getByText(/Bust dart/)).toHaveCount(0);

  // The form can be changed later, from the measurements list: back on womenswear, the high bust is asked for.
  await stepButton(page, 'Measure').click();
  const list = main.getByRole('list', { name: 'Tap one to measure it again' });
  await list.getByRole('button', { name: /^Form\s*Menswear$/ }).click();
  await expect(main.getByRole('heading', { name: 'Your form' })).toBeVisible();
  // A tap on the form is the choice: straight back to the list, no Continue.
  await main.getByRole('button', { name: 'Womenswear', exact: true }).click();
  await expect(list.getByRole('button', { name: /^Form\s*Womenswear$/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^High bust\s*Add$/ })).toBeVisible();
  await expect(list).toContainText('Full bust');
});

// A link with ?menswear=on opens the menswear form on that device, for someone designing menswear before its fit round;
// without it the form stays shut, as for everyone else.
test('a ?menswear=on link opens the menswear form, and it stays open', async ({ page }) => {
  await page.goto('/?fresh&menswear=on');
  await skipLoading(page);
  await expect(page.getByRole('heading', { name: /sewing patterns for the piece/i })).toBeVisible();
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page, 'Menswear');
  await main.getByRole('textbox', { name: 'Waist' }).fill('84');
  await main.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Your chest' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('maison-trace-menswear'))).toBe('on');
});

// On the menswear form a jacket starts Long, over the seat, as a man's tailored jacket does (Cat's pick, Nov 22).
test('a jacket on the menswear form starts Long', async ({ page }) => {
  await startWithExample(page);
  await asMan(page, EXAMPLE_MAN as Record<string, number>);
  await switchGarment(page, 'Jacket');
  await expect(page.getByRole('heading', { level: 1, name: /^Style your jacket/ })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(/Long single-breasted jacket/i);
});
