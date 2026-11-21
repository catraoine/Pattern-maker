import { expect, measureMe, MEASUREMENTS, openFresh, test } from './fixtures';

// A tester's laptop showed only a sliver of "5 ft 10": on a wide screen the numbers grow to 56px, but the hidden copy
// that sizes each feet and inches box stayed at 34px (Nov 19). Each box must be wide enough for what is typed in it.
test('the height boxes in feet and inches show the whole number, on a phone and a wide laptop', async ({ page }, info) => {
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1536, height: 864 });
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  const feet = main.getByRole('textbox', { name: /, feet$/ });
  for (let n = 0; n < 12 && !(await feet.count()); n++) {
    const box = main.getByRole('textbox');
    await expect(box).toHaveCount(1);
    const label = ((await box.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')) ?? '').trim();
    // Height asks for feet and inches once the unit is inches.
    if (label === 'Height') {
      await main.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Feet and inches' }).click();
      break;
    }
    expect(MEASUREMENTS[label], `a test value for "${label}"`).toBeDefined();
    await box.fill(MEASUREMENTS[label]);
    await main.getByRole('button', { name: /^Next\b/ }).click();
  }
  const inches = main.getByRole('textbox', { name: /, inches$/ });
  await feet.fill('5');
  await inches.fill('10.5');
  for (const box of [feet, inches]) {
    const { scroll, client } = await box.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(scroll, 'the box is as wide as its number').toBeLessThanOrEqual(client);
  }
});
