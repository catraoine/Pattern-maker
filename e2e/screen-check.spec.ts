import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { GarmentName, MEASUREMENTS, expect, expectStyle, goPrint, measureMe, openAccount, openFresh, startWithExample, stepTabs, switchGarment, test } from './fixtures';
import { auditScreen } from './screenAudit';

// Not part of the ordinary end-to-end run: the screen check (Quality: Automated checks, Cat 2026-11-04). Every screen
// of the app, on a phone and on a computer, is photographed and looked over for words cut off and things standing
// past the edge of the screen (screenAudit.ts): the welcome and waitlist pages, every measuring page, every Style step
// of every garment with each of its views, Review, Print and the account. SCREEN_CHECK=<folder> takes it; the photos
// and what was found land there, and src/screenCheck.test.ts holds the findings to src/screenKnown.json.
const OUT = process.env.SCREEN_CHECK;
test.skip(!OUT, 'Set SCREEN_CHECK to a folder to take the screen check');

const main = (page: Page) => page.getByRole('main');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Looks the screen over and photographs it, under its name and the device it's on. */
function looker(page: Page, project: string, part: string) {
  const found: Record<string, string[]> = {};
  const dir = `${OUT}/${project}`;
  mkdirSync(dir, { recursive: true });
  return {
    async look(screen: string) {
      await page.waitForTimeout(350);
      const key = `${project}: ${screen}`;
      found[key] = await auditScreen(page);
      await page.screenshot({ path: `${dir}/${slug(screen)}.png`, fullPage: true }).catch(() => {});
    },
    save() {
      writeFileSync(`${OUT}/screens-${project}-${slug(part)}.json`, JSON.stringify(found, null, 1));
    },
  };
}

test.beforeEach(async ({ page, consoleErrors }) => {
  consoleErrors.allow(/.*/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('waitlist', () => {
  test.use({ waitlist: true });
  test('screens: waitlist', async ({ page }, info) => {
    const l = looker(page, info.project.name, 'waitlist');
    await page.goto('/?fresh');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1500);
    await l.look('waitlist');
    l.save();
  });
});

test('screens: welcome and measuring', async ({ page }, info) => {
  test.setTimeout(600_000);
  const l = looker(page, info.project.name, 'measure');
  await openFresh(page);
  await l.look('welcome');
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await l.look('measure: who for');
  await measureMe(page);
  // Each measuring page, by the measurement it asks for, then the check page.
  for (let n = 0; n < 40; n++) {
    const input = main(page).getByRole('textbox');
    await expect(input.or(main(page).getByRole('heading', { level: 1, name: 'Do these look right?' })).first()).toBeVisible();
    if (!(await input.count())) break;
    const label = (await input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).replace(/\(optional\)/i, '').trim();
    await l.look(`measure: ${label}`);
    await fillOne(page);
    const checked = main(page).getByRole('heading', { level: 1, name: 'Do these look right?' });
    if (await checked.isVisible().catch(() => false)) break;
  }
  await l.look('measure: do these look right');
  l.save();
});

/** Fills the one measuring page that's open, and moves on. */
async function fillOne(page: Page) {
  const input = main(page).getByRole('textbox');
  const label = (await input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? el.getAttribute('aria-label') ?? '')).replace(/\(optional\)/i, '').trim();
  await input.fill(MEASUREMENTS[label] ?? '50');
  await main(page).getByRole('button', { name: /^(Next|Done|Save)\b/ }).click();
  await page.waitForTimeout(250);
}

const GARMENTS: GarmentName[] = ['Skirt', 'Trousers', 'Bodice', 'Dress', 'Tee', 'Jacket', 'Coat'];
for (const g of GARMENTS)
  test(`screens: ${g}`, async ({ page }, info) => {
    test.setTimeout(600_000);
    const l = looker(page, info.project.name, g);
    await startWithExample(page);
    if (g !== 'Skirt') await switchGarment(page, g);
    const name = g.toLowerCase();
    const count = await (await stepTabs(page)).getByRole('tab').count();
    for (let i = 0; i < count; i++) {
      const t = (await stepTabs(page)).getByRole('tab').nth(i);
      const tab = ((await t.getAttribute('aria-label')) ?? (await t.textContent()) ?? `step ${i + 1}`).trim();
      await t.click();
      await l.look(`style ${name}: ${tab}`);
    }
    const views = main(page).getByRole('group', { name: 'Garment view' });
    for (const v of ['Flat', 'All round']) {
      const b = views.getByRole('button', { name: v, exact: true });
      if (await b.count()) {
        await b.click();
        await l.look(`style ${name}: ${v} view`);
      }
    }
    const pattern = main(page).getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ });
    if (await pattern.count()) {
      await pattern.click();
      await l.look(`style ${name}: Pattern view`);
    }
    const review = main(page).getByRole('button', { name: /^Review( all choices)?$/ }).first();
    if (await review.isVisible().catch(() => false)) {
      await review.click();
      await l.look(`style ${name}: Review`);
    }
    await goPrint(page);
    await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
    await l.look(`print ${name}`);
    l.save();
  });

// A dress with sleeves and a full skirt reaches the edges of the Flat drawing, where the corner's tools stand (Cat's
// dress of Nov 7: V neck, circle skirt, elbow sleeves). Each view, and the box's height in it: switching views must
// not move the view line (Cat, Nov 7).
test('screens: a full dress in every view', async ({ page }, info) => {
  test.setTimeout(300_000);
  const l = looker(page, info.project.name, 'full dress');
  await startWithExample(page);
  await switchGarment(page, 'Dress');
  await page.evaluate(() => {
    const key = 'pattern-maker:skirt';
    const s = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...s, choices: { ...s.choices, silhouette: 'circle' }, bodice: { ...s.bodice, neckline: 'v', sleeve: 'elbow' } }));
  });
  await page.reload();
  await page.keyboard.press('Escape').catch(() => {});
  const carry = main(page).getByRole('button', { name: /^Carry on with your dress/i });
  if (await carry.isVisible().catch(() => false)) await carry.click();
  await expectStyle(page, 'Dress');
  const box = () => page.locator('.style-pin .preview').first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
  const heights: number[] = [];
  const views = main(page).getByRole('group', { name: 'Garment view' });
  for (const v of ['Front', 'Flat', 'All round']) {
    await views.getByRole('button', { name: v, exact: true }).click();
    await l.look(`style full dress: ${v} view`);
    heights.push(await box());
  }
  await main(page).getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }).click();
  await l.look('style full dress: Pattern view');
  heights.push(await box());
  l.save();
  expect(new Set(heights).size, `the drawing's box the same height in every view (${heights.join(', ')} px)`).toBe(1);
});

test('screens: account', async ({ page }, info) => {
  test.setTimeout(300_000);
  const l = looker(page, info.project.name, 'account');
  await startWithExample(page);
  await openAccount(page);
  await l.look('account');
  for (const s of await main(page).locator('details:not([open]) > summary').all()) await s.click({ timeout: 3000 }).catch(() => {});
  await l.look('account: every fold open');
  l.save();
});
