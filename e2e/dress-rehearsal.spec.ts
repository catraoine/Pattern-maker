import type { Page } from '@playwright/test';
import { expect, openFresh, skipLoading, test } from './fixtures';

// What the Dec 7 dress rehearsal walk found cut off (Nov 22): the journey had been checked at iPhone size and at
// laptop sizes, but not on a 360 px phone (many Android phones), and the screen check reads only the words a page
// happens to show, so a measuring heading that fits ("Height") hid the ones that don't ("Underbust").
const main = (page: Page) => page.getByRole('main');
/** How far past the screen's right edge the page's widest thing reaches, in px. */
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const [w, h] of [[1100, 800], [1280, 800], [1366, 768], [1440, 900], [1920, 1080]])
  test(`the longest measuring headings fit their column on a ${w} x ${h} screen`, async ({ page }, info) => {
    test.skip(!!info.project.use.isMobile, 'laptop and desktop screens only');
    await page.setViewportSize({ width: w, height: h });
    await openFresh(page);
    await main(page).getByRole('button', { name: 'Begin' }).click();
    const h1 = main(page).locator('.measure-step h1').first();
    await expect(h1).toBeVisible();
    // The heading's own letters, not the wider stand-in the browser shows until they arrive.
    await page.evaluate(() => document.fonts.ready);
    // Each heading is written in turn into the one on screen and its letters measured against the heading's own box.
    const over = await h1.evaluate((el) => {
      const was = el.textContent;
      const out: Record<string, number> = {};
      for (const words of ['Underbust', 'Shoulder width', 'Bust point to bust point', 'Front shoulder slope']) {
        el.textContent = words;
        const range = document.createRange();
        range.selectNodeContents(el);
        out[words] = Math.round(Math.max(...[...range.getClientRects()].map((r) => r.right)) - el.getBoundingClientRect().right);
      }
      el.textContent = was;
      return out;
    });
    for (const [words, px] of Object.entries(over)) expect(px, `"${words}" stays inside its column`).toBeLessThanOrEqual(0);
  });

test.describe('the waitlist on a 360 px phone', () => {
  test.use({ waitlist: true });

  test('the tester code, its button and "You\'re on the list" all stay on the screen', async ({ page }, info) => {
    test.skip(!info.project.use.isMobile, 'phones only');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.route('**/.netlify/functions/tester', (route) => route.fulfill({ json: { ok: false } }));
    await page.route('**/.netlify/functions/signup', (route) => route.fulfill({ json: { ok: true, ref: 'q4w8e2rt' } }));
    await page.goto('/?fresh');
    await skipLoading(page);
    // The film's label is whole, not cut off by the top of the form.
    const film = await main(page).locator('.tour-play-label').boundingBox();
    const form = await main(page).locator('.welcome-hero').boundingBox();
    expect(film!.y, 'the "How it works" label sits inside the form').toBeGreaterThanOrEqual(form!.y);

    await main(page).getByRole('button', { name: 'Use your code' }).click();
    await main(page).getByLabel('Tester code').fill('NOT-A-CODE');
    const use = main(page).getByRole('button', { name: 'Use code' });
    const b = (await use.boundingBox())!;
    expect(b.x + b.width, 'Use code is on the screen').toBeLessThanOrEqual(360);
    await use.click();
    const said = (await main(page).locator('.waitlist-code .msg').boundingBox())!;
    expect(said.x + said.width, 'what the check said is on the screen').toBeLessThanOrEqual(360);
    expect(await sideways(page)).toBeLessThanOrEqual(0);

    await main(page).getByLabel('Your email').fill('ada@example.com');
    await main(page).getByRole('button', { name: 'Join the waitlist' }).click();
    const title = main(page).getByRole('heading', { level: 1, name: /You're on the list/ });
    await expect(title).toBeVisible();
    expect(await title.evaluate((el) => el.scrollWidth - el.clientWidth), 'the heading is whole').toBeLessThanOrEqual(0);
    const t = (await title.boundingBox())!;
    expect(t.x + t.width).toBeLessThanOrEqual(360);

    // Back later the page is one line longer, and still whole.
    await page.reload();
    await skipLoading(page);
    await expect(main(page).getByRole('button', { name: 'Open the join page' })).toBeVisible();
    expect(await title.evaluate((el) => el.scrollWidth - el.clientWidth), 'the heading is whole on a return').toBeLessThanOrEqual(0);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    const filmBack = await main(page).locator('.tour-play-label').boundingBox();
    const formBack = await main(page).locator('.welcome-hero').boundingBox();
    expect(filmBack!.y, 'the "How it works" label still sits inside the form').toBeGreaterThanOrEqual(formBack!.y);
  });
});

test('Draw your lines fits a 360 px phone, with Enlarge and Demo on the screen', async ({ page }, info) => {
  test.skip(!info.project.use.isMobile, 'phones only');
  await page.setViewportSize({ width: 360, height: 640 });
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await main(page).getByRole('button', { name: 'Try it with an example body' }).click();
  await main(page).getByText('Draw on it', { exact: true }).first().click();
  const tool = main(page).getByRole('button', { name: 'Draw on your form', exact: true });
  if (await tool.isVisible().catch(() => false)) await tool.click();
  await expect(main(page).locator('.form-draw')).toBeVisible();
  expect(await sideways(page), 'the page does not slide sideways').toBeLessThanOrEqual(0);
});

test('in the enlarged drawing on a tablet or laptop, Demo is readable and stands clear of Draw', async ({ page }, info) => {
  test.skip(!!info.project.use.isMobile, 'tablet and laptop screens only');
  let checked = 0;
  for (const [w, h] of [[820, 1180], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await openFresh(page);
    await main(page).getByRole('button', { name: 'Begin' }).click();
    await main(page).getByRole('button', { name: 'Try it with an example body' }).click();
    await main(page).getByRole('button', { name: /^Enlarge/ }).first().click();
    const corner = main(page).locator('section.live-big .preview-corner');
    await expect(corner).toBeVisible();
    const demo = corner.locator('.demo-play');
    // Where the screen is wide enough for the step beside the drawing, Demo lives with the step, not in this corner.
    if (!(await demo.count())) continue;
    checked++;
    expect(parseFloat(await demo.evaluate((el) => getComputedStyle(el).fontSize)), `Demo's letters at ${w} px`).toBeGreaterThanOrEqual(12);
    const d = (await demo.boundingBox())!;
    const drawTool = corner.locator('.drawmenu, [aria-label="Draw on your form"]').first();
    await expect(drawTool).toBeVisible();
    const draw = (await drawTool.boundingBox())!;
    const apart = d.x >= draw.x + draw.width || d.y >= draw.y + draw.height || draw.x >= d.x + d.width || draw.y >= d.y + d.height;
    expect(apart, `Demo and Draw don't overlap at ${w} px`).toBe(true);
  }
  expect(checked, 'Demo was in the corner on at least the tablet').toBeGreaterThan(0);
});
