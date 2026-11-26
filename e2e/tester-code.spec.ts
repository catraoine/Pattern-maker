import { expect, openFold, openPhoto, startWithExample, stepButton, test } from './fixtures';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const SHOTS = process.env.SHOTS_DIR;

test('fit tester code: checked once, kept, and sent with each photo reading', async ({ page, consoleErrors }, info) => {
  // The stubbed photo reading answers 429, which the browser logs.
  consoleErrors.allow(/429/);
  await page.route('**/.netlify/functions/tester', async (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    await route.fulfill({ json: { ok: true, tester: code.toLowerCase() === 'atelier26' } });
  });
  await startWithExample(page);
  await page.getByRole('banner').getByRole('button', { name: /account/i }).click();
  const fold = await openFold(page, 'Tester');
  const box = fold.getByLabel('Tester code');
  await box.fill('wrong');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await expect(fold).toContainText("That isn't a tester code");
  await box.fill('Atelier26');
  // Shown in capitals as it is typed, so nobody wonders whether case matters (Cat, Nov 15); the check ignores case.
  await expect(box).toHaveValue('ATELIER26');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await expect(fold).toContainText('Tester code on');
  if (SHOTS) await fold.screenshot({ path: `${SHOTS}/tester-code-${info.project.name}.png` });

  // Kept on this device, and sent with a photo reading.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}').testerCode);
  expect(stored).toBe('ATELIER26');
  let sent: string | undefined;
  await page.route('**/.netlify/functions/analyze-photo', (route) => {
    sent = route.request().headers()['x-tester-code'];
    return route.fulfill({ json: { ok: false, error: 'limit_reached' }, status: 429 });
  });
  await stepButton(page, 'Style').click();
  const main = page.getByRole('main');
  await openPhoto(page);
  await main.locator('input[type=file]').setInputFiles({ name: 'look.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => sent).toBe('ATELIER26');
});

test('a tester link on a phone let in before replaces an old saved code, once the new one checks out', async ({ page }) => {
  // Cat's phone, Nov 14: an old code stayed saved after the codes changed, so the body scan turned it away.
  await page.addInitScript(() => {
    if (!localStorage.getItem('pattern-maker:account')) localStorage.setItem('pattern-maker:account', JSON.stringify({ name: '', testerCode: 'old-code' }));
  });
  await page.route('**/.netlify/functions/tester', async (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    await route.fulfill({ json: { ok: true, tester: code === 'new-code' } });
  });
  await page.goto('/?tester=new-code');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}').testerCode)).toBe('new-code');
  // A link with a code that doesn't check out leaves the saved one alone.
  await page.goto('/?tester=nope');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}').testerCode)).toBe('new-code');
});
