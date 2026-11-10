import type { Page } from '@playwright/test';
import { chooseChip, expect, expectStyle, fillStepPages, goPrint, measureMe, openAccount, openFresh, openReview, pickToMake, startWithExample, stepButton, test } from './fixtures';

// The app journey review (Nov 10, 2026): what testers hit going back, reloading, saving and printing, and the fixes Cat
// applied ("do all fixes").

const main = (page: Page) => page.getByRole('main');
const h1 = (page: Page, name: string | RegExp) => main(page).getByRole('heading', { level: 1, name });

test('a side trip from Style to fix a measurement comes back to Style', async ({ page }) => {
  await startWithExample(page);
  await stepButton(page, 'Measure').click();
  await expect(h1(page, 'Your measurements')).toBeVisible();
  await main(page).getByRole('button', { name: /^Waist/ }).first().click();
  await main(page).getByRole('textbox').fill('80');
  await main(page).getByRole('button', { name: 'Save' }).click();
  await expect(h1(page, 'Your measurements')).toBeVisible();
  await page.goBack();
  await expectStyle(page, 'Skirt');
  // From Print too: back from the measurements returns to Print.
  await goPrint(page);
  await stepButton(page, 'Measure').click();
  await expect(h1(page, 'Your measurements')).toBeVisible();
  await page.goBack();
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();
});

test('a reload keeps your place, and back still climbs from there', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();
  await page.reload();
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();
  await page.goBack();
  await expectStyle(page, 'Skirt');
});

test('a printed pattern is kept in Saved patterns', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const download = main(page).getByRole('button', { name: /^Download PDF/ });
  await expect(download).toBeEnabled({ timeout: 45_000 });
  const waiting = page.waitForEvent('download');
  await download.click();
  await main(page).getByRole('button', { name: 'Print the example anyway' }).click();
  await waiting;
  // The example body isn't kept: only a pattern drafted to someone.
  await expect(main(page)).not.toContainText('Kept in Your account');

  // Measured: printing keeps it.
  test.setTimeout(150_000);
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  if (!(await h1(page, 'Style your skirt').isVisible({ timeout: 3000 }).catch(() => false))) await fillStepPages(page);
  await expectStyle(page, 'Skirt');
  await goPrint(page);
  await expect(download).toBeEnabled({ timeout: 45_000 });
  const again = page.waitForEvent('download');
  await download.click();
  await again;
  await expect(main(page).getByRole('status').filter({ hasText: 'Kept in Your account' })).toBeVisible();
  await openAccount(page);
  await expect(main(page).getByRole('region', { name: 'Saved patterns' })).toContainText('1 of 3');
});

test('Back to the original style puts the choices back, after asking', async ({ page }) => {
  await startWithExample(page);
  await chooseChip(page, 'Fit', 'Fitted');
  await openReview(page);
  await main(page).getByRole('button', { name: 'Back to the original style' }).click();
  await main(page).getByRole('button', { name: 'Keep my choices' }).click();
  await main(page).getByRole('button', { name: 'Back to the original style' }).click();
  await main(page).getByRole('button', { name: 'Yes, start over' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'Back to the original style.' })).toBeVisible();
  const fit = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}').choices?.fit);
  expect(fit).toBe('regular');
});

test('Email me the PDF sends the PDF the app made, and says where it went', async ({ page }) => {
  let sent: { to: string; pdf: string; fileName: string } | undefined;
  await page.route('**/.netlify/functions/email-pdf', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await startWithExample(page);
  await goPrint(page);
  const email = main(page).getByRole('button', { name: 'Email me the PDF' });
  await expect(email).toBeEnabled({ timeout: 45_000 });
  await email.click();
  await main(page).locator('form.email-pdf').getByLabel('Your email').fill('sewist@example.com');
  await main(page).getByRole('button', { name: 'Send the PDF' }).click();
  await main(page).getByRole('button', { name: 'Print the example anyway' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'Sent to sewist@example.com' })).toBeVisible();
  expect(sent?.to).toBe('sewist@example.com');
  expect(sent?.pdf.startsWith('JVBER')).toBe(true);
  expect(sent?.fileName).toMatch(/\.pdf$/);
});

test('the print screen says blank pages are left out', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  await expect(main(page)).toContainText('Pages with nothing on them are left out');
});

test.describe('on an upright iPad', () => {
  test.use({ viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true });
  test('the Style choices show above the Next button', async ({ page }) => {
    await startWithExample(page);
    const chip = main(page).getByRole('button', { name: 'Fitted', exact: true });
    await expect(chip).toBeInViewport();
    const bar = await main(page).locator('.style-bar').boundingBox();
    const box = await chip.boundingBox();
    expect(box!.y + box!.height).toBeLessThan(bar!.y);
  });
});

test('in the home-screen app, work from Safari comes across with a pasted link', async ({ page, browser }) => {
  // In Safari: Send to another device, with the share sheet caught to read the link.
  await startWithExample(page);
  await page.evaluate(() => {
    (navigator as unknown as { share: (d: { url: string }) => Promise<void> }).share = async (d) => {
      (window as unknown as { shared: string }).shared = d.url;
    };
  });
  await openAccount(page);
  await main(page).getByRole('region', { name: /Your data/ }).locator('summary').first().click();
  await main(page).getByRole('button', { name: 'Send to another device' }).click();
  const link = await page.evaluate(() => (window as unknown as { shared: string }).shared);
  expect(link).toContain('#move=');

  // The home-screen app: its own storage, opened in standalone mode.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: test.info().project.use.baseURL });
  const app = await ctx.newPage();
  await app.addInitScript(() => {
    localStorage.setItem('maison-trace-access', 'tester');
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes('display-mode: standalone') ? ({ ...real(q), matches: true } as MediaQueryList) : real(q));
  });
  await app.goto('/');
  await app.keyboard.press('Escape');
  await main(app).getByRole('button', { name: 'Started in Safari? Bring your work here' }).click();
  await main(app).getByLabel('Link from Safari').fill(link);
  await main(app).getByRole('button', { name: 'Bring it here' }).click();
  await expect(h1(app, /Your work/)).toBeVisible();
  await main(app).getByRole('button', { name: 'Bring it here' }).click();
  await expect(h1(app, /Here/)).toBeVisible();
  await ctx.close();
});
