import type { Page } from '@playwright/test';
import { chooseChip, expect, expectStyle, fillStepPages, goPrint, measureMe, openAccount, openFold, openFresh, openReview, pickToMake, startWithExample, stepButton, test } from './fixtures';

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
  await page.addInitScript(() => { (window as unknown as { __first: string }).__first = JSON.stringify({ nav: performance.getEntriesByType('navigation').map((e) => (e as PerformanceNavigationTiming).type), state: history.state, place: sessionStorage.getItem('maison-trace-place') }); });
  const first = () => page.evaluate(() => (window as unknown as { __first: string }).__first);
  await page.evaluate(() => location.reload()).catch(() => {});
  await page.waitForTimeout(1500);
  await page.waitForLoadState('load');
  console.log('DIAG location.reload', await first());
  await goPrint(page).catch(() => {});
  await page.keyboard.press('F5');
  await page.waitForTimeout(1500);
  console.log('DIAG F5', await first());
  await goPrint(page).catch(() => {});
  await page.reload();
  console.log('DIAG page.reload', await first());
  await expect(main(page).getByRole('group', { name: 'Paper' })).toBeVisible();
  await page.goBack();
  await expectStyle(page, 'Skirt');
});

test('a printed pattern is kept in Saved patterns', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  const download = main(page).getByRole('button', { name: /^Download pattern/ });
  await expect(download).toBeEnabled({ timeout: 45_000 });
  const waiting = page.waitForEvent('download');
  await download.click();
  await main(page).getByRole('button', { name: 'Print the example anyway' }).click();
  await waiting;
  // The example body isn't kept: only a pattern drafted to someone.
  await expect(main(page)).not.toContainText('Saved in Your account');

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
  await expect(main(page).getByRole('status').filter({ hasText: 'Saved in Your account' })).toBeVisible();
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

test('Email me the files sends the pattern and its instructions the app made, and says where they went', async ({ page }) => {
  let sent: { to: string; pdf: string; fileName: string; booklet?: string; bookletName?: string } | undefined;
  let code: string | undefined;
  await page.route('**/.netlify/functions/email-pdf', async (route) => {
    sent = route.request().postDataJSON();
    code = route.request().headers()['x-tester-code'];
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/.netlify/functions/tester', (route) => route.fulfill({ json: { ok: true, tester: true } }));
  await startWithExample(page);
  // A fit tester types any address, sent with their code (weekly review, Nov 16); signed in, it goes to their own email.
  await page.getByRole('banner').getByRole('button', { name: /account/i }).click();
  const fold = await openFold(page, 'Fit testing');
  await fold.getByLabel('Tester code').fill('atelier26');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await expect(fold).toContainText('Tester code on');
  await stepButton(page, 'Style').click();
  await goPrint(page);
  const email = main(page).getByRole('button', { name: 'Email me the files' });
  await expect(email).toBeEnabled({ timeout: 45_000 });
  await email.click();
  await main(page).locator('form.email-pdf').getByLabel('Your email').fill('sewist@example.com');
  await main(page).getByRole('button', { name: 'Send', exact: true }).click();
  await main(page).getByRole('button', { name: 'Print the example anyway' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'Sent to sewist@example.com' })).toBeVisible();
  expect(sent?.to).toBe('sewist@example.com');
  expect(code).toBe('ATELIER26');
  expect(sent?.pdf.startsWith('JVBER')).toBe(true);
  expect(sent?.fileName).toMatch(/\.pdf$/);
  // The instructions booklet goes with it as its own file (Cat, Nov 15).
  expect(sent?.booklet?.startsWith('JVBER')).toBe(true);
  expect(sent?.bookletName).toMatch(/-instructions\.pdf$/);
});

test('without a tester code or a sign-in, the email way is not offered (weekly review, Nov 16)', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  await expect(main(page).getByRole('button', { name: 'Print the example anyway' }).or(main(page).getByText('Blank pages are left out'))).toBeVisible({ timeout: 45_000 });
  await expect(main(page).getByRole('button', { name: 'Email me the files' })).toHaveCount(0);
});

test('the print screen says blank pages are left out', async ({ page }) => {
  await startWithExample(page);
  await goPrint(page);
  await expect(main(page)).toContainText('Blank pages are left out');
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
    (navigator as unknown as { share: (d: { url: string; text?: string }) => Promise<void> }).share = async (d) => {
      (window as unknown as { shared: string; sharedText?: string }).shared = d.url;
      (window as unknown as { sharedText?: string }).sharedText = d.text;
    };
  });
  await openAccount(page);
  await main(page).getByRole('region', { name: /Your data/ }).locator('summary').first().click();
  await main(page).getByRole('button', { name: 'Send to another device' }).click();
  // The link is made after the click (the work is packed first), so wait for it.
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: string }).shared ?? '')).toContain('#move=');
  const link = await page.evaluate(() => (window as unknown as { shared: string }).shared);
  // The link goes alone, so the share sheet's Copy copies the link and not a sentence (Cat, Nov 15).
  expect(await page.evaluate(() => (window as unknown as { sharedText?: string }).sharedText)).toBeUndefined();

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
  await main(app).getByRole('button', { name: 'Started in your browser? Bring your work here' }).click();
  // Pasted with words around it (a whole message copied), it still finds the link.
  // The link inside a message, with the full stop of its sentence after it (code review, Nov 15).
  await main(app).getByLabel('Link you copied').fill(`My Maison Tracé measurements and patterns: ${link}. `);
  await main(app).getByRole('button', { name: 'Bring it here' }).click();
  await expect(h1(app, /Your work/)).toBeVisible();
  await main(app).getByRole('button', { name: 'Bring it here' }).click();
  await expect(h1(app, /Your work is on this device/)).toBeVisible();
  await ctx.close();
});
