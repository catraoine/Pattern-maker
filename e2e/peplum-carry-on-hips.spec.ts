import { MEASUREMENTS, expect, fillStepPages, measureMe, openFresh, test } from './fixtures';

// A reload partway through the Ice Peplum's measurements (high bust over the full bust, so its across back and armhole
// are asked too) opened the check, with no word of the top. Continue measuring then went round the top's own list, armhole
// last with no reason given, and never asked the waist to hip its peplum hangs from: Style showed only "Add your full
// hip and waist to hip measurements", with no way on (EI stills, Nov 26).
test('a reload partway through the Ice Peplum carries on with it, hips and all', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const main = page.getByRole('main');
  const h1 = (name: string | RegExp) => main.getByRole('heading', { level: 1, name });
  const saved = { ...MEASUREMENTS };
  Object.assign(MEASUREMENTS, { 'High bust': '95', 'Across back': '36', Armhole: '42' });
  try {
    await openFresh(page);
    await main.getByRole('button', { name: 'Begin' }).click();
    await measureMe(page);
    await fillStepPages(page);
    await main.getByRole('button', { name: 'Choose what to make' }).click();
    await main.getByRole('button', { name: /^The collection/ }).click();
    await main.getByRole('listitem').filter({ hasText: 'Ice Peplum Top' }).first().getByRole('button', { name: /^Make/ }).first().click();
    // On to the high bust, then the across back it asks for.
    const box = main.getByRole('textbox');
    for (let i = 0; i < 20; i++) {
      await expect(box).toHaveCount(1);
      const label = (await main.locator('label').first().textContent())?.trim() ?? '';
      if (/across back/i.test(label)) break;
      await box.fill(MEASUREMENTS[label] ?? MEASUREMENTS[label.replace(/^Your /, '')] ?? '40');
      await main.getByRole('button', { name: /^Next\b/ }).click();
      await expect(main.locator('label').first()).not.toHaveText(label);
    }
    await box.fill('36');
    await main.getByRole('button', { name: /^Next\b/ }).click();
    await expect(main).toContainText(/armhole/i);

    await page.evaluate(() => location.reload());
    await page.waitForLoadState('load');
    // Back on the armhole, saying why it's asked, not on the check.
    await expect(main.getByRole('textbox')).toHaveCount(1);
    await expect(h1('Do these look right?')).toHaveCount(0);
    await expect(main.locator('.extra-intro')).toContainText(/high bust/i);
    await expect(main.locator('label').first()).toContainText(/armhole/i);
    // As a tester who hasn't styled before: How styling works not yet seen (the fixtures mark it seen on every load).
    await page.evaluate(() => localStorage.removeItem('maison-trace-style-intro'));

    // The rest of the pages ask the waist to hip too, and Style draws the top.
    const asked: string[] = [];
    for (let i = 0; i < 20 && (await box.count()); i++) {
      const label = (await main.locator('label').first().textContent())?.trim() ?? '';
      asked.push(label);
      await box.fill(MEASUREMENTS[label] ?? MEASUREMENTS[label.replace(/^Your /, '')] ?? '40');
      await main.getByRole('button', { name: /^(Next|Done|Save)\b/ }).first().click();
      await expect.poll(async () => ((await box.count()) ? (await main.locator('label').first().textContent())?.trim() : 'gone')).not.toBe(label);
    }
    expect(asked.join(' | ')).toMatch(/waist to hip/i);
    await expect(main.getByRole('heading', { name: /^Style |Ice Peplum/ }).first()).toBeVisible({ timeout: 30_000 });
    await expect(main).not.toContainText('Add your full hip');
    // The look opens on itself, ready to print, not on How styling works, which read as restyling it from scratch; and
    // again from Style in the top bar (pretend tester EJ walk, Nov 27).
    const steps = page.getByRole('navigation', { name: 'Steps' });
    await expect(main.getByRole('button', { name: 'Change a detail' })).toBeVisible();
    await expect(h1(/How styling works/)).toHaveCount(0);
    await steps.getByRole('button', { name: 'Measure' }).click();
    await steps.getByRole('button', { name: 'Style' }).click();
    await expect(main.getByRole('button', { name: 'Change a detail' })).toBeVisible();
    await expect(h1(/How styling works/)).toHaveCount(0);
    // Changing a detail is styling, so the intro still shows there the first time.
    await main.getByRole('button', { name: 'Change a detail' }).click();
    await expect(h1(/How styling works/)).toBeVisible();
  } finally {
    Object.assign(MEASUREMENTS, saved);
  }
});
