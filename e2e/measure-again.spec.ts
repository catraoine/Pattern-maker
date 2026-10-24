import type { Page } from '@playwright/test';
import { MEASUREMENTS, expect, skipLoading, test } from './fixtures';

// Measuring for another garment once some measurements are in (Cat's A, 2026-10-24): "Make something else" goes
// straight to the garments, and the next one asks only what it still needs, a missing bust included, on its own
// pages. Never back to "First, let's take some measurements", and never again for a number already taken.

const account = {
  onboarded: true,
  name: '',
  patterns: [],
  // Measured before the bust was in the opening set: no bust, no waist to floor.
  people: [{ id: 'me', name: '', values: { waist: 66, full_hip: 86.4, height: 165, waist_to_hip: 18.3 }, named: false, form: 'womenswear', helped: [] }],
  active: 'me',
  mode: 'simple',
};

/** Fill each measuring page until the one that goes on to styling; the labels asked, in order. */
async function fillUntilStyle(page: Page, garment: string) {
  const main = page.getByRole('main');
  const asked: string[] = [];
  for (let n = 0; n < 12; n++) {
    const input = main.getByRole('textbox');
    await expect(input).toHaveCount(1);
    const label = (await input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).replace(/\(optional\)/i, '').trim();
    expect(MEASUREMENTS[label], `a value for ${label}`).toBeDefined();
    await input.fill(MEASUREMENTS[label]);
    asked.push(label);
    const next = main.getByRole('button', { name: /^Next/ });
    const last = new RegExp(`style your ${garment}`).test((await next.textContent()) ?? '');
    await next.click();
    if (last) return asked;
    await expect.poll(() => input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '').catch(() => label)).not.toContain(label);
  }
  throw new Error('Too many measuring pages');
}

test('make something else goes to the garments and asks only what is missing', async ({ page }) => {
  await page.addInitScript((a) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('pattern-maker:account', a);
    localStorage.setItem('pattern-maker:skirt', JSON.stringify({ unit: 'cm', values: {}, choices: { fit: 'regular', silhouette: 'a_line', length: 'knee' }, garment: 'bodice' }));
  }, JSON.stringify(account));
  await page.goto('/');
  await skipLoading(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: /Your account/ }).click();
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Measure' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Your measurements' })).toBeVisible();

  await main.getByRole('button', { name: 'Make something else' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'What would you like to make?' })).toBeVisible();
  await expect(main.getByText("let's take some measurements")).toHaveCount(0);
  // The garment being made is already picked.
  await expect(main.getByRole('radio', { name: /^Bodice/ })).toHaveAttribute('aria-checked', 'true');
  await main.getByRole('radio', { name: /^Skirt/ }).click();
  await main.getByRole('button', { name: /^Next: \d+ skirt measurements?$/ }).click();
  const asked = await fillUntilStyle(page, 'skirt');
  // Only what the skirt still needs: the hips and the waist to hip are already in.
  expect(asked).not.toContain('Full hip');
  expect(asked).not.toContain('Waist to hip');
  expect(asked).toContain('Waist to knee');
  await expect(main.getByRole('heading', { level: 1, name: 'Style your skirt' })).toBeVisible();
});

test('a garment missing an opening measurement asks it on its own pages, then styles', async ({ page }) => {
  await page.addInitScript((a) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('pattern-maker:account', a);
    localStorage.setItem('pattern-maker:skirt', JSON.stringify({ unit: 'cm', values: {}, choices: { fit: 'regular', silhouette: 'a_line', length: 'knee' }, garment: 'bodice' }));
  }, JSON.stringify(account));
  await page.goto('/');
  await skipLoading(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: /Your account/ }).click();
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Measure' }).click();
  await main.getByRole('button', { name: 'Make something else' }).click();
  await main.getByRole('button', { name: /^Next: \d+ bodice measurements$/ }).click();
  // The bust comes first, as the bodice's own page, then the bodice's extras; never the hips or height again.
  const asked = await fillUntilStyle(page, 'bodice');
  expect(asked[0]).toBe('Full bust');
  expect(asked).not.toContain('Full hip');
  expect(asked).not.toContain('Height');
  await expect(main.getByRole('heading', { level: 1, name: 'Style your bodice' })).toBeVisible();
  await expect(main.getByText("let's take some measurements")).toHaveCount(0);
});
