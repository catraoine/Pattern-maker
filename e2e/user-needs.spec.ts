import { expect, fillStepPages, measureMe, openFresh, skipLoading, test } from './fixtures';

// The unmet needs review (Cat's picks A, C and D, Nov 22): a beginner is shown where to start, someone who isn't in
// the room can be sent the measuring link from "Who it is for", and the check page offers to keep the numbers safe
// once sign-in is on.
const SHOTS = process.env.SHOTS_DIR;

test('the skirt is marked as a good first make, and only the skirt', async ({ page }, info) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  // Sign-in is off, so nothing offers an account yet.
  await expect(main.getByRole('button', { name: /Keep them safe/ })).toHaveCount(0);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  const grid = main.getByRole('group', { name: 'What would you like to make?' });
  await expect(grid.getByRole('button', { name: /^Skirt\b/ })).toContainText('Good first make');
  await expect(grid.getByText('Good first make')).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/C-first-make-${info.project.name}.png` });
});

test('someone who is not here can be sent the measuring link from Who it is for', async ({ page }, info) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await main.locator('.who-line').getByRole('button', { name: 'Change' }).click();
  const win = page.getByRole('dialog', { name: 'Who it is for' });
  // Only for someone else, and only once they have a name.
  await expect(win.getByRole('button', { name: /Send them a measuring link/ })).toHaveCount(0);
  await win.getByRole('radio', { name: 'Someone else' }).click();
  const send = win.getByRole('button', { name: /Send them a measuring link/ });
  await expect(send).toBeDisabled();
  await win.getByLabel('Name').fill('Maya');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/D-not-with-you-${info.project.name}.png` });
  await send.click();
  // Maya is added, and her page opens on the link that asks her to measure.
  await expect(main.getByRole('heading', { name: 'Maya', exact: true })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Ask Maya to measure' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/D-ask-page-${info.project.name}.png` });
});

test('with sign-in on, the check page offers to keep the measurements safe', async ({ page }, info) => {
  await openFresh(page);
  // The development stand-in for the account service, as e2e/signin.spec.ts uses.
  await page.evaluate(() => localStorage.setItem('pattern-maker:cloud-fake', '{}'));
  await page.goto('/?signin=preview');
  await skipLoading(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await expect(main.getByText('Kept on this device only.')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/A-keep-safe-${info.project.name}.png` });
  await main.getByRole('button', { name: /Keep them safe with your email/ }).click();
  // Your account, with Your data open on the email box.
  await expect(main.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
});
