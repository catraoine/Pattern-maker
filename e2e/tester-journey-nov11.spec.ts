import type { Page } from '@playwright/test';
import { expect, fillStepPages, measureMe, openAccount, openFold, openFresh, startWithExample, test } from './fixtures';

// The tester journey check (Nov 11, 2026): what a fit tester would trip on, and Cat's "fix all".

const main = (page: Page) => page.getByRole('main');

test('the garment menu on the Style title stays on the screen', async ({ page }) => {
  await startWithExample(page);
  await main(page).getByRole('group', { name: 'Garment' }).getByRole('button').first().click();
  const list = page.getByRole('menu', { name: 'Garment' });
  await expect(list).toBeVisible();
  const box = (await list.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
});

test('What would you like to make? opens the collection first', async ({ page }) => {
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await main(page).getByRole('button', { name: 'Maison Tracé collection ›' }).click();
  await expect(main(page).getByRole('heading', { name: 'The collection' })).toBeVisible();
  // Back returns to the list it came from.
  await main(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: 'What would you like to make?' })).toBeVisible();
});

test('a reload while measuring opens on the page still to take', async ({ page }) => {
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await main(page).getByRole('textbox').fill('76');
  await main(page).getByRole('button', { name: 'Next' }).click();
  await main(page).getByRole('textbox').fill('92');
  await main(page).getByRole('button', { name: 'Next' }).click();
  await expect(main(page).getByRole('heading', { name: 'Your hips' })).toBeVisible();
  await page.reload();
  await expect(main(page).getByRole('heading', { name: 'Your hips' })).toBeVisible();
});

test('a fit tester is pointed at the tester form, with no paid fit check offered', async ({ page }) => {
  await page.route('**/.netlify/functions/tester', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tester: true }) }));
  await startWithExample(page);
  await openAccount(page);
  const fold = await openFold(page, 'Fit testing');
  await fold.getByLabel('Tester code').fill('SAMPLE-CODE');
  await fold.getByRole('button', { name: 'Use code' }).click();
  const link = fold.getByRole('link', { name: 'Open the tester form ›' });
  await expect(link).toHaveAttribute('href', /docs\.google\.com\/forms/);
  await expect(link).toHaveAttribute('target', '_blank');
});

// The Ice Peplum testers' path (Nov 12): measured the basics, then the look from the list. Its peplum seam sits 6 cm
// below the waist, but the bodice's pages never asked the waist to hip, so Style stopped at "Add your full hip and
// waist to hip" with Review greyed out. Making it now asks for them first.
test('a collection top below the waist asks for the hip first, so Style drafts it', async ({ page }) => {
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main(page).getByRole('button', { name: 'Choose what to make' }).click();
  await main(page).getByRole('button', { name: 'Maison Tracé collection ›' }).click();
  await main(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Ice Peplum Top', exact: true }) }).getByRole('button', { name: 'Make this look' }).click();
  const style = main(page).getByRole('heading', { name: 'Style Ice Peplum Top' });
  const asked: string[] = [];
  for (let n = 0; n < 6 && !(await style.isVisible()); n++) {
    if (await main(page).getByRole('textbox').count()) {
      asked.push(...(await main(page).getByRole('heading', { level: 1 }).allInnerTexts()));
      await fillStepPages(page);
    } else await page.waitForTimeout(300);
  }
  await expect(style).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}'));
  expect(JSON.stringify(saved)).toContain('"waist_to_hip"');
  await expect(main(page).getByText(/Add your full hip and waist to hip/)).toHaveCount(0);
});
