import type { Page } from '@playwright/test';
import { expect, openAccount, openFold, openReview, skipLoading, startWithExample, test } from './fixtures';

// Sign-in (Cat's plan, 2026-10-23), against the development stand-in for the account service: the "server" is a
// localStorage key and the emailed code is always 123456 (see src/cloud/api.ts). Hidden until ?signin=preview.
const FAKE = 'pattern-maker:cloud-fake';
const SHOTS = process.env.SHOTS_DIR;
const savedRows = (page: Page) => page.getByRole('main').getByRole('region', { name: 'Saved patterns' }).getByRole('listitem');

/** Opens the address, past the welcome (on with the garment, or Begin and the example), to Your account. */
async function accountAt(page: Page, url: string) {
  await page.goto(url);
  await skipLoading(page);
  const main = page.getByRole('main');
  const carryOn = main.getByRole('button', { name: /^Carry on with your/ });
  const begin = main.getByRole('button', { name: 'Begin' });
  await expect(carryOn.or(begin)).toBeVisible();
  if (await carryOn.isVisible()) await carryOn.click();
  else {
    await begin.click();
    await main.getByRole('button', { name: 'Measure later' }).click();
  }
  await openAccount(page);
}

test('guest work survives signing in, comes to a second device, and the account can be deleted', async ({ page, browser }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openReview(page);
  await main.getByRole('button', { name: /^(Save pattern|Keep in my patterns)$/ }).click();

  // Without the preview link there's no sign-in.
  await openAccount(page);
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
  await expect(savedRows(page)).toHaveCount(1);
  await expect(main.getByRole('button', { name: 'Email me a sign-in link' })).toHaveCount(0);

  await page.evaluate((k) => localStorage.setItem(k, '{}'), FAKE);
  await accountAt(page, '/?signin=preview');
  const data = await openFold(page, 'Your data');
  await data.getByLabel('Email').fill('sewist@example.com');
  await data.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(data).toContainText('Check your email');
  if (SHOTS) await data.screenshot({ path: `${SHOTS}/signin-code-${info.project.name}.png` });
  await data.getByLabel('Code from the email').fill('123456');
  await data.getByRole('button', { name: 'Sign in' }).click();
  await expect(data).toContainText('Signed in as sewist@example.com');
  await expect(data.getByRole('status').first()).toHaveText('Saved to your account.');
  await expect(savedRows(page)).toHaveCount(1);
  if (SHOTS) await data.screenshot({ path: `${SHOTS}/signin-in-${info.project.name}.png` });

  // The account holds the pattern made as a guest.
  const store = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAKE);
  expect(store.users['sewist@example.com'].backup.account.patterns).toHaveLength(1);

  // A second device, signed out, with nothing on it: signing in brings the pattern.
  const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await other.addInitScript(
    ([k, s]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('maison-trace-access', 'tester');
      localStorage.setItem(k, s);
    },
    [FAKE, JSON.stringify({ users: store.users })],
  );
  const there = await other.newPage();
  await accountAt(there, '/?signin=preview');
  await expect(savedRows(there)).toHaveCount(0);
  const thereData = await openFold(there, 'Your data');
  await thereData.getByLabel('Email').fill('Sewist@example.com ');
  await thereData.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await thereData.getByLabel('Code from the email').fill('123456');
  await thereData.getByRole('button', { name: 'Sign in' }).click();
  await expect(thereData).toContainText('Signed in as sewist@example.com');
  await expect(savedRows(there)).toHaveCount(1);

  // Signing out keeps the work on this device.
  await thereData.getByRole('button', { name: 'Sign out' }).click();
  await expect(thereData.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await expect(savedRows(there)).toHaveCount(1);
  await other.close();

  // Deleting the account removes it from the service, and leaves this device's work.
  await data.getByRole('button', { name: 'Delete my account' }).click();
  await data.getByRole('button', { name: 'Delete my account' }).last().click();
  await expect(data.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAKE);
  expect(after.users['sewist@example.com']).toBeUndefined();
  await expect(savedRows(page)).toHaveCount(1);
});

test('a wrong code says so and lets you try again', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((k) => localStorage.setItem(k, '{}'), FAKE);
  await accountAt(page, '/?signin=preview');
  const data = await openFold(page, 'Your data');
  await data.getByLabel('Email').fill('sewist@example.com');
  await data.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await data.getByLabel('Code from the email').fill('000000');
  await data.getByRole('button', { name: 'Sign in' }).click();
  await expect(data).toContainText("That code didn't work");
  await data.getByLabel('Code from the email').fill('123456');
  await data.getByRole('button', { name: 'Sign in' }).click();
  await expect(data).toContainText('Signed in as sewist@example.com');
});
