import { MEASUREMENTS, expect, fillStepPages, measureMe, openFresh, pickToMake, test } from './fixtures';

// A high bust at or over the bust asks a top for its across back and armhole too (Cat, Nov 24). The count then went
// from "Top 5 of 5" to "6 of 7" with no word, after the first page said 5 (cold read EG, Nov 24): the first added
// page now says why.
test('a top that asks for more after a high bust over the bust says why', async ({ page }) => {
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Bodice');
  const label = () => main.locator('label:visible').first();
  for (let i = 0; i < 10; i++) {
    const name = (await label().innerText()).trim();
    if (/^across back$/i.test(name)) break;
    const key = Object.keys(MEASUREMENTS).find((k) => k.toLowerCase() === name.toLowerCase())!;
    await main.getByRole('textbox').first().fill(/^high bust$/i.test(name) ? '95' : MEASUREMENTS[key]);
    await main.getByRole('button', { name: /^Next/ }).first().click();
    await expect(label()).not.toHaveText(name, { ignoreCase: true });
  }
  await expect(label()).toHaveText(/across back/i);
  await expect(main.locator('.extra-intro')).toHaveText('Your high bust is at or over your bust, so your top also needs 2 more measurements');
});
