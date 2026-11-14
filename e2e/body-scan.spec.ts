import { expect, openFold, startWithExample, test } from './fixtures';

const SHOTS = process.env.SHOTS_DIR;

test('body scan: only testers see it, and it opens the scanner from a pass our server gets', async ({ page }, info) => {
  await page.route('**/.netlify/functions/tester', (route) => route.fulfill({ json: { ok: true, tester: true } }));
  let sent: string | undefined;
  await page.route('**/.netlify/functions/body-scan', (route) => {
    sent = route.request().headers()['x-tester-code'];
    return route.fulfill({ json: { ok: true, url: 'https://platform.bodygram.com/en/org_example/scan?token=example&system=metric' } });
  });
  await startWithExample(page);
  await page.getByRole('banner').getByRole('button', { name: /account/i }).click();
  const fold = await openFold(page, 'Fit testing');
  // Not a tester yet: no scan.
  await expect(fold.getByRole('button', { name: 'Start a body scan' })).toHaveCount(0);

  await fold.getByLabel('Tester code').fill('example-code');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await fold.getByRole('button', { name: 'Start a body scan' }).click();
  const open = fold.getByRole('link', { name: /Open the scanner/ });
  await expect(open).toHaveAttribute('href', /platform\.bodygram\.com\/.*token=example/);
  await expect(open).toHaveAttribute('target', '_blank');
  expect(sent).toBe('example-code');
  await expect(fold).toContainText('email just the numbers');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/body-scan-${info.project.name}.png` });
});

test('body scan: says plainly when today\'s scans are used up', async ({ page, consoleErrors }) => {
  // The stubbed answer is a 429, which the browser logs.
  consoleErrors.allow(/429/);
  await page.route('**/.netlify/functions/tester', (route) => route.fulfill({ json: { ok: true, tester: true } }));
  await page.route('**/.netlify/functions/body-scan', (route) => route.fulfill({ status: 429, json: { ok: false, error: 'limit_reached' } }));
  await startWithExample(page);
  await page.getByRole('banner').getByRole('button', { name: /account/i }).click();
  const fold = await openFold(page, 'Fit testing');
  await fold.getByLabel('Tester code').fill('example-code');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await fold.getByRole('button', { name: 'Start a body scan' }).click();
  await expect(fold).toContainText("That's all the scans for today");
});
