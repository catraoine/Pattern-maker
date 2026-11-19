import { expect, openAccount, openFold, openReview, startWithExample, test } from './fixtures';

const SHOTS = process.env.SHOTS_DIR;

test('send to another device: a link from one browser brings measurements and patterns into another', async ({ page, browser }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openReview(page);
  await main.getByRole('button', { name: /^(Save pattern|Save this pattern)$/ }).click();
  await main.getByRole('button', { name: 'Saved patterns' }).click();

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
  // The open piece and its unit come too, so they're listed (pretend tester, Nov 18).
  await expect(arrived).toContainText(/The \w+ you had open, in centimetres/);
  if (SHOTS) await there.screenshot({ path: `${SHOTS}/arrive-${info.project.name}.png` });
  await arrived.getByRole('button', { name: 'Bring it here' }).click();
  await arrived.getByRole('button', { name: 'Carry on' }).click();
  await expect(arrived.getByRole('button', { name: /^Download pattern/ })).toBeVisible();
  // The hash is gone, so a reload doesn't offer it again.
  expect(new URL(there.url()).hash).toBe('');
  await other.close();
});

// A tester's measurements went from her phone (Nov 18): a link sent from a device with nothing measured on it, brought
// onto a phone that held measurements, replaced them. Bringing work now joins the two, and nothing here is lost.
test('bringing work from a device with nothing measured keeps the measurements already here', async ({ page, context, browser }) => {
  await startWithExample(page);
  // This device's measurements taken by hand, not the sample's.
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}');
    a.people = (a.people ?? []).map((p: { id: string; values: Record<string, number>; example?: string[] }) => (p.id === 'me' ? { ...p, values: { ...p.values, waist: 101 }, example: [] } : p));
    localStorage.setItem('pattern-maker:account', JSON.stringify(a));
  });
  await page.reload();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}').people?.find((p: { id: string }) => p.id === 'me')?.values);
  expect(before?.waist).toBe(101);

  // The other device: the sample body only, nothing of its own.
  const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const there = await other.newPage();
  await there.addInitScript(() => {
    localStorage.setItem('maison-trace-access', 'tester');
    localStorage.setItem('maison-trace-steady', '1');
    localStorage.setItem('maison-trace-style-intro', '1');
  });
  await startWithExample(there);
  await there.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await there.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }));
  await openAccount(there);
  const data = await openFold(there, 'Your data');
  await data.getByRole('button', { name: 'Send to another device' }).click();
  const url = await data.getByLabel(/Copy this link/).inputValue();
  await other.close();

  // Tapped on this device, the link opens in a new tab with the same saved work.
  await page.close();
  const tab = await context.newPage();
  await tab.goto(url.replace(/^https?:\/\/[^/]+/, ''));
  const main = tab.getByRole('main');
  await expect(main.getByRole('heading', { name: /Your work/ })).toBeVisible();
  await expect(main).toContainText('is kept too');
  await main.getByRole('button', { name: 'Bring it here' }).click();
  await main.getByRole('button', { name: 'Carry on' }).click();
  const after = await tab.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}').people?.find((p: { id: string }) => p.id === 'me')?.values);
  expect(after).toEqual(before);
});
