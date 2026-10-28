import { GarmentName, expect, startWithExample, switchGarment, test } from './fixtures';

// Stills of All round at exact angles, for checking a body change by eye (not a CI test).
// BODY_STILLS=<folder> [BODY_LOOKS=dress,tee,...] [FILM=1] [LINES=1] [FORM=1] [ROUND2D=1 for the canvas painter] npx playwright test -c e2e body-stills --project=phone
const OUT = process.env.BODY_STILLS;
test.skip(!OUT, 'Set BODY_STILLS to a folder to take the stills');

const ALL: [string, GarmentName, string, string[]][] = [
  ['dress', 'Dress', 'Neck & sleeves', ['Crew', 'Short']],
  ['dress-boat', 'Dress', 'Neck & sleeves', ['Boat', 'Short']],
  ['dress-sleeveless', 'Dress', 'Neck & sleeves', ['Scoop', 'Sleeveless']],
  ['dress-square', 'Dress', 'Neck & sleeves', ['Square', 'Sleeveless']],
  ['dress-sweetheart', 'Dress', 'Neck & sleeves', ['Sweetheart', 'Sleeveless']],
  ['bodice', 'Bodice', 'Neck & sleeves', []],
  ['tee', 'Tee', 'Neckline', ['Crew']],
  ['tee-fitted', 'Tee', 'Fit', ['Fitted']],
  ['tee-scoop', 'Tee', 'Neckline', ['Scoop']],
  ['jacket', 'Jacket', 'Shape', []],
  ['coat', 'Coat', 'Shape', []],
  ['skirt', 'Skirt', 'Shape', []],
  ['trousers', 'Trousers', 'Shape', []],
];
const want = process.env.BODY_LOOKS?.split(',');
const LOOKS = want ? ALL.filter(([k]) => want.includes(k)) : ALL;
// BODY_ANGLES=120,123 for exact angles in degrees.
const ANGLES = process.env.BODY_ANGLES ? process.env.BODY_ANGLES.split(',').map((d) => (Number(d) * Math.PI) / 180) : [0, 0.6, Math.PI / 2, 2.3, Math.PI];

test('body stills', async ({ page, consoleErrors }, info) => {
  consoleErrors.allow(/.*/);
  test.setTimeout(1_500_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (process.env.FILM) await page.addInitScript(() => ((window as unknown as { __tourFilm: boolean }).__tourFilm = true));
  if (process.env.ROUND2D) await page.addInitScript(() => ((window as unknown as { __round2d: boolean }).__round2d = true));
  await startWithExample(page);
  const main = page.getByRole('main');
  let current: GarmentName = 'Skirt';
  for (const [key, g, tab, picks] of LOOKS) {
    if (g !== current) await switchGarment(page, g);
    current = g;
    for (const name of picks) {
      const t = main.getByRole('tab', { name: tab, exact: true });
      if (await t.count()) await t.click();
      const b = main.locator('button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${name}\\b`) }).first();
      if (await b.count()) await b.evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(250);
    }
    if (!process.env.LINES) {
      await main.getByRole('tab', { name: 'Fabric', exact: true }).click();
      const more = main.locator('.fabric-more');
      if (!(await more.evaluate((el) => (el as HTMLDetailsElement).open))) await main.locator('.fabric-more > summary').click();
      const print = main.getByRole('radiogroup', { name: "What's printed on your fabric" }).getByRole('radio', { name: 'One-way' });
      if ((await print.getAttribute('aria-checked')) !== 'true') await print.click();
    }
    if (process.env.FORM) {
      // The Form view and the draw tool, which share the Form/Draw figure.
      const views = main.getByRole('group', { name: 'Garment view' });
      if (await views.count()) await views.getByRole('button', { name: 'Form', exact: true }).click();
      await page.waitForTimeout(600);
      const preview = main.locator('.preview').first();
      await preview.scrollIntoViewIfNeeded();
      await preview.screenshot({ path: `${OUT}/${info.project.name}/${key}/form.png` });
      const draw = main.getByRole('button', { name: 'Draw on your form' });
      if (await draw.count()) {
        await draw.first().click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/${info.project.name}/${key}/draw.png` });
        const back = page.getByRole('button', { name: 'Done' });
        if (await back.count()) await back.first().click();
        await page.waitForTimeout(400);
      }
      await main.getByRole('tab', { name: 'Shape', exact: true }).click();
      continue;
    }
    if (process.env.ENLARGE) {
      // The enlarged drawing (ENLARGE=1), as Cat looks at it on her phone: enlarged from the Form view (All round has no
      // Enlarge button of its own), then switched to All round while it is big.
      const big = main.getByRole('button', { name: /^Enlarge the drawing/ });
      if (await big.count()) {
        await big.click();
        await page.waitForTimeout(1500);
      }
    }
    await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
    const cv = main.locator('canvas.all-round-canvas');
    await expect(cv).toBeVisible();
    await page.waitForTimeout(1200);
    await cv.scrollIntoViewIfNeeded();
    for (let k = 0; k < ANGLES.length; k++) {
      await cv.evaluate((el, at) => el.dispatchEvent(new CustomEvent('allround-turn', { detail: { at, probe: false } })), ANGLES[k]);
      await page.waitForTimeout(150);
      await cv.screenshot({ path: `${OUT}/${info.project.name}/${key}/${k}.png` });
    }
    if (process.env.ENLARGE) {
      const small = main.getByRole('button', { name: /^Make the drawing .* smaller$/ });
      if (await small.count()) await small.click();
      await page.waitForTimeout(600);
    }
    await main.getByRole('tab', { name: 'Shape', exact: true }).click();
  }
});
