import { GarmentName, expect, startWithExample, switchGarment, test } from './fixtures';

// Stills of All round at exact angles, for checking a body change by eye (not a CI test).
// BODY_STILLS=<folder> [BODY_LOOKS=dress,tee,...] [FILM=1] [LINES=1] [FORM=1] [ROUND2D=1 for the canvas painter] npx playwright test -c e2e body-stills --project=phone
const OUT = process.env.BODY_STILLS;
test.skip(!OUT, 'Set BODY_STILLS to a folder to take the stills');

const ALL: [string, GarmentName, string, string[]][] = [
  ['dress-default', 'Dress', 'Neck & sleeves', []],
  // Tab:Group:Name picks, for looks across tabs.
  ['dress-sheath', 'Dress', '', ['Skirt & length:Cut:Sheath', 'Skirt & length:Length:Midi', 'Neck & sleeves:Sleeves:Short']],
  ['dress-circle', 'Dress', '', ['Skirt & length:Cut:Waist seam', 'Skirt & length:Skirt:Full circle', 'Skirt & length:Length:Midi', 'Neck & sleeves:Neckline:Sweetheart', 'Neck & sleeves:Sleeves:Sleeveless']],
  ['dress-shift', 'Dress', '', ['Skirt & length:Cut:Shift', 'Skirt & length:Length:Knee', 'Neck & sleeves:Neckline:Boat', 'Neck & sleeves:Sleeves:Long']],
  ['dress-maxi', 'Dress', '', ['Skirt & length:Cut:Waist seam', 'Skirt & length:Skirt:Gathered', 'Skirt & length:Length:Maxi', 'Neck & sleeves:Neckline:Square', 'Neck & sleeves:Sleeves:Sleeveless']],
  ['coat-belted', 'Coat', 'Shape', []],
  ['fun-blazer', 'Jacket', '', ['Shape:Length:Cropped', 'Shape:Fit:Fitted']],
  ['fun-mini-skirt', 'Skirt', '', ['Shape:Silhouette:A-line', 'Shape:Length:Mini']],
  ['fun-one-shoulder', 'Dress', '', ['Neck & sleeves:Sleeves:Sleeveless', 'Neck & sleeves:Neckline:One-shoulder', 'Skirt & length:Cut:Waist seam', 'Skirt & length:Skirt:Full circle', 'Skirt & length:Length:Mini']],
  ['fun-halter', 'Dress', '', ['Skirt & length:Skirt:Straight', 'Skirt & length:Cut:Sheath', 'Skirt & length:Length:Mini', 'Neck & sleeves:Neckline:Halter']],
  ['fun-slip', 'Dress', '', ['Skirt & length:Cut:Waist seam', 'Skirt & length:Skirt:Trumpet', 'Skirt & length:Length:Above knee', 'Neck & sleeves:Neckline:Cowl']],
  ['fun-puff', 'Dress', '', ['Skirt & length:Skirt:Gathered', 'Skirt & length:Length:Mini', 'Neck & sleeves:Neckline:Square', 'Neck & sleeves:Sleeves:Short']],
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
  if (process.env.OLD) await page.addInitScript((look) => Object.assign(window, { __tourFilm: 'old', __openerLook: look || undefined }), process.env.OLD_LOOK ?? '');
  else if (process.env.FILM) await page.addInitScript(() => ((window as unknown as { __tourFilm: boolean }).__tourFilm = true));
  // SWAY=0.8 tries a share of the back's hollow filled in (engine/body.ts SWAY_FILL).
  if (process.env.SWAY) await page.addInitScript((v) => ((globalThis as { __swayFill?: number }).__swayFill = v), Number(process.env.SWAY));
  if (process.env.ROUND2D) await page.addInitScript(() => ((window as unknown as { __round2d: boolean }).__round2d = true));
  await startWithExample(page);
  const main = page.getByRole('main');
  let current: GarmentName = 'Skirt';
  for (const [key, g, tab, picks] of LOOKS) {
    if (g !== current) await switchGarment(page, g);
    current = g;
    await page.evaluate((on) => Object.assign(window, { __mockBelt: on }), key === 'coat-belted');
    // The length marks stand beside the Form view, not All round.
    const formView = main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'Form', exact: true });
    if (await formView.count()) await formView.click();
    for (const pickName of picks) {
      const [tb, grp, name] = pickName.includes(':') ? pickName.split(':') : [tab, '', pickName];
      const t = main.getByRole('tab', { name: tb, exact: true });
      if (await t.count()) await t.click();
      const b = main.locator(grp ? `fieldset[data-label="${grp}"] button[aria-pressed]` : 'button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${name}\\b`) }).first();
      if (grp === 'Length' && !(await b.count())) {
        const marks = await page.evaluate(() => [...document.querySelectorAll('main .hem-mark')].map((m) => m.textContent?.trim() ?? ''));
        if (process.env.DEBUG_PICKS) console.log('MARKS', key, name, marks);
        await page.evaluate((n) => [...document.querySelectorAll('main .hem-mark')].find((m) => m.textContent?.trim().toUpperCase() === n.toUpperCase())?.querySelector('.hit')?.dispatchEvent(new MouseEvent('click', { bubbles: true })), name);
      }
      else if (await b.count()) await b.evaluate((el) => (el as HTMLElement).click());
      else if (process.env.DEBUG_PICKS) console.log('MISSING', key, pickName, await main.locator('fieldset[data-label]').evaluateAll((fs) => fs.map((f) => f.getAttribute('data-label') + ': ' + [...f.querySelectorAll('button[aria-pressed]')].map((x) => x.textContent?.trim().slice(0, 20)).join(' | '))));
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
