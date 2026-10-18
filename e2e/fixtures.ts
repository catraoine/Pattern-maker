import { readFile } from 'node:fs/promises';
import { test as base, expect, type Download, type Locator, type Page, type TestInfo } from '@playwright/test';

// Shared steps for the click-throughs. Selectors go by roles and the words on screen, so a restyled
// screen keeps passing; when wording changes, the strings to update are gathered at the top here.

/**
 * Every test fails on a console error or an uncaught exception in the page, listed at the end.
 * A test can let a known message through with `consoleErrors.allow(/pattern/)`.
 */
export const test = base.extend<{ consoleErrors: { allow: (re: RegExp) => void } }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const allowed: RegExp[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}${m.location().url ? ` (${m.location().url})` : ''}`);
      });
      page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
      await use({ allow: (re) => allowed.push(re) });
      expect(errors.filter((e) => !allowed.some((re) => re.test(e))), 'console errors on this path').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Measurements typed in, by the label on screen (sample body A, in cm). Unknown required labels fail loudly. */
export const MEASUREMENTS: Record<string, string> = {
  Waist: '76',
  'Full hip': '102',
  'Waist to hip': '20.5',
  'Waist to knee': '58',
  'Waist to floor': '104',
  'Crotch depth': '27',
  'Crotch length': '70',
  'Full bust': '92',
  'High bust': '86',
  Neck: '35',
  'Shoulder width': '38',
  'Shoulder length': '12',
  'Across back': '35',
  'Across front': '32',
  'Back length': '41',
  'Front length': '44',
  'Bust depth': '26',
  'Bust point to bust point': '18',
  Armhole: '40',
  'Arm length': '59',
  'Upper arm': '29',
  Wrist: '16',
  // "For a closer fit", asked with the arms when adding them: a level body, slopes in line with the lengths.
  'Front shoulder slope': '43',
  'Back shoulder slope': '45',
  'Front waist to hip': '20.5',
  'Back waist to hip': '20.5',
};

/** Garments by a short name. */
export type GarmentName = 'Skirt' | 'Trousers' | 'Bodice' | 'Dress' | 'Tee' | 'Jacket' | 'Coat';
/** What the rest of the app calls each one: "Style your T-shirt", "T-shirt" on the list of what to make. */
const NOUN: Record<GarmentName, string> = { Skirt: 'skirt', Trousers: 'trousers', Bodice: 'bodice', Dress: 'dress', Tee: 'T-shirt', Jacket: 'jacket', Coat: 'coat' };
export const lower = (g: GarmentName) => NOUN[g];
/** The garment's name on "What would you like to make?". */
export const pickName = (g: GarmentName) => NOUN[g][0].toUpperCase() + NOUN[g].slice(1);

const main = (page: Page) => page.getByRole('main');
const heading = (page: Page, name: string | RegExp) => main(page).getByRole('heading', { level: 1, name });

/** The label text of an input, without the "(optional)" note. */
async function labelOf(input: Locator) {
  const text = await input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? el.getAttribute('aria-label') ?? '');
  return text.replace(/\(optional\)/i, '').trim();
}

/** Skip the opening animation (any key does), and wait until the app underneath takes taps. */
export async function skipLoading(page: Page) {
  const loading = page.getByRole('status', { name: /^Loading/ });
  if (await loading.isVisible().catch(() => false)) await page.keyboard.press('Escape');
  await expect(loading).toHaveCount(0);
}

/** A first visit: `?fresh` clears anything this browser saved. */
export async function openFresh(page: Page) {
  await page.goto('/?fresh');
  await skipLoading(page);
  await expect(heading(page, /drafted to your body/i)).toBeVisible();
}

/** Begin, then Skip on the tape across the top of the first measuring page. */
export async function skipToExample(page: Page) {
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await main(page).getByRole('button', { name: 'Skip measuring and try an example' }).click();
}

/** The one-measurement-per-page flow: fill each page until the button that ends it. */
export async function fillStepPages(page: Page) {
  let last = '';
  for (let n = 0; n < 40; n++) {
    const input = main(page).getByRole('textbox');
    await expect.poll(async () => ((await input.count()) === 1 ? labelOf(input) : last), { message: 'the next measurement page opens' }).not.toBe(last);
    const label = await labelOf(input);
    const value = MEASUREMENTS[label];
    expect(value, `a test value for "${label}" (add it to MEASUREMENTS in e2e/fixtures.ts)`).toBeDefined();
    // No placeholder text in the boxes (the owner's rule): the label says what goes in.
    await expect(input).not.toHaveAttribute('placeholder');
    await input.fill(value);
    const next = main(page).getByRole('button', { name: /^(Next|Done|Save)\b/ });
    const name = (await next.textContent())?.trim() ?? '';
    await next.click();
    if (!/^Next$/.test(name)) return;
    last = label;
  }
  throw new Error('Too many measurement pages');
}

/** "What would you like to make?": pick a garment and carry on to the first measurement it still needs. */
export async function pickToMake(page: Page, g: GarmentName) {
  await expect(heading(page, 'What would you like to make?')).toBeVisible();
  const choice = main(page).getByRole('radiogroup', { name: 'What would you like to make?' }).getByRole('radio', { name: new RegExp(`^${pickName(g)}\\b`) });
  await choice.click();
  await expect(choice).toHaveAttribute('aria-checked', 'true');
  await main(page).getByRole('button', { name: 'Start measurements' }).click();
}

/** Wait for the style screen of a garment. */
export async function expectStyle(page: Page, g: GarmentName) {
  await expect(heading(page, `Style your ${lower(g)}`)).toBeVisible();
}

/** "Choose another garment" on the style screen: pick it from the list, measuring for it first when it needs more. */
export async function switchGarment(page: Page, g: GarmentName) {
  await main(page).getByRole('button', { name: 'Choose another garment' }).click();
  await pickToMake(page, g);
  const style = heading(page, `Style your ${lower(g)}`);
  const measuring = main(page).getByRole('textbox');
  await expect(style.or(measuring).first()).toBeVisible();
  if (!(await style.isVisible())) await fillStepPages(page);
  await expectStyle(page, g);
}

/** On a style screen, "Add them" (e.g. the arms, for sleeves): the Measure list, then each measurement for a
 * closer fit on its own page, back to the list, and on to styling again. */
export async function addCloserFit(page: Page, g: GarmentName) {
  await main(page).getByRole('button', { name: 'Add them' }).first().click();
  await expect(heading(page, new RegExp(`${g === 'Tee' ? 'tee' : lower(g)} measurements$`))).toBeVisible();
  await main(page).getByRole('button', { name: 'Add measurements for a closer fit' }).click();
  await fillStepPages(page);
  await main(page).getByRole('button', { name: /^Style your / }).click();
  await expectStyle(page, g);
}

/**
 * On a style screen, open the tab a group of choices is on: its own tab, or the Looks, Fabric or Pro tab it
 * shares. Elsewhere, and when the group already shows, it just returns the group.
 */
export async function openGroup(page: Page, name: string) {
  const group = main(page).getByRole('group', { name, exact: true });
  const tabs = main(page).getByRole('tablist', { name: 'Style choices' });
  if ((await group.isVisible()) || !(await tabs.isVisible())) return group;
  const own = tabs.getByRole('tab', { name, exact: true });
  if (await own.count()) await own.click();
  else
    for (const shared of ['Pro', 'Looks', 'Fabric']) {
      const tab = tabs.getByRole('tab', { name: shared, exact: true });
      if (!(await tab.count())) continue;
      await tab.click();
      if (await group.isVisible()) break;
    }
  await expect(group).toBeVisible();
  return group;
}

/** On a style screen, the Review page with the summary, Print, Save and Edit measurements. */
export async function openReview(page: Page) {
  await main(page).getByRole('button', { name: 'Review', exact: true }).click();
  await expect(heading(page, /^Review /)).toBeVisible();
}

/** Tap a style chip in a named group (Fit, Length, ...), and check it took. */
export async function chooseChip(page: Page, group: string, chip: string) {
  const button = (await openGroup(page, group)).getByRole('button', { name: chip, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/** The steady header's back arrow, which steps back through history like the browser's back. */
export const headerBack = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Back', exact: true });

/** The header's "Your account" button, then wait for the account screen. */
export async function openAccount(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: /^Your account/ }).click();
  await expect(main(page).getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
}

/** A step in the top bar: Measure, Style or Print. */
export const stepButton = (page: Page, name: 'Measure' | 'Style' | 'Print') =>
  page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: new RegExp(`${name}$`) });

/** Download, save it with the test's output, and return its path and bytes. */
export async function download(page: Page, button: Locator, info: TestInfo): Promise<{ download: Download; path: string; bytes: Buffer }> {
  const [d] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const path = info.outputPath(d.suggestedFilename());
  await d.saveAs(path);
  return { download: d, path, bytes: await readFile(path) };
}

/** From a style screen to Print, then download the A4 PDF and check it's a real one. */
export async function printA4(page: Page, info: TestInfo) {
  await openReview(page);
  await main(page).getByRole('button', { name: 'Print my pattern' }).click();
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();
  await chooseChip(page, 'Paper', 'A4');
  const button = main(page).getByRole('button', { name: /^Download PDF \(\d+ pages?\)$/ });
  await expect(button).toBeEnabled({ timeout: 45_000 });
  const { download: d, bytes } = await download(page, button, info);
  expect(d.suggestedFilename()).toMatch(/-a4\.pdf$/);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(20_000);
  return d.suggestedFilename();
}

/** Begin, then Skip at the end of the tape: straight to styling a skirt with the example measurements. */
export async function startWithExample(page: Page) {
  await openFresh(page);
  await skipToExample(page);
  await expectStyle(page, 'Skirt');
}
