import { expect, openAccount, openCollection, openFold, startWithExample, stepButton, test } from './fixtures';

// Testers tried to type their length and didn't see they had to drag the hem, and looked for the collection from
// Style (testers, Nov 17; Cat applied both): the length label opens a box to type it, and The collection is one tap
// under the garment's name.
const LOOKS = ['Blush Shift', 'Black Pleated Skirt', 'Ice Peplum Top', 'Chocolate Barrel Trouser'];
const SHOTS = process.env.SHOTS;
for (const unit of ['cm', 'in'] as const)
  for (const look of LOOKS)
    test(`a typed length sets the ${look} (${unit})`, async ({ page }) => {
      test.setTimeout(3 * 60_000);
      const main = page.getByRole('main');
      await startWithExample(page);
      if (unit === 'in') {
        await openAccount(page);
        await openFold(page, 'Settings');
        await main.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Inches' }).click();
        await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
        await stepButton(page, 'Style').click().catch(() => {});
      }
      await openCollection(page);
      const card = main.getByRole('listitem').filter({ hasText: look }).first();
      const make = card.getByRole('button', { name: /^Make (this look|the )/ });
      const pick = (await make.count()) > 1 ? card.getByRole('button', { name: new RegExp(`^Make the ${look.split(' ').pop()!.toLowerCase()}`, 'i') }) : make;
      await pick.first().click();
      const change = main.getByRole('button', { name: 'Change a detail' });
      if (await change.count()) await change.click();
      await expect(main.getByText('Drag the dot, or tap the length to type it.')).toBeVisible({ timeout: 30_000 });
      const slider = main.getByRole('slider', { name: /length/i }).first();
      const was = await slider.getAttribute('aria-valuetext');
      await main.getByRole('button', { name: /^Type the .*length$/ }).first().click();
      const box = page.getByRole('form');
      await expect(box).toBeVisible();
      const input = box.getByRole('textbox');
      const now = parseFloat(await input.inputValue());
      // A little shorter (a peplum's seam already sits as high as it goes: longer): 3 cm, or an inch and a half.
      const by = look.includes('Peplum') ? 1 : -1;
      const want = unit === 'in' ? `${Math.round(now + by)} 1/2` : String(Math.round(now + 3 * by));
      await input.fill(want);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/type-${look.split(' ').pop()}-${unit}.png`, fullPage: true });
      await box.getByRole('button', { name: 'Set' }).click();
      await expect(box).toBeHidden();
      await expect(slider).not.toHaveAttribute('aria-valuetext', was ?? '');
      console.log(look, unit, was, '->', await slider.getAttribute('aria-valuetext'), '(typed', want, ')');
      // Typed, the look keeps its name and is otherwise unchanged... and the collection is one tap away.
      await main.getByRole('button', { name: 'The collection ›' }).click();
      await expect(main.getByRole('heading', { name: 'The collection' })).toBeVisible();
    });

test('a length out of range is asked again, not set', async ({ page }) => {
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  await main.getByRole('listitem').filter({ hasText: 'Black Pleated Skirt' }).first().getByRole('button', { name: /^Make the skirt/i }).click();
  const change = main.getByRole('button', { name: 'Change a detail' });
  if (await change.count()) await change.click();
  await main.getByRole('button', { name: 'Type the skirt length' }).click();
  await page.getByRole('form').getByRole('textbox').fill('500');
  await page.getByRole('form').getByRole('button', { name: 'Set' }).click();
  await expect(page.getByRole('alert')).toContainText('This one goes');
  await page.getByRole('form').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('form')).toBeHidden();
});
