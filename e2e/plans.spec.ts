import { expect, openFold, openFresh, skipToExample, startWithExample, test } from './fixtures';

// Billing is off, so nothing locks and the plan screens stay hidden. ?plans=preview shows them for review.
test('plans: hidden by default, shown in preview without locking anything', async ({ page }, info) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await page.getByRole('button', { name: /account/i }).first().click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
  await expect(main.getByRole('region', { name: 'Free' })).toHaveCount(0);

  await page.goto('/?plans=preview');
  await openFresh(page);
  await skipToExample(page);
  await page.getByRole('button', { name: /account/i }).first().click();
  await openFold(page, 'Membership');
  const plan = main.getByRole('region', { name: 'Free' });
  await expect(plan).toContainText('Skirt and bodice');
  await plan.getByRole('button', { name: 'See plans' }).click();

  await expect(main.getByRole('heading', { name: 'Every garment' })).toBeVisible();
  await expect(main).toContainText('$49 a year');
  await main.getByRole('button', { name: 'Go Premium' }).click();
  await expect(main).toContainText("Paid plans aren't open yet");
  await page.screenshot({ path: info.outputPath('plans.png'), fullPage: true });
  await main.getByRole('button', { name: 'Back' }).last().click();
  await expect(main.getByRole('heading', { name: 'Saved patterns' })).toBeVisible();
});

// Skipping measuring drafts to the example body, and Style and Print say so (Cat's K1 Example Tag).
test('skip: the example body is tagged until you measure', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  const tag = main.getByRole('button', { name: /Drafted to an example body/ });
  await expect(tag).toBeVisible();
  await tag.click();
  await expect(main.getByRole('heading', { name: /take some measurements/i })).toBeVisible();
  await expect(main.getByRole('button', { name: /Drafted to an example body/ })).toHaveCount(0);
});
