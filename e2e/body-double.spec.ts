import { download, expect, goPrint, openAccount, openFold, startWithExample, test, openExtras, openSew } from './fixtures';

// Body Double (B1, B2, B5): a store form padded to you, a cover drafted to the same body, and a check once padded.
test('body double: pad map, cover pattern and form check', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openAccount(page);
  await openFold(page, 'Body Double');
  await main.getByRole('button', { name: 'Make my form' }).click();
  await expect(main.getByRole('heading', { name: 'A dress form in your shape' })).toBeVisible();
  await expect(main.getByRole('heading', { name: /^Buy a size \d+ form$/ })).toBeVisible();
  await expect(main.getByRole('table', { name: 'Padding to add' })).toContainText('Waist');
  await page.screenshot({ path: info.outputPath('body-double.png'), fullPage: true });

  // B5: a padded form that measures 2 cm small at the waist says to add wadding there.
  await main.locator('#formcheck-full_bust').fill('92');
  await main.locator('#formcheck-waist').fill('74');
  await main.locator('#formcheck-full_hip').fill('102');
  await expect(main.getByText(/Add .* round the waist/)).toBeVisible();
  await main.locator('#formcheck-waist').fill('76');
  await expect(main.getByText('It’s ready to fit on.')).toBeVisible();

  await main.getByRole('button', { name: 'Get the cover pattern' }).click();
  await expect(main.getByRole('heading', { name: 'Form cover' })).toBeVisible();
  await expect(main.getByText(/· 4 pieces/)).toBeVisible();
  const pdf = main.getByRole('button', { name: /^Download PDF \(\d+ pages?\)$/ });
  await expect(pdf).toBeEnabled({ timeout: 45_000 });
  const { bytes } = await download(page, pdf, info);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  await openSew(page);
  await expect(main.getByText('Pad the form')).toBeVisible();
  await page.screenshot({ path: info.outputPath('form-cover-print.png'), fullPage: true });
});

// Signature labels (L1, L4): a saved pattern gets a code, labels print at home, and the code opens it again.
test('signature labels: code, label sheet and open from a label', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await goPrint(page);
  await openExtras(page);
  const card = main.getByRole('region', { name: 'Sign what you made' });
  await expect(card).toContainText('Keep this pattern in your patterns to give it its code');
  await card.getByRole('button', { name: 'Keep in my patterns' }).click();
  await expect(card).toContainText(/MT-[2-9A-Z]{4}/);
  const code = (await card.textContent())!.match(/MT-[2-9A-Z]{4}/)![0];
  const sheet = card.getByRole('button', { name: 'Print labels at home' });
  await expect(sheet).toBeEnabled({ timeout: 30_000 });
  const { bytes, download: d } = await download(page, sheet, info);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(d.suggestedFilename()).toBe(`labels-${code.toLowerCase()}.pdf`);
  await expect(card.getByRole('button', { name: 'Tell me when it opens' })).toBeVisible();
  await card.screenshot({ path: info.outputPath('label-card.png') });

  await openAccount(page);
  const byCode = main.getByRole('region', { name: 'Open from a label' });
  await byCode.getByRole('textbox', { name: 'Label code' }).fill(code.toLowerCase().replace('-', ' '));
  await byCode.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(main.getByRole('tablist', { name: 'Style choices' })).toBeVisible();
});
