import { expect, skipLoading, test } from './fixtures';

test.use({ waitlist: true });

test('a stranger gets the waitlist where Begin was, and joining counts against their bio link', async ({ page }) => {
  let sent: Record<string, unknown> | undefined;
  await page.route('**/.netlify/functions/signup', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/?fresh&src=ig');
  await skipLoading(page);
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Begin' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: /how it works/i })).toBeVisible();
  // Nothing in the header leads into the app.
  await expect(page.getByRole('banner').getByRole('button', { name: /account/i })).toHaveCount(0);

  await main.getByLabel('Your email').fill('ada@example.com');
  await main.getByRole('button', { name: 'Join the waitlist' }).click();
  await expect(main.getByRole('heading', { level: 1, name: /You're on the list/ })).toBeVisible();
  expect(sent).toMatchObject({ kind: 'news', email: 'ada@example.com', src: 'ig' });
  expect(await page.evaluate(() => localStorage.getItem('maison-trace-source'))).toBe('ig');

  // The Privacy Policy opens, and back comes home to the waitlist, not the app.
  await page.reload();
  await skipLoading(page);
  await main.getByRole('button', { name: 'Privacy Policy' }).click();
  await expect(page.getByRole('banner').getByRole('button', { name: /account/i })).toHaveCount(0);
  await page.getByRole('banner').getByRole('button', { name: 'Back' }).click();
  await expect(main.getByRole('button', { name: 'Join the waitlist' })).toBeVisible();
});

test('a tester link lets this device into the full app for good, and leaves the address bar', async ({ page }) => {
  await page.route('**/.netlify/functions/tester', async (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    await route.fulfill({ json: { ok: true, tester: code.toLowerCase() === 'toile-one' } });
  });
  await page.goto('/?fresh&tester=TOILE-ONE&src=ig');
  await skipLoading(page);
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Begin' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('?src=ig');
  await page.goto('/');
  await skipLoading(page);
  await expect(main.getByRole('button', { name: 'Begin' })).toBeVisible();
});

test('a wrong tester link says so, and the code can be typed instead', async ({ page }) => {
  await page.route('**/.netlify/functions/tester', async (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    await route.fulfill({ json: { ok: true, tester: code.toLowerCase() === 'toile-two' } });
  });
  await page.goto('/?fresh&tester=nope');
  await skipLoading(page);
  const main = page.getByRole('main');
  await expect(main).toContainText("That tester link isn't working");
  await main.getByLabel('Tester code').fill('Toile-Two');
  await main.getByRole('button', { name: 'Use code' }).click();
  await expect(main.getByRole('button', { name: 'Begin' })).toBeVisible();
});

test('back from the confirm email, the waitlist says you are on the list', async ({ page }) => {
  await page.goto('/?fresh&joined');
  await skipLoading(page);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: /You're on the list/ })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
});

test('on a phone the waitlist rises over the form drawn at full size, and the language is a tag on the email line', async ({ page }, info) => {
  await page.goto('/?fresh');
  await skipLoading(page);
  const main = page.getByRole('main');
  const hero = page.locator('.welcome-hero');
  if (info.project.name === 'phone') {
    // Curtain Up (Cat's O2, 2026-10-25): the form takes Begin's room first, then the waitlist comes up over it.
    const full = (await hero.boundingBox())!.height;
    await expect(main.getByRole('button', { name: 'Join the waitlist' })).toBeVisible();
    await expect.poll(async () => (await hero.boundingBox())!.height).toBeLessThan(full - 60);
    const canvas = (await hero.locator('canvas').boundingBox())!.height;
    expect(canvas).toBeGreaterThan(full - 2);
  }
  // L1 (2026-10-25): the language is picked from the tag at the end of the email line.
  await expect(main.getByText('EN', { exact: true })).toBeVisible();
  await main.getByLabel('I sew in').selectOption('de');
  await expect(main.getByText('DE', { exact: true })).toBeVisible();
  await expect(main).toContainText('We\'ll tell you when Maison Tracé speaks it.');
});
