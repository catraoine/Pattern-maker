import { GarmentName, expect, startWithExample, switchGarment, test } from './fixtures';

// Stills of the Form view and the draw tool (the Form/Draw figure), for checking a body change by eye (not a CI test).
// FORM_STILLS=<folder> [FORM_LOOKS=Dress,Tee] npx playwright test -c e2e form-stills --project=phone
const OUT = process.env.FORM_STILLS;
test.skip(!OUT, 'Set FORM_STILLS to a folder to take the stills');

test('form stills', async ({ page, consoleErrors }, info) => {
  consoleErrors.allow(/.*/);
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  const main = page.getByRole('main');
  const looks = (process.env.FORM_LOOKS ?? 'Dress,Tee,Skirt').split(',') as GarmentName[];
  for (const g of looks) {
    if (g !== 'Skirt') await switchGarment(page, g);
    const views = main.getByRole('group', { name: 'Garment view' });
    if (await views.count()) {
      const form = views.getByRole('button', { name: 'Form', exact: true });
      if (await form.count()) await form.click();
    }
    await page.waitForTimeout(800);
    const preview = main.locator('.preview').first();
    await expect(preview).toBeVisible();
    await preview.screenshot({ path: `${OUT}/${info.project.name}/${g.toLowerCase()}/form.png` });
    const draw = main.getByRole('button', { name: 'Draw on your form' }).first();
    if (await draw.count()) {
      await draw.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/${info.project.name}/${g.toLowerCase()}/draw.png` });
      const cancel = page.getByRole('button', { name: /^(Cancel|Back|Close|Done)$/ }).first();
      if (await cancel.count()) await cancel.click();
      await page.waitForTimeout(400);
    }
  }
});
