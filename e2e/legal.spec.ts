import { expect, headerBack, openAccount, openFresh, startWithExample, test } from './fixtures';

const h1 = (page: import('@playwright/test').Page, name: string | RegExp) => page.getByRole('main').getByRole('heading', { level: 1, name });

test('legal pages open from the welcome fine print; header back and browser back return', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');

  await main.getByRole('button', { name: 'Privacy Policy' }).click();
  await expect(h1(page, 'Privacy Policy')).toBeVisible();
  // The legal pages have no Back of their own: the steady header's back arrow and the browser's back do it.
  await expect(main.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await main.getByRole('button', { name: /Read the Terms of Use/ }).click();
  await expect(h1(page, 'Terms of Use')).toBeVisible();
  await headerBack(page).click();
  await expect(h1(page, 'Privacy Policy')).toBeVisible();
  await page.goBack();
  await expect(h1(page, /drafted to your body/i)).toBeVisible();

  await main.getByRole('button', { name: 'Terms', exact: true }).click();
  await expect(h1(page, 'Terms of Use')).toBeVisible();
  await headerBack(page).click();
  await expect(h1(page, /drafted to your body/i)).toBeVisible();
});

test('legal pages open from Your account mid-pattern, and back returns there', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openAccount(page);

  await main.getByRole('button', { name: 'Terms of Use' }).click();
  await expect(h1(page, 'Terms of Use')).toBeVisible();
  await page.goBack();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();

  await main.getByRole('button', { name: 'Privacy Policy' }).click();
  await expect(h1(page, 'Privacy Policy')).toBeVisible();
  await main.getByRole('button', { name: /Read the Terms of Use/ }).click();
  await expect(h1(page, 'Terms of Use')).toBeVisible();
  await headerBack(page).click();
  await expect(h1(page, 'Privacy Policy')).toBeVisible();
  await headerBack(page).click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
  await headerBack(page).click();
  await expect(h1(page, 'Style your skirt')).toBeVisible();
});

test('"Be a fit tester" in Your account opens the sign-up form', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openAccount(page);

  await main.getByRole('button', { name: 'Be a fit tester' }).click();
  await expect(h1(page, 'Be a fit tester')).toBeVisible();
  for (const box of ['Name', 'Email', 'What would you sew?']) {
    const input = main.getByRole('textbox', { name: box, exact: true });
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('');
    await expect(input).not.toHaveAttribute('placeholder');
  }
  await expect(main.getByRole('checkbox', { name: /fine to email me about fit testing/ })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Sign me up' })).toBeEnabled();

  await headerBack(page).click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
});

test('Atelier Nights and For brands open from Your account; a city opens its own sign-up', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openAccount(page);

  await main.getByRole('button', { name: 'Atelier Nights' }).click();
  await expect(h1(page, 'Cut it tonight')).toBeVisible();
  await expect(main.getByRole('textbox', { name: 'Your email' })).toHaveCount(0);
  await main.getByRole('button', { name: 'Count me in' }).nth(1).click();
  await expect(main.getByRole('textbox', { name: 'Your email' })).toHaveCount(1);
  await expect(main.getByText('Nothing is charged today.')).toBeVisible();
  await headerBack(page).click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();

  await main.getByRole('button', { name: 'For brands' }).click();
  await expect(h1(page, 'Every order cut to the person')).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Try it in your shop first' })).toBeVisible();
  await page.goBack();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
});
