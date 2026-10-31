import { expect, startWithExample, switchGarment, test } from './fixtures';

// Stills of the boxy dress beside the relaxed one, styled like Cat's gingham photo dress (Cat, 2026-10-30): a boat
// neck, short straight sleeves, a dropped waist and a straight, very short skirt, in Form, Flat and All round.
// Not a CI test. BOXY_STILLS=<folder> [BOXY_FITS=Relaxed,Boxy] [BOXY_HEM=19 (cm below the seam)] [BOXY_BAND=1] npx playwright test -c e2e boxy-stills --project=phone
const OUT = process.env.BOXY_STILLS;
test.skip(!OUT, 'Set BOXY_STILLS to a folder to take the stills');

test('boxy stills', async ({ page, consoleErrors }, info) => {
  consoleErrors.allow(/.*/);
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  // Sleeves need the arm measurements: added straight into the saved measurements, as the films do.
  await page.evaluate(() => {
    const k = 'pattern-maker:account';
    const a = JSON.parse(localStorage.getItem(k) ?? '{}');
    for (const person of a.people ?? []) Object.assign(person.values, { arm_length: 61, upper_arm: 25, wrist: 15 });
    localStorage.setItem(k, JSON.stringify(a));
  });
  await page.reload();
  await page.waitForTimeout(1500);
  const carryOn = page.getByRole('button', { name: /^Carry on with your/ });
  if (await carryOn.count()) await carryOn.first().click();
  await switchGarment(page, 'Dress');
  const main = page.getByRole('main');
  const pick = async (name: string, group?: string) => {
    const r = main.locator(group ? `fieldset[data-label="${group}"] button[aria-pressed]` : 'button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${name}(?![a-z])`) }).first();
    if (await r.count()) await r.evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForTimeout(250);
  };
  const tab = (name: string) => main.getByRole('tab', { name, exact: true }).click();
  for (const fit of (process.env.BOXY_FITS ?? 'Relaxed,Boxy').split(',')) {
    await tab('Shape');
    await pick(fit, 'Fit');
    await pick('Dropped');
    await tab('Neck & sleeves');
    await pick('Boat');
    await pick('Short');
    await pick('Straight', 'Sleeve shape');
    const slider = main.locator('input[type=range][aria-label="Sleeve length, in cm from the shoulder"]').first();
    if (await slider.count())
      await slider.evaluate((el) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '20');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    await tab('Length & hem');
    await pick('Straight', 'Silhouette');
    await page.evaluate(() => [...document.querySelectorAll('main .hem-mark')].find((g) => g.textContent?.trim() === 'MINI')?.querySelector('.hit')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(400);
    await tab('Fabric');
    const choose = (sel: string, name: string) =>
      page.evaluate(([sel, name]) => ([...document.querySelectorAll(sel)].find((el) => el.getAttribute('aria-label') === name || el.textContent?.trim().startsWith(name)) as HTMLElement | undefined)?.click(), [sel, name]);
    await choose('[role=radiogroup][aria-label="Fabric for the sketch"] [role=radio]', 'Silk');
    await main.getByRole('radiogroup', { name: 'Colour' }).getByRole('radio', { name: 'Camel', exact: true }).first().click();
    const about = main.locator('summary', { hasText: 'About your fabric' });
    if (!(await about.evaluate((el) => (el.parentElement as HTMLDetailsElement).open))) await about.evaluate((el) => (el as HTMLElement).click());
    await choose('[role=radiogroup][aria-label="What\'s printed on your fabric"] [role=radio]', 'Checks');
    await choose('[role=radiogroup][aria-label="Checks or stripes"] [role=radio]', 'Gingham');
    const repeat = main.locator('#fabrepeat');
    if (await repeat.count()) await repeat.fill('4.5');
    // The photo's self band at the seam, and its very short hem, BOXY_HEM cm below the seam, set as a hem drawn on the form would.
    if (process.env.BOXY_BAND) {
      await tab('Length & hem');
      await pick('Self band', 'Belt');
    }
    if (process.env.BOXY_HEM) {
      await page.waitForTimeout(500);
      await page.evaluate((cm) => {
        const k = 'pattern-maker:skirt';
        const saved = JSON.parse(localStorage.getItem(k) ?? '{}');
        if (saved.dress) saved.dress.skirt = { ...saved.dress.skirt, lengthCm: cm };
        localStorage.setItem(k, JSON.stringify(saved));
      }, Number(process.env.BOXY_HEM));
      await page.reload();
      await page.waitForTimeout(1500);
      const again = page.getByRole('button', { name: /^Carry on with your/ });
      if (await again.count()) await again.first().click();
      await main.getByRole('heading', { level: 1, name: /^Style your/ }).waitFor();
    }
    await tab('Shape');
    await page.evaluate(() => window.scrollTo(0, 0));
    const views = main.getByRole('group', { name: 'Garment view' });
    for (const v of ['Front', 'Flat', 'All round']) {
      const b = views.getByRole('button', { name: v, exact: true });
      if (!(await b.count())) continue;
      await b.click();
      await page.waitForTimeout(v === 'All round' ? 2500 : 900);
      const preview = main.locator('.preview').first();
      await expect(preview).toBeVisible();
      await page.waitForTimeout(500);
      await preview.screenshot({ path: `${OUT}/${info.project.name}/${fit.toLowerCase()}${process.env.BOXY_HEM ? '-photo' : ''}-${v.replace(' ', '-').toLowerCase()}.png` });
    }
    await views.getByRole('button', { name: 'Front', exact: true }).click();
  }
});
