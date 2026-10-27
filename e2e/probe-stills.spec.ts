import { expect, startWithExample, switchGarment, test } from './fixtures';
import type { GarmentName } from './fixtures';

// Probe-colour stills of All round at exact angles (PROBE_OUT=<dir> PROBE_LOOK=Tee:Crew PROBE_ANGLES=240,243).
const OUT = process.env.PROBE_OUT;
test.skip(!OUT, 'Set PROBE_OUT');

test('probe stills', async ({ page, consoleErrors }, info) => {
  consoleErrors.allow(/.*/);
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  const main = page.getByRole('main');
  const [g, pick] = (process.env.PROBE_LOOK ?? 'Tee:Crew').split(':');
  if (g !== 'Skirt') await switchGarment(page, g as GarmentName);
  if (pick) {
    await main.getByRole('tab', { name: 'Neck & sleeves', exact: true }).click();
    const b = main.locator('button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${pick}\\b`) }).first();
    if (await b.count()) await b.evaluate((el) => (el as HTMLElement).click());
  }
  await main.getByRole('tab', { name: 'Fabric', exact: true }).click();
  const more = main.locator('.fabric-more');
  if (!(await more.evaluate((el) => (el as HTMLDetailsElement).open))) await main.locator('.fabric-more > summary').click();
  const print = main.getByRole('radiogroup', { name: "What's printed on your fabric" }).getByRole('radio', { name: 'One-way' });
  if ((await print.getAttribute('aria-checked')) !== 'true') await print.click();
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
  const cv = main.locator('canvas.all-round-canvas');
  await expect(cv).toBeVisible();
  await page.waitForTimeout(1200);
  for (const d of (process.env.PROBE_ANGLES ?? '240,243').split(',')) {
    for (const probe of [false, true]) {
      await cv.evaluate((el, dd) => el.dispatchEvent(new CustomEvent('allround-turn', { detail: dd })), { at: (Number(d) * Math.PI) / 180, probe });
      await page.waitForTimeout(150);
      await cv.screenshot({ path: `${OUT}/${info.project.name}/${d}${probe ? '-check' : ''}.png` });
    }
  }
});
