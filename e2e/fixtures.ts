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
};

export type GarmentName = 'Skirt' | 'Trousers' | 'Bodice' | 'Dress';
const lower = (g: GarmentName) => g.toLowerCase();

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

/** The one-measurement-per-page flow: fill each page until the button that ends it. */
export async function fillStepPages(page: Page) {
  let last = '';
  for (let n = 0; n < 40; n++) {
    const input = main(page).getByRole('textbox');
    await expect.poll(async () => ((await input.count()) === 1 ? labelOf(input) : last), { message: 'the next measurement page opens' }).not.toBe(last);
    const label = await labelOf(input);
    const value = MEASUREMENTS[label];
    expect(value, `a test value for "${label}" (add it to MEASUREMENTS in e2e/fixtures.ts)`).toBeDefined();
    await input.fill(value);
    const next = main(page).getByRole('button', { name: /^(Next|Done|Save)\b/ });
    const name = (await next.textContent())?.trim() ?? '';
    await next.click();
    if (!/^Next$/.test(name)) return;
    last = label;
  }
  throw new Error('Too many measurement pages');
}

/** The full measurements form: fill every empty box we have a number for. */
export async function fillMeasureForm(page: Page) {
  await expect(heading(page, /measurements$/)).toBeVisible();
  const inputs = main(page).getByRole('textbox');
  for (const input of await inputs.all()) {
    if (await input.inputValue()) continue;
    const label = await labelOf(input);
    const optional = /\(optional\)/i.test((await input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent)) ?? '');
    if (MEASUREMENTS[label]) await input.fill(MEASUREMENTS[label]);
    else if (!optional && !(await isPosture(input))) throw new Error(`No test value for required measurement "${label}" (add it to MEASUREMENTS in e2e/fixtures.ts)`);
  }
}
/** "For a closer fit" posture measurements are optional without saying so on the label. */
const isPosture = (input: Locator) =>
  input.evaluate((el) => {
    for (let p = el.closest('.field')?.previousElementSibling; p; p = p.previousElementSibling) if (/closer fit/i.test(p.textContent ?? '')) return true;
    return false;
  });

/** After measuring: the one-time "Whose measurements are these?" page, when it shows. */
export async function answerWhose(page: Page, name = 'Ada') {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
  await main(page).getByRole('button', { name: /^Save and style the / }).click();
}

/** Wait for the style screen of a garment, answering "Whose measurements" on the way if asked. */
export async function expectStyle(page: Page, g: GarmentName) {
  const style = heading(page, `Style your ${lower(g)}`);
  const whose = heading(page, /^Whose measurements/);
  await expect(style.or(whose)).toBeVisible();
  if (await whose.isVisible()) {
    await answerWhose(page);
    await expect(style).toBeVisible();
  }
}

/** Pick a garment on the style or measure screen, measuring for it first when the app asks. */
export async function switchGarment(page: Page, g: GarmentName) {
  await page.getByRole('group', { name: 'What are you making?' }).getByRole('button', { name: g, exact: true }).click();
  const style = heading(page, `Style your ${lower(g)}`);
  const measure = main(page).getByRole('button', { name: `Next: style your ${lower(g)}` });
  await expect(style.or(measure)).toBeVisible();
  if (await measure.isVisible()) {
    await fillMeasureForm(page);
    await measure.click();
  }
  await expectStyle(page, g);
}

/** Tap a style chip in a named group (Fit, Length, ...), and check it took. */
export async function chooseChip(page: Page, group: string, chip: string) {
  const button = main(page).getByRole('group', { name: group, exact: true }).getByRole('button', { name: chip, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
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

/** "Just looking? Try an example": straight to styling a skirt with the example measurements. */
export async function startWithExample(page: Page) {
  await openFresh(page);
  await main(page).getByRole('button', { name: /Try an example/ }).click();
  await expectStyle(page, 'Skirt');
}
