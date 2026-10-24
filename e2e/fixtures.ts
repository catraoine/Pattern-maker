import { readFile } from 'node:fs/promises';
import { test as base, expect, type Download, type Locator, type Page, type TestInfo } from '@playwright/test';

// Shared steps for the click-throughs. Selectors go by roles and the words on screen, so a restyled
// screen keeps passing; when wording changes, the strings to update are gathered at the top here.

/**
 * Every test fails on a console error or an uncaught exception in the page, listed at the end.
 * A test can let a known message through with `consoleErrors.allow(/pattern/)`.
 */
export const test = base.extend<{ consoleErrors: { allow: (re: RegExp) => void }; waitlist: boolean; access: void }>({
  // Until launch a stranger gets the waitlist (Cat's W1, 2026-10-21); the click-throughs run as a tester let in
  // before, unless a test sets `test.use({ waitlist: true })`.
  waitlist: [false, { option: true }],
  access: [
    async ({ page, waitlist }, use) => {
      if (!waitlist) await page.addInitScript(() => localStorage.setItem('maison-trace-access', 'tester'));
      // A pick on Style holds its question open, rather than moving on to the next, so a test can pick and check.
      await page.addInitScript(() => localStorage.setItem('maison-trace-steady', '1'));
      await use();
    },
    { auto: true },
  ],
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
  Height: '165',
  // Its own optional page after the five basics.
  Weight: '62',
  Waist: '76',
  'Full hip': '102',
  'Waist to hip': '20.5',
  'Waist to knee': '58',
  'Waist to floor': '104',
  'Crotch depth': '27',
  'Crotch length': '70',
  'Full bust': '92',
  Underbust: '76',
  'Torso loop': '152',
  // The menswear form's bust.
  Chest: '100',
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

/** Begin, then the quiet Skip link under the first measuring page's buttons. */
export async function skipToExample(page: Page) {
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await main(page).getByRole('button', { name: 'Measure later' }).click();
}

/** "Me" on the first measuring page, with the form to draft on beside it (Cat's F1 Form Joins In): womenswear unless given. */
export async function measureMe(page: Page, form: 'Womenswear' | 'Menswear' = 'Womenswear') {
  await main(page).getByRole('radio', { name: 'For me' }).click();
  const pick = main(page).getByRole('radiogroup', { name: 'Which form to draft on?' }).getByRole('radio', { name: new RegExp(`^${form}`) });
  await pick.click();
  await expect(pick).toHaveAttribute('aria-checked', 'true');
  await main(page).getByRole('button', { name: 'Begin measuring', exact: true }).click();
}

/** The one-measurement-per-page flow: fill each page until the button that ends it. */
export async function fillStepPages(page: Page): Promise<number> {
  let last = '';
  let filled = 0;
  for (let n = 0; n < 40; n++) {
    const input = main(page).getByRole('textbox');
    const checked = heading(page, 'Do these look right?');
    await expect.poll(async () => ((await input.count()) === 1 ? labelOf(input) : (await checked.count()) ? '' : last), { message: 'the next measurement page opens' }).not.toBe(last);
    // The optional weight page's Next lands on the check page, which has no box.
    if (last && (await checked.count())) return filled;
    const label = await labelOf(input);
    const value = MEASUREMENTS[label];
    expect(value, `a test value for "${label}" (add it to MEASUREMENTS in e2e/fixtures.ts)`).toBeDefined();
    // No placeholder text in the boxes (the owner's rule): the label says what goes in.
    await expect(input).not.toHaveAttribute('placeholder');
    await input.fill(value);
    filled++;
    const next = main(page).getByRole('button', { name: /^(Next|Done|Save)\b/ });
    const name = (await next.textContent())?.trim() ?? '';
    await next.click();
    if (!/^Next$/.test(name)) return filled;
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
  // The button says what comes next: the measurements it still needs, or straight to styling it.
  await main(page).getByRole('button', { name: /^(Next: \d+ .+ measurements?|Style my .+)$/ }).click();
}

/** Wait for the style screen of a garment. */
export async function expectStyle(page: Page, g: GarmentName) {
  await expect(heading(page, `Style your ${lower(g)}`)).toBeVisible();
}

/** The garment drop-down on the Style title: pick another, measuring for it first when it needs more. */
export async function switchGarment(page: Page, g: GarmentName) {
  await chooseDrop(page, 'Garment', new RegExp(`^${pickName(g)}\\b`));
  const style = heading(page, `Style your ${lower(g)}`);
  const measuring = main(page).getByRole('textbox');
  await expect(style.or(measuring).first()).toBeVisible();
  if (!(await style.isVisible())) await fillStepPages(page);
  await expectStyle(page, g);
}

/** Open a drop-down by its name (Garment, Paper, Fabric width) and pick from its list. */
export async function chooseDrop(page: Page, name: string, item: string | RegExp) {
  const drop = main(page).getByRole('group', { name, exact: true });
  await drop.getByRole('button', { expanded: false }).click();
  await drop.getByRole('menuitemradio', { name: item }).click();
  await expect(drop.getByRole('menu')).toHaveCount(0);
}

/** On a style screen, "Add them" (e.g. the arms, for sleeves): the Measure list, then each measurement for a
 * closer fit on its own page, back to the list, and on to styling again. */
export async function addCloserFit(page: Page, g: GarmentName) {
  const add = main(page).getByRole('button', { name: 'Add them' }).first();
  // The link sits under the choice that needs them (Sleeves, Length): look through the tabs for it.
  find: for (const tab of await main(page).getByRole('tablist', { name: 'Style choices' }).getByRole('tab').all()) {
    if (await add.isVisible()) break;
    await tab.click();
    for (const head of await main(page).locator('fieldset.fold:not([hidden]) > legend > button.fold-head').all()) {
      if (await add.isVisible()) break find;
      await head.click();
    }
  }
  await add.click();
  await expect(heading(page, /measurements$/)).toBeVisible();
  await expect(main(page).locator('.garment-eyebrow')).toContainText(new RegExp(g === 'Tee' ? 't-shirt' : lower(g), 'i'));
  await main(page).getByRole('button', { name: /more for a closer fit$/ }).click();
  await fillStepPages(page);
  await main(page).getByRole('button', { name: /^Style your / }).click();
  await expectStyle(page, g);
}

/**
 * On a style screen, open the tab a group of choices is on: its own tab, or the tab it shares (Shape, Neck &
 * sleeves, Length & hem, Details, Looks, Fabric, Pro). Elsewhere, and when the group already shows, it just
 * returns the group.
 */
export async function openGroup(page: Page, name: string) {
  const group = main(page).getByRole('group', { name, exact: true });
  const tabs = main(page).getByRole('tablist', { name: 'Style choices' });
  if (!(await group.isVisible()) && (await tabs.isVisible())) {
    const own = tabs.getByRole('tab', { name, exact: true });
    if (await own.count()) await own.click();
    else
      for (const tab of await tabs.getByRole('tab').all()) {
        await tab.click();
        if (await group.isVisible()) break;
      }
  }
  await expect(group).toBeVisible();
  await unfold(group);
  return group;
}

/** On a step with several questions only one is open (Cat's D, 2026-10-24): open this one by its folded line. */
export async function unfold(group: Locator) {
  const head = group.locator(':scope > legend > button.fold-head');
  if ((await head.count()) && (await head.getAttribute('aria-expanded')) === 'false') await head.click();
}

/** "Start from a look", by the Style title: the photo and the Maison collection (no longer a step of their own). */
export async function openLooks(page: Page) {
  const link = main(page).getByRole('button', { name: 'Start from a look' });
  if ((await link.getAttribute('aria-pressed')) !== 'true') await link.click();
}

/** "Show all tools": on a style screen it sits under the last tab only, so open that tab first. */
export async function showAllTools(page: Page) {
  const all = main(page).getByRole('button', { name: 'Show all tools' });
  const tabs = main(page).getByRole('tablist', { name: 'Style choices' });
  if (!(await all.isVisible()) && (await tabs.isVisible())) await tabs.getByRole('tab').last().click();
  return all;
}

/** "Draw on your form" (or another way to draw): on the skirt and bodice it sits in the Draw list. */
export async function drawTool(page: Page, name = 'Draw on your form') {
  const tool = main(page).getByRole('button', { name, exact: true });
  if (!(await tool.isVisible())) await main(page).locator('.drawmenu > summary').click();
  return tool;
}

/** On the print screen, open "Extras for this pattern", where the offers and the label card are folded. */
export async function openExtras(page: Page) {
  const extras = main(page).locator('details.extras');
  if (!(await extras.evaluate((d) => (d as HTMLDetailsElement).open))) await extras.locator('summary').click();
  return extras;
}

/**
 * On a style screen, the Review page with the summary, Print, Save and Edit measurements. On a computer
 * (Cat's D1 Drafting Table) the summary is already beside the choices, so there's no page to open.
 */
export async function openReview(page: Page): Promise<boolean> {
  const review = main(page).getByRole('button', { name: 'Review', exact: true });
  const print = main(page).getByRole('button', { name: 'Print my pattern' });
  await expect(review.or(print).first()).toBeVisible();
  if (!(await review.isVisible())) {
    await openNumbers(page);
    return false;
  }
  await review.click();
  await expect(heading(page, /^Review /)).toBeVisible();
  await openNumbers(page);
  return true;
}

/** The summary's numbers, pieces and Keep in my patterns fold under one line on Review and in the computer's
 *  side panel (look and feel review R1, 2026-10-24): open that fold so the tests can read them. */
async function openNumbers(page: Page) {
  const fold = main(page).locator('details.review-fold').first();
  if (!(await fold.count())) return;
  if (!(await fold.evaluate((d) => (d as HTMLDetailsElement).open))) await fold.locator('> summary').click();
}

/** From a style screen (or its Review page) to Print. */
export async function goPrint(page: Page) {
  const print = main(page).getByRole('button', { name: 'Print my pattern' });
  if (!(await print.isVisible())) await openReview(page);
  await print.click();
}

/** Tap a style chip in a named group (Fit, Length, ...), and check it took. */
/** The hem dot on the drawing, which sets the length of a skirt, dress, T-shirt or trousers. */
export const lengthDot = (page: Page) => main(page).getByRole('slider', { name: /^(Skirt|Dress|T-shirt|Trouser) length$/ });

/** Pick a named length by tapping its mark beside the drawing, then check the hem dot reads it. */
export async function chooseLength(page: Page, name: string) {
  await main(page).locator('.preview .hem-mark').filter({ hasText: new RegExp(`^${name}$`, 'i') }).click();
  await expect(lengthDot(page)).toHaveAttribute('aria-valuetext', name);
}

export async function chooseChip(page: Page, group: string, chip: string) {
  // The length is set on the drawing, not with buttons, where the garment has a hem dot (Cat, 2026-10-24).
  if (group === 'Length' && (await lengthDot(page).count())) return chooseLength(page, chip);
  const button = (await openGroup(page, group)).getByRole('button', { name: chip, exact: true });
  // By its corner: tapping the drawing on a tile that is already picked opens it full size instead.
  await button.click({ position: { x: 4, y: 4 } });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/** The steady header's back arrow, which steps back through history like the browser's back. */
export const headerBack = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Back', exact: true });

/** The header's "Your account" button, then wait for the account screen. */
export async function openAccount(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: /^Your account/ }).click();
  await expect(main(page).getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
}

/** Opens a folded row on the account screen (Saved patterns starts open), by its heading. */
export async function openFold(page: Page, title: string | RegExp) {
  const fold = main(page).getByRole('region', { name: title });
  const details = fold.locator('details').first();
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await fold.locator('summary').first().click();
  return fold;
}

/** A step in the top bar: Measure, Style or Print. */
export const stepButton = (page: Page, name: 'Measure' | 'Style' | 'Print') =>
  page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: new RegExp(`${name}$`) });

/** Download, save it with the test's output, and return its path and bytes. */
export async function download(page: Page, button: Locator, info: TestInfo): Promise<{ download: Download; path: string; bytes: Buffer }> {
  const waiting = page.waitForEvent('download');
  await button.click();
  // On the example body the first print asks first; these tests print it anyway.
  const anyway = page.getByRole('main').getByRole('button', { name: 'Print the example anyway' });
  await anyway.waitFor({ timeout: 1000 }).then(() => anyway.click(), () => undefined);
  const d = await waiting;
  const path = info.outputPath(d.suggestedFilename());
  await d.saveAs(path);
  return { download: d, path, bytes: await readFile(path) };
}

/** From a style screen to Print, then download the A4 PDF and check it's a real one. */
export async function printA4(page: Page, info: TestInfo) {
  await goPrint(page);
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();
  await chooseDrop(page, 'Paper', 'A4');
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

/** "How to sew it" on the print screen folds shut on a phone (the aesthetic review, 2026-10-21): open it to read the steps. */
export async function openSew(page: Page) {
  const fold = main(page).locator('details.sew');
  await expect(fold).toBeVisible();
  if (!(await fold.evaluate((el) => (el as HTMLDetailsElement).open))) await fold.locator('> summary').click();
  await expect(fold).toHaveAttribute('open', '');
}
