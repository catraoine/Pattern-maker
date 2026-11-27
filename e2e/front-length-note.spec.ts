import { expect, skipLoading, startWithExample, stepTabs, switchGarment, test } from './fixtures';

// The note that the front length looks short stood over every one of the top's steps, and on an iPhone pushed the
// choices behind the Next bar; and it wasn't on the page to fix it from (EH walk, Cat's call, Nov 25). It now shows on
// the first step only, with Edit measurements beside it.
test('a front length no longer than the back is noted on the first step only, with the way to fix it', async ({ page }) => {
  test.setTimeout(120_000);
  await startWithExample(page);
  await page.evaluate(() => {
    const k = 'pattern-maker:account';
    const a = JSON.parse(localStorage.getItem(k) ?? '{}');
    for (const person of a.people ?? []) Object.assign(person.values, { nape_to_waist: 42, front_hps_to_waist: 42 });
    localStorage.setItem(k, JSON.stringify(a));
  });
  await page.reload();
  await skipLoading(page);
  const carryOn = page.getByRole('main').getByRole('button', { name: /^Carry on with your/ });
  if (await carryOn.isVisible().catch(() => false)) await carryOn.click({ timeout: 5_000 }).catch(() => {});
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  const note = main.locator('.msg').filter({ hasText: /front length/i });
  await expect(note).toBeVisible();
  await expect(note.getByRole('button', { name: 'Edit measurements' })).toBeVisible();

  // The next step: no note.
  const tabs = await stepTabs(page);
  await tabs.getByRole('tab').nth(1).click();
  await expect(note).toHaveCount(0);

  // Back on the first, Edit measurements opens the list to fix it.
  await (await stepTabs(page)).getByRole('tab').first().click();
  await note.getByRole('button', { name: 'Edit measurements' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Your measurements' })).toBeVisible();
});
