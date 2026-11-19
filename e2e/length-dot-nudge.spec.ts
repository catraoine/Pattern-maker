import { expect, openCollection, startWithExample, test } from './fixtures';
import type { Page } from '@playwright/test';

/** From the collection to the look's length step on a computer, where the dot is dragged with the mouse. */
async function lengthDot(page: Page, look: string, make: RegExp) {
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  await main.getByRole('listitem').filter({ hasText: look }).first().getByRole('button', { name: make }).first().click();
  const change = main.getByRole('button', { name: 'Change a detail' });
  if (await change.count()) await change.click();
  await expect(main.getByText('Drag the dot, or tap the length to type it.')).toBeVisible({ timeout: 30_000 });
  return main.getByRole('slider', { name: /length/i }).first();
}

// A typed 49.3 cm jumped to the knee's 53 cm at a 6 px nudge, so a length could only be set finely by typing it
// (pretend tester DJ walk, Nov 19): a length the drag begins near doesn't catch it until the dot has moved off it.
test('a small nudge on a typed skirt length stays a number, near the knee', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const dot = await lengthDot(page, 'Black Pleated Skirt', /^Make the skirt/i);
  await page.getByRole('main').getByRole('button', { name: 'Type the skirt length' }).click();
  await page.getByRole('form').getByRole('textbox').fill('49.3');
  await page.getByRole('form').getByRole('button', { name: 'Set' }).click();
  await expect(dot).toHaveAttribute('aria-valuetext', /^49(\.\d)? cm$/);
  const b = (await dot.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 3, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 6, { steps: 3 });
  await page.mouse.up();
  await expect(dot).toHaveAttribute('aria-valuetext', /^\d+(\.\d)? cm$/);
});

// At full length, dragging the trouser dot further down did nothing, with nothing to say why (pretend tester DJ walk,
// Nov 19): held past its end, the dot says it is the longest.
test('the trouser dot says it is the longest when dragged past full length', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const dot = await lengthDot(page, 'Chocolate Barrel Trouser', /^Make the trouser/i);
  await expect(dot).toHaveAttribute('aria-valuetext', /^Full length/);
  const b = (await dot.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 40, { steps: 5 });
  await expect(dot).toHaveAttribute('aria-valuetext', /Longest$/);
  await expect(page.getByRole('main').locator('.hem-marks text')).toContainText('LONGEST');
  await page.mouse.up();
  await expect(dot).toHaveAttribute('aria-valuetext', /^Full length/);
});

// A pair typed to 103 cm after the dot had passed Shorts printed as "shorts" in its title, labels and booklet (pretend
// tester DK walk, Nov 19): a typed length takes the nearest named length's name.
test('a trouser length typed after passing Shorts is named as trousers', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const dot = await lengthDot(page, 'Chocolate Barrel Trouser', /^Make the trouser/i);
  await dot.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp');
  await expect(dot).toHaveAttribute('aria-valuetext', /^Shorts/);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: /^Type the trouser length$/i }).click();
  const box = page.getByRole('form');
  const max = (await box.locator('#length-box-note').textContent())?.match(/to ([\d.]+) cm/)?.[1];
  await box.getByRole('textbox').fill(max ?? '100');
  await box.getByRole('button', { name: 'Set' }).click();
  await expect(box).toBeHidden();
  await expect(main.getByText(/barrel-leg trousers/i).first()).toBeVisible();
  await expect(main.getByText(/barrel shorts/i)).toHaveCount(0);
});

// The box opens on the length rounded for typing (53 for a knee at 52.8), and Set alone moved the length (pretend tester DK
// walk, Nov 19): Set with the number as it opened leaves it alone.
test('Set on an unchanged length box leaves the length as it was', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const dot = await lengthDot(page, 'Chocolate Barrel Trouser', /^Make the trouser/i);
  const main = page.getByRole('main');
  // On a named length (the arrow keys step to one), whose cm the box rounds to the half.
  await dot.focus();
  await page.keyboard.press('ArrowUp');
  await expect(dot).toHaveAttribute('aria-valuetext', /^[A-Z][a-z ]+ · [\d.]+ cm$/);
  const was = await dot.getAttribute('aria-valuetext');
  await main.getByRole('button', { name: /^Type the trouser length$/i }).click();
  await page.getByRole('form').getByRole('button', { name: 'Set' }).click();
  await expect(page.getByRole('form')).toBeHidden();
  await expect(dot).toHaveAttribute('aria-valuetext', was!);
});
