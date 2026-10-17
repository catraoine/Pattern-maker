import type { Page } from '@playwright/test';
import { chooseChip, expect, startWithExample, test } from './fixtures';

// Shake to undo, fed with made-up motion readings at 60 a second, as a phone sends them.

type Reading = { x: number; y: number; z: number };
async function feed(page: Page, readings: Reading[]) {
  await page.evaluate(async (all) => {
    for (const a of all) {
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: a, interval: 16 }));
      await new Promise((r) => setTimeout(r, 16));
    }
  }, readings);
}
/** Held upright and still. */
const still = (n: number) => Array.from({ length: n }, () => ({ x: 0, y: 9.8, z: 0 }));
/** Shaken side to side, `hz` times a second, as hard as `force` (m/s²). */
const shake = (hz: number, force: number) => Array.from({ length: 60 }, (_, i) => ({ x: force * Math.sin((2 * Math.PI * hz * i) / 60), y: 9.8, z: 0 }));

test.beforeEach(({}, info) => test.skip(info.project.name !== 'phone', 'phones only'));

const pressed = (page: Page) => page.getByRole('main').getByRole('group', { name: 'Length', exact: true }).getByRole('button', { pressed: true });

test('a shake undoes the last change, and only that one', async ({ page }) => {
  await startWithExample(page);
  await expect(page.getByRole('main').getByText('Shake your phone to undo.')).toBeVisible();
  await chooseChip(page, 'Length', 'Mini');
  await chooseChip(page, 'Length', 'Midi');
  await feed(page, [...still(10), ...shake(4, 16), ...still(10)]);
  await expect(pressed(page)).toHaveText('Mini');
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Undone' })).toBeVisible();
});

test('a knock or a gentle sway does not undo', async ({ page }) => {
  await startWithExample(page);
  await chooseChip(page, 'Length', 'Midi');
  // Put down on a table: one hard rattle.
  await feed(page, [...still(10), { x: 0, y: 30, z: 5 }, { x: 0, y: -5, z: -3 }, { x: 0, y: 25, z: 2 }, ...still(60)]);
  // Swinging in a hand while walking.
  await feed(page, [...shake(2, 8), ...still(10)]);
  await expect(pressed(page)).toHaveText('Midi');
});

test('on an iPhone, tapping "Shake to undo" asks for motion, then shakes undo', async ({ page }) => {
  await page.addInitScript(() => {
    (window.DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = () => Promise.resolve('granted');
  });
  await startWithExample(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Shake to undo' }).click();
  await expect(main.getByText('Shake your phone to undo.')).toBeVisible();
  await chooseChip(page, 'Length', 'Midi');
  await feed(page, [...still(10), ...shake(5, 20), ...still(10)]);
  await expect(pressed(page)).not.toHaveText('Midi');
});
