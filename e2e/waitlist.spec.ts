import { expect, skipLoading, test } from './fixtures';

test.use({ waitlist: true });

test('a stranger gets the waitlist where Begin was, and joining counts against their bio link', async ({ page }) => {
  let sent: Record<string, unknown> | undefined;
  await page.route('**/.netlify/functions/signup', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, ref: 'k7q2m9ab' } });
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
  // Their own link to bring sewing friends (Cat's "apply", Nov 11 2026).
  await expect(main.getByText(/Bring two sewing friends/)).toBeVisible();
  await expect(main.getByLabel('Your link')).toHaveValue(/\/\?ref=k7q2m9ab$/);
  await expect(main.getByRole('button', { name: 'Share link' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('maison-trace-source'))).toBe('ig');

  // The Privacy Policy opens, and back comes home to the waitlist, not the app.
  await page.reload();
  await skipLoading(page);
  // The footer is the one word Privacy (Cat's A, Nov 6): "How it's made" lives in the app, not on the waitlist.
  await expect(main.getByRole('button', { name: "How it's made" })).toHaveCount(0);
  await main.getByRole('button', { name: 'Privacy', exact: true }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('button', { name: /account/i })).toHaveCount(0);
  await page.getByRole('banner').getByRole('button', { name: 'Back' }).click();
  await expect(main.getByRole('button', { name: 'Join the waitlist' })).toBeVisible();
});

// The code stays in the address (journey review, Nov 10): an iPhone's home-screen icon opens the address it was added
// from, in storage of its own, so without the code the icon opened the waitlist.
test('a tester link lets this device into the full app for good, and stays in the address for the home-screen icon', async ({ page }) => {
  await page.route('**/.netlify/functions/tester', async (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    await route.fulfill({ json: { ok: true, tester: code.toLowerCase() === 'toile-one' } });
  });
  await page.goto('/?fresh&tester=TOILE-ONE&src=ig');
  await skipLoading(page);
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Begin' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('tester')).toBe('TOILE-ONE');
  expect(new URL(page.url()).searchParams.get('src')).toBe('ig');
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

test('on a phone the waitlist sits over the form drawn at full size from the start, and the language is a tag on the email line', async ({ page }, info) => {
  await page.goto('/?fresh');
  await skipLoading(page);
  const main = page.getByRole('main');
  const hero = page.locator('.welcome-hero');
  // A stranger can join at once: no loading screen and nothing to wait for (the waitlist review, Cat's A, 2026-11-10).
  await expect(main.getByRole('button', { name: 'Join the waitlist' })).toBeInViewport({ timeout: 1500 });
  await expect(main).toContainText('The waitlist gets first claim on 250 numbered Founding places.');
  if (info.project.name === 'phone') {
    // Curtain Up (Cat's O2, 2026-10-25): the form keeps Begin's full height, cropped from the bottom by the waitlist.
    const shown = (await hero.boundingBox())!.height;
    const canvas = (await hero.locator('canvas').boundingBox())!.height;
    expect(canvas).toBeGreaterThan(shown + 60);
  }
  // L1 (2026-10-25): the language is picked from the tag at the end of the email line.
  await expect(main.getByText('EN', { exact: true })).toBeVisible();
  await main.getByLabel('I sew in').selectOption('de');
  await expect(main.getByText('DE', { exact: true })).toBeVisible();
  await expect(main).toContainText('We\'ll tell you when Maison Tracé speaks it.');
});

test('maisontrace.co/privacy and /terms open those pages for a stranger, and lead nowhere past the waitlist', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/privacy');
  await skipLoading(page);
  await expect(main.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('button', { name: /account/i })).toHaveCount(0);
  await page.goto('/terms/');
  await skipLoading(page);
  await expect(main.getByRole('heading', { level: 1, name: /Terms/ })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('button', { name: /account/i })).toHaveCount(0);
});

test('a friend from a shared link is counted for whoever shared it', async ({ page }) => {
  let sent: Record<string, unknown> | undefined;
  await page.route('**/.netlify/functions/signup', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, ref: 'zz11yy22' } });
  });
  await page.goto('/?fresh&ref=k7q2m9ab');
  await skipLoading(page);
  const main = page.getByRole('main');
  await main.getByLabel('Your email').fill('bea@example.com');
  await main.getByRole('button', { name: 'Join the waitlist' }).click();
  await expect(main.getByRole('heading', { level: 1, name: /You're on the list/ })).toBeVisible();
  expect(sent).toMatchObject({ kind: 'news', email: 'bea@example.com', ref: 'k7q2m9ab', src: 'friend' });
  // And they get their own link to pass on.
  await expect(main.getByLabel('Your link')).toHaveValue(/\/\?ref=zz11yy22$/);
});
