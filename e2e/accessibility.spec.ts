import { expect, measureMe, openFresh, startWithExample, stepTabs, test } from './fixtures';
import type { Page } from '@playwright/test';

const main = (page: Page) => page.getByRole('main');

// The accessibility review (Cat's "apply all", 2026-10-30): keyboard, measuring seated or alone, and the films in words.

test('a pick made from the keyboard keeps the focus on the choices', async ({ page }, info) => {
  // On a phone each question is a screen of its own and Next moves on (Cat's K, Nov 8): nothing folds there.
  test.skip(info.project.name === 'phone', 'Questions fold only on a computer.');
  // Without the steady flag, so the question folds and the next one opens as it does for everyone.
  await page.addInitScript(() => localStorage.removeItem('maison-trace-steady'));
  await startWithExample(page);
  const panel = page.locator('.style-panel');
  // Every question starts folded (Cat, 2026-11-06): open the first from its folded line.
  await panel.locator('fieldset.group.fold .fold-head').first().click();
  const chip = panel.locator('fieldset.group.fold.open .chips button[aria-pressed="false"]').first();
  await chip.focus();
  await page.keyboard.press('Enter');
  // The next question opens after its pause; the focus lands on it, not back at the top of the page.
  await expect(panel.locator('.fold-head:focus')).toHaveCount(1, { timeout: 3000 });
});

test('the Style steps are one stop for the Tab key, and the arrow keys move along them', async ({ page }) => {
  await startWithExample(page);
  const tabs = (await stepTabs(page)).getByRole('tab');
  await expect(tabs.and(page.locator('[tabindex="0"]'))).toHaveCount(1);
  const first = tabs.and(page.locator('[aria-selected="true"]'));
  const name = await first.getAttribute('aria-label');
  await first.focus();
  await page.keyboard.press('ArrowRight');
  const now = tabs.and(page.locator('[aria-selected="true"]'));
  await expect(now).not.toHaveAttribute('aria-label', name!);
  await expect(now).toBeFocused();
  await expect(now).toHaveAttribute('title', /\S/);
});

test('How to do it gives a way to measure seated or alone', async ({ page }) => {
  await openFresh(page);
  await main(page).getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await main(page).getByRole('button', { name: /^How to do it/ }).click();
  const how = page.getByRole('dialog');
  await expect(how.getByText('Seated, or on your own')).toBeVisible();
  await how.getByRole('button', { name: 'Got it' }).click();
});

test('the tour carries its words for screen readers, has its own controls, and stays open at its end', async ({ page }) => {
  await openFresh(page);
  await main(page).getByRole('button', { name: /^Watch how it works/ }).click();
  const tour = page.getByRole('dialog', { name: 'How it works' });
  // No Read it switch any more (Cat, 2026-11-06): the words stay in the page, hidden from view, tied to the film.
  await expect(tour.getByRole('button', { name: 'Read it' })).toHaveCount(0);
  await expect(tour.locator('#tour-words')).toContainText(/Just a few measurements, taken once/);
  await expect(tour.locator('video')).toHaveAttribute('aria-describedby', 'tour-words');
  // The phone's own player controls are off; ours sit under the film.
  await expect(tour.locator('video')).not.toHaveAttribute('controls', /.*/);
  await expect(tour.getByRole('button', { name: /^(Play|Pause)$/ })).toBeVisible();
  await tour.locator('video').evaluate((v: HTMLVideoElement) => v.dispatchEvent(new Event('ended')));
  await expect(tour).toBeVisible();
  await expect(tour.getByRole('button', { name: /Skip tour/ })).toBeFocused();
});
