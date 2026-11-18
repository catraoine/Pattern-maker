import type { Page } from '@playwright/test';
import { expect, startWithExample, test } from './fixtures';

// A tester opened her tester link on her computer to print, as the emails say, and found an empty app: her measurements
// were on her phone (testers, Nov 18). On a computer with nothing here yet, a tester is pointed to Send to my computer.
const main = (page: Page) => page.getByRole('main');

test('a tester on a computer with nothing here brings her work across from her phone', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'the phone makes the link once');
  test.setTimeout(3 * 60_000);
  // Her phone: measured (the example body), then Print, Other ways, Send to my computer, as the steps say.
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: info.project.use.baseURL });
  const phone = await phoneCtx.newPage();
  await phone.addInitScript(() => {
    localStorage.setItem('maison-trace-access', 'tester');
    // As the test pages have it: Style opens on its questions.
    localStorage.setItem('maison-trace-steady', '1');
    localStorage.setItem('maison-trace-style-intro', '1');
    (navigator as unknown as { share: (d: { url: string }) => Promise<void> }).share = async (d) => {
      (window as unknown as { shared: string }).shared = d.url;
    };
  });
  await startWithExample(phone);
  await phone.getByRole('navigation').getByRole('button', { name: 'Print' }).click();
  await main(phone).getByRole('button', { name: 'Send to my computer' }).click();
  await expect.poll(() => phone.evaluate(() => (window as unknown as { shared?: string }).shared ?? '')).toContain('#move=');
  const link = await phone.evaluate(() => (window as unknown as { shared: string }).shared);
  await phoneCtx.close();

  // Her computer: the tester link, nothing measured.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, baseURL: info.project.use.baseURL });
  const computer = await ctx.newPage();
  await computer.route('**/.netlify/functions/tester', (r) => r.fulfill({ json: { ok: true, tester: true } }));
  await computer.goto('/?tester=EXAMPLE-ONLY');
  await computer.keyboard.press('Escape');
  if (process.env.SHOTS) await computer.waitForTimeout(3000);
  if (process.env.SHOTS) await computer.screenshot({ path: `${process.env.SHOTS}/from-phone-welcome.png` });
  await main(computer).getByRole('button', { name: 'Measured on your phone? Bring your work here' }).click();
  await expect(computer.getByText('Under Other ways, tap Send to my computer.')).toBeVisible();
  if (process.env.SHOTS) await computer.screenshot({ path: `${process.env.SHOTS}/from-phone-sheet.png` });
  await main(computer).getByLabel('Link you sent yourself').fill(link);
  await main(computer).getByRole('button', { name: 'Bring it here' }).click();
  await expect(computer.getByRole('heading', { level: 1, name: /Your work/ })).toBeVisible();
  await ctx.close();
});

test('someone who is not a tester is not pointed to a phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a computer');
  await page.goto('/?fresh');
  await page.keyboard.press('Escape');
  await expect(main(page).getByRole('button', { name: 'Begin' })).toBeVisible();
  await expect(main(page).getByRole('button', { name: /Measured on your phone/ })).toHaveCount(0);
});
