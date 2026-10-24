import { expect, openFold, startWithExample, stepButton, test, openLooks } from './fixtures';

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
  const fold = await openFold(page, 'Fit testing');
  const box = fold.getByLabel('Tester code');
  await box.fill('wrong');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await expect(fold).toContainText("That isn't a tester code");
  await box.fill('Atelier26');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await expect(fold).toContainText('Tester code on');
  if (SHOTS) await fold.screenshot({ path: `${SHOTS}/tester-code-${info.project.name}.png` });

  // Kept on this device, and sent with a photo reading.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}').testerCode);
  expect(stored).toBe('Atelier26');
  let sent: string | undefined;
  await page.route('**/.netlify/functions/analyze-photo', (route) => {
    sent = route.request().headers()['x-tester-code'];
    return route.fulfill({ json: { ok: false, error: 'limit_reached' }, status: 429 });
  });
  await stepButton(page, 'Style').click();
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from a photo' }).click();
  await main.locator('input[type=file]').setInputFiles({ name: 'look.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => sent).toBe('Atelier26');
});
