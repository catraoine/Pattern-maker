import { chooseDrop, expect, fillStepPages, goTab, openReview, skipLoading, skipToExample, test } from './fixtures';
import type { Page } from '@playwright/test';

// Soft lingerie and swimwear, kept out of releases until its fit test: only ?lingerie=preview shows it.

const main = (page: Page) => page.getByRole('main');
const makeList = (page: Page) => main(page).getByRole('radiogroup', { name: 'What would you like to make?' });

test('hidden without the preview link', async ({ page }) => {
  await page.goto('/?fresh');
  await skipLoading(page);
  await skipToExample(page);
  await chooseDrop(page, 'Garment', 'See them all ›');
  await expect(makeList(page).getByRole('radio', { name: /^T-shirt\b/ })).toBeVisible();
  await expect(makeList(page).getByRole('radio', { name: /^Lingerie\b/ })).toHaveCount(0);
});

test('measures the underbust, drafts a bralette and a swimsuit, and prints', async ({ page }) => {
  await page.goto('/?fresh&lingerie=preview');
  await skipLoading(page);
  await skipToExample(page);
  await chooseDrop(page, 'Garment', 'See them all ›');
  const pick = makeList(page).getByRole('radio', { name: /^Lingerie\b/ });
  await pick.click();
  await main(page).getByRole('button', { name: /^(Continue measurements|Style my lingerie)$/i }).click();
  // The example already has an underbust; a body without one is asked for it first.
  const style = main(page).getByRole('heading', { level: 1, name: 'Style your brief' });
  await expect(style.or(main(page).getByRole('textbox')).first()).toBeVisible();
  if (!(await style.isVisible())) await fillStepPages(page);
  await expect(style).toBeVisible();

  const choose = async (group: string, chip: string) => {
    const g = main(page).getByRole('group', { name: group, exact: true });
    const tabs = main(page).getByRole('tablist', { name: 'Style choices', includeHidden: true });
    if (!(await g.isVisible()) && (await tabs.count())) await goTab(page, group);
    const b = g.getByRole('button', { name: chip, exact: true });
    await b.click();
    await expect(b).toHaveAttribute('aria-pressed', 'true');
  };
  await choose('Piece', 'Bralette');
  await expect(main(page).getByRole('heading', { level: 1, name: /Style your bralette/ })).toBeVisible();
  await expect(main(page).getByText(/^bralette cup/i).first()).toBeVisible();
  // Tried one on: the legs gaped, so the next draft cuts the leg elastic shorter.
  const fitGroup = main(page).getByRole('group', { name: 'How did it fit?', exact: true });
  const tabs = main(page).getByRole('tablist', { name: 'Style choices', includeHidden: true });
  if (!(await fitGroup.isVisible()) && (await tabs.count())) await goTab(page, 'How did it fit?');
  await fitGroup.getByRole('group', { name: 'Cups' }).getByRole('button', { name: 'Spill over' }).click();
  await expect(fitGroup.getByText(/Redrawn: cups cut fuller/)).toBeVisible();
  await choose('Piece', 'Swimsuit');
  await expect(main(page).getByText(/^swimsuit front$/i).first()).toBeVisible();

  const print = main(page).getByRole('button', { name: 'Print my pattern' });
  await openReview(page);
  // The summary lists each elastic, cut shorter than its edge.
  await expect(main(page).getByText(/Each leg: \d+(\.\d)? cm, 1 cm wide/)).toBeVisible();
  await print.click();
  await expect(main(page).getByRole('heading', { level: 1, name: 'Swimsuit' })).toBeVisible();
  await expect(main(page).getByRole('button', { name: /^Download PDF/ })).toBeVisible();
});
