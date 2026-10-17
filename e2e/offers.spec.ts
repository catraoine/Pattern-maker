import { expect, startWithExample, test } from './fixtures';

// Paid extras that aren't open yet show as email sign-ups. The signup function isn't served by Vite,
// so it's stubbed here and the test checks what the app sends.
test('offers: sign up for printing by post and a founding place', async ({ page }, info) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/.netlify/functions/signup', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await startWithExample(page);
  const main = page.getByRole('main');

  await main.getByRole('button', { name: 'Print my pattern' }).click();
  const printed = main.getByRole('region', { name: 'Have it printed and posted' });
  await expect(printed).toContainText('$12');
  await printed.getByRole('textbox', { name: 'Your email' }).fill('ada@example.com');
  await printed.getByRole('button', { name: 'Tell me when it opens' }).click();
  await expect(printed).toContainText("We'll email you when printing by post opens");
  await printed.screenshot({ path: info.outputPath('printed.png') });
  expect(sent[0]).toMatchObject({ kind: 'interest', offer: 'printed', email: 'ada@example.com', website: '' });

  await main.getByRole('button', { name: 'Save pattern' }).click();
  await main.getByRole('button', { name: 'your patterns' }).click();
  const founding = main.getByRole('region', { name: 'Be one of the first 500' });
  await founding.screenshot({ path: info.outputPath('founding.png') });
  await founding.getByRole('textbox', { name: 'Your email' }).fill('ada@example.com');
  await founding.getByRole('button', { name: 'Save my place' }).click();
  await expect(founding).toContainText('Your place is saved');
  expect(sent[1]).toMatchObject({ kind: 'interest', offer: 'founding' });

  await main.getByText('Sew-alongs, designers and gifts').click();
  await expect(main.getByRole('heading', { name: 'Sew a garment with us' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('account.png'), fullPage: true });
});
