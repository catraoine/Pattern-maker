import type { Page } from '@playwright/test';
import { expect, openFold, startWithExample, stepButton, test } from './fixtures';

const SHOTS = process.env.SHOTS_DIR;

/** A finger held on the middle of the garment drawing for `ms`, as the phone sends it (a touch pointer that stays put). */
async function hold(page: Page, ms: number) {
  const drawing = page.locator('main svg.preview-svg').first();
  const box = (await drawing.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.45;
  const send = (type: string) =>
    page.evaluate(([type, x, y]) => {
      const el = document.elementFromPoint(x as number, y as number)!;
      el.dispatchEvent(new PointerEvent(type as string, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x as number, clientY: y as number, bubbles: true }));
    }, [type, x, y]);
  await send('pointerdown');
  await page.waitForTimeout(ms);
  await send('pointerup');
  // A phone browser may send a tap as the finger lifts, which lands on whatever is now under it.
  await page.mouse.click(x, y);
  return { x, y };
}

test('hold to leave a note: only on a tester device, never from a quick tap, and the note says the spot without numbers', async ({ page }, info) => {
  await page.route('**/.netlify/functions/tester', (route) => route.fulfill({ json: { ok: true, tester: true } }));
  let sent: Record<string, unknown> | undefined;
  await page.route('**/.netlify/functions/note', (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ json: { ok: true } });
  });
  await startWithExample(page);
  const box = page.locator('.pin-box');

  // Not a tester device: holding and right clicking work as they always did.
  await hold(page, 700);
  if (info.project.name === 'desktop') await page.locator('main svg.preview-svg').first().click({ button: 'right', position: { x: 40, y: 200 } });
  await expect(box).toHaveCount(0);

  await page.getByRole('banner').getByRole('button', { name: /account/i }).click();
  const fold = await openFold(page, 'Tester');
  await fold.getByLabel('Tester code').fill('example-code');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await stepButton(page, 'Style').click();

  // A quick tap is a tap.
  await hold(page, 120);
  await expect(box).toHaveCount(0);

  // Held still: the box opens, pinned to the spot.
  await hold(page, 700);
  await expect(box).toBeVisible();
  await expect(box).toContainText('Pinned:');
  await expect(box).toContainText('Style screen');
  await expect(box).toContainText('In testing');
  await expect(box.getByLabel(/What’s happening here/)).toBeFocused();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pin-notes-${info.project.name}.png` });

  // The tap that ends the hold doesn't press what was under it, and the box stays open for writing.
  await box.getByLabel(/What’s happening here/).fill('The hem dips at the back here.');
  await box.getByRole('button', { name: 'Send' }).click();
  await expect(box).toContainText('Your note is in');
  expect(sent).toMatchObject({ note: 'The hem dips at the back here.', view: 'style', tester: true });
  const pin = sent!.pin as Record<string, unknown>;
  expect(pin.device).toBe(info.project.name === 'phone' ? 'phone' : 'computer');
  expect(String(pin.spot).length).toBeGreaterThan(3);
  expect(JSON.stringify([pin.spot, pin.section, pin.showing, pin.garment])).not.toMatch(/\d/);
  expect(pin.x).toBeGreaterThan(0);
  expect(pin.y).toBeGreaterThan(0);
  // Never the code.
  expect(JSON.stringify(sent)).not.toMatch(/example-code/i);
  await box.getByRole('button', { name: 'Done' }).click();
  await expect(box).toHaveCount(0);

  // On a computer a right click drops the pin too, and Shift keeps the browser's own menu.
  if (info.project.name === 'desktop') {
    await page.locator('main svg.preview-svg').first().click({ button: 'right', position: { x: 40, y: 200 } });
    await expect(box).toBeVisible();
    await expect(box).toContainText('Hold Shift as you right click');
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
  }
});

test('hold to leave a note: a choice says its own name once, and the box opens beside it with Send in sight', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'A right click: a computer');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.route('**/.netlify/functions/tester', (route) => route.fulfill({ json: { ok: true, tester: true } }));
  await startWithExample(page);
  await page.getByRole('banner').getByRole('button', { name: /account/i }).click();
  const fold = await openFold(page, 'Tester');
  await fold.getByLabel('Tester code').fill('example-code');
  await fold.getByRole('button', { name: 'Use code' }).click();
  await stepButton(page, 'Style').click();
  const chip = page.getByRole('main').getByRole('group', { name: 'Fit' }).getByRole('button', { name: 'Fit' }).first();
  await chip.click({ button: 'right' });
  const box = page.locator('.pin-box');
  await expect(box).toBeVisible();
  const line = (await box.locator('.pin-where').textContent()) ?? '';
  expect(line.match(/Regular/g) ?? [], line).toHaveLength(1);
  // Words from different pieces of the screen keep their spaces (no "FitRegular").
  expect(line).not.toMatch(/[a-z][A-Z]/);
  // Not a spot on the drawing, so no garment view.
  expect(line).not.toMatch(/Front view/);
  const a = (await chip.boundingBox())!;
  const b = (await box.boundingBox())!;
  expect(b.x + b.width <= a.x || b.x >= a.x + a.width, 'the box sits beside the choice, not over it').toBe(true);
  // Send in the window without scrolling inside the box (1366 x 768, the Nov 27 walk).
  await expect(box.getByRole('button', { name: 'Send' })).toBeInViewport();
});
