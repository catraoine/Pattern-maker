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
  // With a pattern saved, Saved patterns offers to keep it safe; the offer lands on the email box.
  await main.getByRole('region', { name: 'Saved patterns' }).getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#signin-email')).toBeFocused();
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

test('Continue with Google signs in and brings what was made on this device, as the sign-in box says', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openReview(page);
  await main.getByRole('button', { name: /^(Save pattern|Keep in my patterns)$/ }).click();
  await page.evaluate((k) => localStorage.setItem(k, '{}'), FAKE);
  await accountAt(page, '/?signin=preview');
  const data = await openFold(page, 'Your data');
  await expect(data.getByTestId('signin-copied')).toHaveText('Anything already on this phone or computer is copied into your account the first time you sign in.');
  if (SHOTS) await data.screenshot({ path: `${SHOTS}/signin-google-${info.project.name}.png` });
  await data.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(data).toContainText('Signed in as google-sewist@example.com');
  await expect(data.getByRole('status').first()).toHaveText('Saved to your account.');
  const store = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAKE);
  expect(store.users['google-sewist@example.com'].backup.account.patterns).toHaveLength(1);
});

/** Signs in on Your account with the stand-in's code, and waits for the sign-in to show. */
async function signIn(page: Page, email: string) {
  const data = await openFold(page, 'Your data');
  await data.getByLabel('Email').fill(email);
  await data.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await data.getByLabel('Code from the email').fill('123456');
  await data.getByRole('button', { name: 'Sign in' }).click();
  await expect(data).toContainText(`Signed in as ${email}`);
  return data;
}

/** A pattern saved as a guest, then this device signed in to one account and signed out again. */
async function usedByAnother(page: Page) {
  await startWithExample(page);
  await openReview(page);
  await page.getByRole('main').getByRole('button', { name: /^(Save pattern|Keep in my patterns)$/ }).click();
  await page.evaluate((k) => localStorage.setItem(k, '{}'), FAKE);
  await accountAt(page, '/?signin=preview');
  const data = await signIn(page, 'first@example.com');
  await expect(data.getByRole('status').first()).toHaveText('Saved to your account.');
  await data.getByRole('button', { name: 'Sign out' }).click();
  await expect(data.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
}

// The engineering review (Nov 10): on a shared computer the first person's work went into the next person's account.
// Cat's pick (a): signing in on a device last signed in to another account asks first.
test('signing in on a computer another account used asks first; "Use only my account" brings nothing over', async ({ page }, info) => {
  await usedByAnother(page);
  const data = await signIn(page, 'second@example.com');
  const ask = data.getByTestId('cloud-ask');
  await expect(ask).toContainText('Someone else was signed in on this device before you');
  if (SHOTS) await data.screenshot({ path: `${SHOTS}/signin-ask-${info.project.name}.png` });
  // Nothing goes to the account before the answer.
  expect((await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAKE)).users['second@example.com'].backup).toBeNull();
  await ask.getByRole('button', { name: 'Use only my account' }).click();
  await expect(data.getByRole('status').first()).toHaveText('Saved to your account.');
  await expect(savedRows(page)).toHaveCount(0);
  const store = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAKE);
  expect(store.users['second@example.com'].backup.account.patterns).toHaveLength(0);
  expect(store.users['first@example.com'].backup.account.patterns).toHaveLength(1);
});

test('"Copy their work into my account" brings the other account\'s patterns over', async ({ page }) => {
  await usedByAnother(page);
  const data = await signIn(page, 'second@example.com');
  await data.getByTestId('cloud-ask').getByRole('button', { name: 'Copy their work into my account' }).click();
  await expect(data.getByRole('status').first()).toHaveText('Saved to your account.');
  await expect(savedRows(page)).toHaveCount(1);
  const store = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAKE);
  expect(store.users['second@example.com'].backup.account.patterns).toHaveLength(1);
});

test('"Delete everything", then signing in again, brings the account\'s work back and keeps it in the account', async ({ page }) => {
  await usedByAnother(page);
  await signIn(page, 'first@example.com');
  // The same account again: no question.
  await expect(page.getByTestId('cloud-ask')).toHaveCount(0);
  const data = await openFold(page, 'Your data');
  await data.getByRole('button', { name: 'Delete my data and start over' }).click();
  await data.getByRole('button', { name: 'Delete everything' }).click();
  await accountAt(page, '/?signin=preview');
  await expect(savedRows(page)).toHaveCount(0);
  await signIn(page, 'first@example.com');
  await expect(page.getByTestId('cloud-ask')).toHaveCount(0);
  await expect(savedRows(page)).toHaveCount(1);
  const store = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAKE);
  expect(store.users['first@example.com'].backup.account.patterns).toHaveLength(1);
});
