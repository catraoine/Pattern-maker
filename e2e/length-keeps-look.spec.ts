import { expect, openCollection, startWithExample, test } from './fixtures';

// A tester sets her length by dragging the hem on the drawing, as the tester notes ask. Dragging it must change the
// length only: the look keeps its name, its cut and every other choice (Blush Shift turned into a waist-seam dress
// when its hem was dragged to a named length, testers Nov 17).
const LOOKS = ['Blush Shift', 'Black Pleated Skirt', 'Ice Peplum Top', 'Chocolate Barrel Trouser', 'Black Vest'];
for (const look of LOOKS)
  test(`dragging the length keeps the ${look}`, async ({ page }) => {
    test.setTimeout(3 * 60_000);
    const main = page.getByRole('main');
    await startWithExample(page);
    await openCollection(page);
    const card = main.getByRole('listitem').filter({ hasText: look }).first();
    const make = card.getByRole('button', { name: /^Make (this look|the )/ });
    const pick = (await make.count()) > 1 ? card.getByRole('button', { name: new RegExp(`^Make the ${look.split(' ').pop()!.toLowerCase()}`, 'i') }) : make;
    await pick.first().click();
    await expect(page.getByText(look.toUpperCase(), { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    for (const name of [/^Show all tools/, /^Start styling/]) {
      const b = main.getByRole('button', { name });
      if (await b.count()) await b.first().click();
    }
    const handle = main.getByRole('slider', { name: /length/i }).first();
    if (!(await handle.count())) {
      test.info().annotations.push({ type: 'no length handle', description: look });
      return;
    }
    const chosen = async () => (await main.locator('[aria-pressed="true"], [aria-checked="true"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean).sort();
    const before = await chosen();
    const was = await handle.getAttribute('aria-valuetext');
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    // Down, one step at a time, till it catches on the next named length (a tester's drag), then a free length.
    for (const dy of look.includes('Trouser') ? [-40, -15] : [40, 15]) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(x, y + (dy * i) / 8);
      await page.mouse.up();
      await page.waitForTimeout(800);
      const now = await handle.getAttribute('aria-valuetext');
      const after = await chosen();
      console.log(look, 'length', was, '->', now, 'changed:', JSON.stringify(before.filter((t) => !after.includes(t))), '->', JSON.stringify(after.filter((t) => !before.includes(t))));
      await expect(page.getByText(look.toUpperCase(), { exact: false }).first(), `${look} keeps its name after a ${dy} px drag`).toBeVisible();
      // Only the length may change.
      const off = (l: string[]) => l.filter((t) => !/length|mini|knee|midi|maxi|cm|full|ankle|crop|hip|waist$/i.test(t) || /seam|shift|sheath/i.test(t));
      expect(off(after), `${look}: choices other than length unchanged after a ${dy} px drag`).toEqual(off(before));
    }
  });
