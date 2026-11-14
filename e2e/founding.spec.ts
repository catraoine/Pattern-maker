import { expect, openAccount, openFold, skipLoading, test } from './fixtures';

// Founding Atelier (promised Nov 12 2026): from Feb 9 a founding member comes past the waitlist by signing in with the
// email on the founding list, and Your account shows their number and what they were promised. Against the
// development stand-in for the account service (emailed code 123456) and its stand-in founding list.
test.use({ waitlist: true });
const SHOTS = process.env.SHOTS_DIR;

const places = { 'early@example.com': { n: 60, kind: 'founding' }, 'tester@example.com': { n: 3, kind: 'tester' } };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((p) => {
    if (localStorage.getItem('pattern-maker:cloud-fake') === null) localStorage.setItem('pattern-maker:cloud-fake', '{}');
    localStorage.setItem('pattern-maker:founding-fake', JSON.stringify(p));
  }, places);
});

async function signIn(page: import('@playwright/test').Page, email: string) {
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Sign in to come in early' }).click();
  await main.getByLabel('Email', { exact: true }).fill(email);
  await main.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await main.getByLabel('Code from the email').fill('123456');
  await main.getByRole('button', { name: 'Sign in' }).click();
}

test('before Feb 9 the waitlist has no founding sign-in', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-02-08T23:30:00-08:00'));
  await page.goto('/?signin=preview');
  await skipLoading(page);
  await expect(page.getByRole('main').getByRole('button', { name: 'Join the waitlist' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'Sign in to come in early' })).toHaveCount(0);
});

test('from Feb 9 a founding member signs in past the waitlist and sees their number', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2027-02-09T09:00:00-08:00'));
  await page.goto('/?signin=preview');
  await skipLoading(page);
  const main = page.getByRole('main');
  if (SHOTS) await main.screenshot({ path: `${SHOTS}/founding-waitlist-${info.project.name}.png` });
  await signIn(page, 'early@example.com');
  // In: the waitlist gives way to the app's own welcome.
  await expect(main.getByRole('button', { name: 'Join the waitlist' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Begin' })).toBeVisible();
  await main.getByRole('button', { name: 'Begin' }).click();
  await main.getByRole('button', { name: 'Measure later' }).click();
  await openAccount(page);
  const fold = await openFold(page, 'Membership');
  await expect(fold.locator('summary').first()).toContainText('Founding member No. 60');
  const card = main.getByTestId('founding-member');
  await expect(card).toContainText('Founding Atelier · No. 60');
  await expect(card).toContainText('$35 a year instead of $49, locked in for as long as you stay');
  if (SHOTS) await card.screenshot({ path: `${SHOTS}/founding-account-${info.project.name}.png` });
});

test('an email not on the founding list stays on the waitlist, and is told why', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-02-09T09:00:00-08:00'));
  await page.goto('/?signin=preview');
  await skipLoading(page);
  await signIn(page, 'stranger@example.com');
  const main = page.getByRole('main');
  await expect(main.getByText("That email isn't on the founding list.", { exact: false })).toBeVisible();
  // Still on the waitlist page: nothing of the app opened.
  await expect(main.getByRole('button', { name: 'Begin' })).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('button', { name: /account/i })).toHaveCount(0);
});
