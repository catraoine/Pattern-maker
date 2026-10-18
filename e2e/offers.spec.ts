import { expect, openFold, startWithExample, test } from './fixtures';

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
  const founding = await openFold(page, 'Membership');
  await expect(founding).toContainText('Be one of the first 500');
  await founding.screenshot({ path: info.outputPath('founding.png') });
  await founding.getByRole('textbox', { name: 'Your email' }).fill('ada@example.com');
  await founding.getByRole('button', { name: 'Save my place' }).click();
  await expect(founding).toContainText('Your place is saved');
  expect(sent[1]).toMatchObject({ kind: 'interest', offer: 'founding' });

  await openFold(page, 'Coming soon');
  await expect(main.getByRole('heading', { name: 'Sew a garment with us' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('account.png'), fullPage: true });
});

test('offers: hold a deadstock length, cut too, and ask for cutting', async ({ page }, info) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/.netlify/functions/signup', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Print my pattern' }).click();

  // D3: a cloth that suits the style, and the length from the cutting layout.
  const deadstock = main.getByRole('region', { name: 'Deadstock cloth for this pattern' });
  await expect(deadstock).toContainText('Suits this style');
  await expect(deadstock).toContainText(/\d\.\d m at \d+ cm wide/);
  await deadstock.screenshot({ path: info.outputPath('deadstock.png') });
  await deadstock.getByRole('checkbox', { name: /Cut it for me too/ }).check();
  await deadstock.getByRole('textbox', { name: 'Your email' }).fill('ada@example.com');
  await deadstock.getByRole('button', { name: 'Hold one for me' }).click();
  await expect(deadstock).toContainText('first deadstock drop');
  expect(sent[0]).toMatchObject({ kind: 'interest', offer: 'deadstock', cut: true });

  // C1: on the dressmaker card (all tools), for people who already have their fabric.
  const all = main.getByRole('button', { name: 'Show all tools' });
  if (await all.count()) await all.click();
  const cut = main.locator('.offer.inset', { has: page.getByRole('heading', { name: 'Cut for me' }) });
  await expect(cut).toContainText('Post your fabric to the studio');
  await expect(cut).toContainText('posting address go only to the cutting studio');
  await cut.screenshot({ path: info.outputPath('cutforme.png') });
  await cut.getByRole('textbox', { name: 'Your email' }).fill('ada@example.com');
  await cut.getByRole('button', { name: 'Tell me when it opens' }).click();
  await expect(cut).toContainText('when cutting opens');
  expect(sent[1]).toMatchObject({ kind: 'interest', offer: 'cutforme' });

  // Once the fabric is chosen, the deadstock card steps aside.
  await main.getByLabel('Name', { exact: true }).fill('Wool from the market');
  await expect(deadstock).toHaveCount(0);
});
