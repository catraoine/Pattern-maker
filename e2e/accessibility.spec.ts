import { expect, measureMe, openFresh, startWithExample, test } from './fixtures';
import type { Page } from '@playwright/test';

const main = (page: Page) => page.getByRole('main');

// The accessibility review (Cat's "apply all", 2026-10-30): keyboard, measuring seated or alone, and the films in words.

test('a pick made from the keyboard keeps the focus on the choices', async ({ page }) => {
  // Without the steady flag, so the question folds and the next one opens as it does for everyone.
  await page.addInitScript(() => localStorage.removeItem('maison-trace-steady'));
  await startWithExample(page);
  const panel = page.locator('.style-panel');
  const chip = panel.locator('fieldset.group.fold.open .chips button[aria-pressed="false"]').first();
  await chip.focus();
  await page.keyboard.press('Enter');
  // The next question opens after its pause; the focus lands on it, not back at the top of the page.
  await expect(panel.locator('.fold-head:focus')).toHaveCount(1, { timeout: 3000 });
});

test('the Style steps are one stop for the Tab key, and the arrow keys move along them', async ({ page }) => {
  await startWithExample(page);
  const tabs = main(page).getByRole('tablist', { name: 'Style choices' }).getByRole('tab');
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

test('the tour can be read as words, and stays open at its end', async ({ page }) => {
  await openFresh(page);
  await main(page).getByRole('button', { name: /^Watch how it works/ }).click();
  const tour = page.getByRole('dialog', { name: 'How it works' });
  await tour.getByRole('button', { name: 'Read it' }).click();
  await expect(tour.getByText(/Just a few measurements, taken once/)).toBeVisible();
  await tour.getByRole('button', { name: 'Hide' }).click();
  await tour.locator('video').evaluate((v: HTMLVideoElement) => v.dispatchEvent(new Event('ended')));
  await expect(tour).toBeVisible();
  await expect(tour.getByRole('button', { name: /Skip tour/ })).toBeFocused();
});
