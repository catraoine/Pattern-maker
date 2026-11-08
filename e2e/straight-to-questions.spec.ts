import { expect, startWithExample, stepTabs, switchGarment, test } from './fixtures';

// On a phone, Style goes straight to the questions (Cat's K, Nov 8): one question per screen, its name as the
// heading, "Next: <question> ›" in the bar pinned at the bottom, a bare ‹ to go back, and no step names or counter.
test('one question at a time, Next names the next one, and the list jumps to any', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'One question per screen only on a phone.');
  await startWithExample(page);
  await switchGarment(page, 'Bodice');
  const main = page.getByRole('main');
  const bar = page.locator('.style-bar');
  const head = main.locator('button.q-head');
  const next = bar.getByRole('button', { name: /^Next: / });

  await expect(head).toHaveText('Fit');
  await expect(next).toHaveAccessibleName('Next: Darts');
  await expect(bar.locator('.step-back-arrow')).toHaveCount(0);
  await expect(main.getByText(/Step \d of \d/)).toHaveCount(0);
  // Only the one question shows.
  await expect(main.locator('.style-panel fieldset.group.fold:visible')).toHaveCount(1);

  // The bar stays at the very bottom of the screen.
  const box = await bar.boundingBox();
  const h = page.viewportSize()!.height;
  expect(Math.abs(box!.y + box!.height - h)).toBeLessThan(2);

  await next.click();
  await expect(head).toHaveText('Darts');
  const back = bar.getByRole('button', { name: 'Back to Fit' });
  await expect(back).toHaveText('‹');
  await back.click();
  await expect(head).toHaveText('Fit');

  // Tap the question's name: every question with its pick; a tap goes straight there.
  const list = await stepTabs(page);
  await expect(list.getByRole('tab', { name: 'Neckline' })).toBeVisible();
  await list.getByRole('tab', { name: 'Neckline' }).click();
  await expect(head).toHaveText('Neckline');
  await expect(list).toBeHidden();

  // The last question's bar goes on to Review.
  await (await stepTabs(page)).getByRole('tab').last().click();
  await expect(bar.getByRole('button', { name: /^Review/ })).toBeVisible();
});
