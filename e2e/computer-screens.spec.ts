import type { Page } from '@playwright/test';
import { expect, fillStepPages, measureMe, openFresh, stepButton, test } from './fixtures';

// A tester's route on laptop and desktop screens (testers on computers, Nov 17): every check before had walked the app
// at iPhone size, and the screen check looks only for words cut off or run over, so the Measure list with its title
// dropped under it, and the collection one tall half-width column, both went out unseen. SHOTS=<folder> keeps photos.
const main = (page: Page) => page.getByRole('main');
const SHOTS = process.env.SHOTS;
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080]])
  test(`a tester's route lays out on a ${w} x ${h} screen`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'laptop and desktop screens only');
    test.setTimeout(3 * 60_000);
    await page.setViewportSize({ width: w, height: h });
    const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${w}-${name}.png`, fullPage: true }));
    await openFresh(page);
    await main(page).getByRole('button', { name: 'Begin' }).click();
    await measureMe(page);
    await fillStepPages(page);
    await main(page).getByRole('button', { name: 'Choose what to make' }).click();
    await main(page).getByRole('button', { name: 'The collection ›' }).click();
    await expect(main(page).getByRole('heading', { name: 'The collection' })).toBeVisible();
    await shot('collection');
    // Four looks across, a set taking two places, in their numbered order: each row starts where the one above did,
    // and no look takes more than half the row.
    const looks = await page.locator('.lookbook > li').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; }));
    const row = (await box(page, '.lookbook')).width;
    const first = looks.filter((l) => l.y === looks[0].y);
    expect(first.reduce((s, l) => s + l.w, 0), 'the first row is full').toBeGreaterThan(row * 0.85);
    for (const l of looks) expect(l.w, 'no look wider than half the row').toBeLessThanOrEqual(row / 2 + 1);
    for (let i = 1; i < looks.length; i++) expect(looks[i].y > looks[i - 1].y || looks[i].x > looks[i - 1].x, 'looks run in order').toBe(true);
    // Each row's drawings start level: a set's name sat over its drawings and pushed them 35 px lower (Nov 17).
    const flats = await page.locator('.lookbook > li').evaluateAll((els) => els.map((e) => ({ y: Math.round(e.getBoundingClientRect().top), flat: Math.round(e.querySelector('.house-flat')!.getBoundingClientRect().top) })));
    for (const f of flats) expect(Math.abs(f.flat - flats.find((g) => g.y === f.y)!.flat), 'drawings start level across a row').toBeLessThanOrEqual(2);

    await main(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Blush Shift', exact: true }) }).getByRole('button', { name: 'Make this look' }).click();
    for (let i = 0; i < 6 && !(await main(page).getByRole('button', { name: 'Change a detail' }).isVisible()); i++) {
      if (await main(page).getByRole('textbox').count()) await fillStepPages(page);
      else await page.waitForTimeout(300);
    }
    await main(page).getByRole('button', { name: 'Change a detail' }).click();
    await expect(main(page).getByRole('slider', { name: /length/i }).first()).toBeVisible();
    await shot('style');
    // Style: the drawing and the step side by side, both on the screen.
    const drawing = await box(page, '.style-pin .preview');
    const panel = await box(page, '.style-panel');
    expect(panel.x, 'the step sits beside the drawing').toBeGreaterThanOrEqual(drawing.x + drawing.width - 1);
    expect(panel.x + panel.width).toBeLessThanOrEqual(w);

    // The Measure list: the garment, then the title, then the list, in one column.
    await stepButton(page, 'Measure').click();
    await expect(main(page).getByRole('heading', { name: 'Your measurements' })).toBeVisible();
    await shot('measure');
    const eyebrow = await box(page, '.measure-list .garment-eyebrow');
    const title = await box(page, '.measure-list h1');
    const list = await box(page, '.measure-list .check-list');
    expect(eyebrow.y, 'the garment over the title').toBeLessThan(title.y);
    expect(title.y + title.height, 'the title over the list').toBeLessThanOrEqual(list.y + 1);
    expect(Math.abs(title.x - list.x), 'one column').toBeLessThan(2);

    await stepButton(page, 'Print').click();
    await expect(main(page).getByRole('button', { name: /^Download (PDF|pattern) \(\d+ pages?\)$/ })).toBeVisible({ timeout: 60_000 });
    await shot('print');
  });
