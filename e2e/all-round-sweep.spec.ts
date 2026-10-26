import { GarmentName, expect, startWithExample, switchGarment, test } from './fixtures';

// Not a test that runs in CI: a sweep of stills for checking a drawing change by eye, every garment and every kind of
// neckline turned all the way round in the fabric (Cat, 2026-10-26: "how do we ensure this is not happening with
// other garments"). Run it with `npm run sweep:all-round`; scripts/all-round-sheet.py lays the stills out on one sheet.
const OUT = process.env.ROUND_SWEEP;
test.skip(!OUT, 'Set ROUND_SWEEP to a folder to take the sweep');

/** Each garment, and on the dress and the tee each neckline: [garment, tab, choices to pick]. */
const LOOKS: [GarmentName, string, string[]][] = [
  ['Dress', 'Neck & sleeves', ['Crew', 'Short']],
  ['Dress', 'Neck & sleeves', ['Scoop', 'Short']],
  ['Dress', 'Neck & sleeves', ['V-neck', 'Short']],
  ['Dress', 'Neck & sleeves', ['Square', 'Short']],
  ['Dress', 'Neck & sleeves', ['Boat', 'Short']],
  ['Dress', 'Neck & sleeves', ['Sweetheart']],
  ['Bodice', 'Neck & sleeves', []],
  ['Tee', 'Neckline', ['Crew']],
  ['Tee', 'Neckline', ['Scoop']],
  ['Tee', 'Neckline', ['V-neck']],
  ['Jacket', 'Shape', []],
  ['Coat', 'Shape', []],
  ['Skirt', 'Shape', []],
  ['Trousers', 'Shape', []],
];
/** Eight views, about an eighth of a turn apart (measured on the phone layout). */
const STEP = 1 / 12.8;

test('all round sweep', async ({ page }, info) => {
  test.setTimeout(900_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => ((window as unknown as { __tourFilm: boolean }).__tourFilm = true));
  await startWithExample(page);
  const main = page.getByRole('main');
  let current: GarmentName = 'Skirt';
  for (const [g, tab, picks] of LOOKS) {
    if (g !== current) await switchGarment(page, g);
    current = g;
    for (const name of picks) {
      const t = main.getByRole('tab', { name: tab, exact: true });
      if (await t.count()) await t.click();
      const b = main.locator('button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${name}\\b`) }).first();
      if (await b.count()) await b.evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(250);
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
    await cv.scrollIntoViewIfNeeded();
    const name = [g, ...picks.slice(0, 1)].join('-').toLowerCase();
    for (let k = 0; k < 8; k++) {
      await cv.screenshot({ path: `${OUT}/${info.project.name}/${name}/${k}.png` });
      const bb = (await cv.boundingBox())!;
      await page.mouse.move(bb.x + bb.width * 0.8, bb.y + 60);
      await page.mouse.down();
      await page.mouse.move(bb.x + bb.width * (0.8 - STEP), bb.y + 60, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(250);
    }
    await main.getByRole('tab', { name: 'Shape', exact: true }).click();
  }
});
