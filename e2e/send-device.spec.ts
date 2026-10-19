import { expect, openFold, openReview, startWithExample, test } from './fixtures';

const SHOTS = process.env.SHOTS_DIR;

test('send to another device: a link from one browser brings measurements and patterns into another', async ({ page, browser }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openReview(page);
  await main.getByRole('button', { name: /^(Save pattern|Keep in my patterns)$/ }).click();
  await main.getByRole('button', { name: 'your patterns' }).click();

  // No share sheet in this browser, so the link is copied, or shown to copy where the clipboard is blocked.
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }));
  const data = await openFold(page, 'Your data');
  await data.getByRole('button', { name: 'Send to another device' }).click();
  const box = data.getByLabel(/Copy this link/);
  await expect(box).toBeVisible();
  const url = await box.inputValue();
  expect(url).toMatch(/#move=(z|p)\./);
  if (SHOTS) await data.screenshot({ path: `${SHOTS}/send-${info.project.name}.png` });

  // A fresh browser: nothing saved there yet.
  const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const there = await other.newPage();
  await there.goto(url.replace(/^https?:\/\/[^/]+/, ''));
  const arrived = there.getByRole('main');
  await expect(arrived.getByRole('heading', { name: /Your work/ })).toBeVisible();
  await expect(arrived).toContainText('1 saved pattern');
  if (SHOTS) await there.screenshot({ path: `${SHOTS}/arrive-${info.project.name}.png` });
  await arrived.getByRole('button', { name: 'Bring it here' }).click();
  await arrived.getByRole('button', { name: 'Carry on' }).click();
  await expect(arrived.getByRole('button', { name: /^Download PDF/ })).toBeVisible();
  // The hash is gone, so a reload doesn't offer it again.
  expect(new URL(there.url()).hash).toBe('');
  await other.close();
});
