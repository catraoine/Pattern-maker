import { expect, expectStyle, openGroup, openLooks, startWithExample, test } from './fixtures';

test('the Maison collection: open it from styling, draw every look, make one', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'The collection' })).toBeVisible();
  // Every look is drawn flat, front and back.
  const looks = main.getByRole('listitem');
  // Eight looks; Look 02 is a set of two pieces, the vest and the skirt, side by side (Nov 11); the Red Pleat Dress and
  // the Ivory Palazzo left the line.
  await expect(looks).toHaveCount(8);
  await expect(main.getByRole('img', { name: /Technical flat/ })).toHaveCount(9);
  // The House shows one season at a time.
  await expect(main.getByText('SS27 · Spring Summer 2027')).toBeVisible();

  // Making the Ivory Bias Slip opens the dress cut in one on the bias.
  await looks.filter({ has: page.getByRole('heading', { name: 'Ivory Bias Slip' }) }).getByRole('button', { name: 'Make this look' }).click();
  await expectStyle(page, 'Dress');
  await expect((await openGroup(page, 'Cut')).getByRole('button', { name: 'Bias slip' })).toHaveAttribute('aria-pressed', 'true');
  // It comes in the cloth it's named for (ivory silk satin, faintly see-through), not the last fabric picked.
  const cloth = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}').finish?.fabric);
  expect(cloth).toMatchObject({ fibre: 'silk', colour: 'Ivory', special: 'satin', seeThrough: 'faint' });
});

test('Look 02, the Black Vest Set: both pieces in one look, each made on its own', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  const set = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'The Black Vest Set' }) });
  await expect(set).toContainText('SS27 · Look 02');
  await expect(set.getByRole('img', { name: /Technical flat/ })).toHaveCount(2);
  // The skirt: wide box pleats, low on the hip, in crisp black wool.
  await set.getByRole('button', { name: 'Make the skirt' }).click();
  await expectStyle(page, 'Skirt');
  const skirt = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(skirt.choices).toMatchObject({ pleats: 'box', pleatWidth: 'wide', rise: 'low' });
  expect(skirt.finish?.fabric).toMatchObject({ fibre: 'wool', colour: 'Black', drape: 'crisp' });
  // The vest: a sleeveless jacket with the high lapel and the chest seam.
  await page.goto('/');
  await page.getByRole('button', { name: /^Carry on with your/ }).first().click();
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  await main.getByRole('button', { name: 'Make the vest' }).click();
  await expectStyle(page, 'Jacket');
  const vest = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(vest.jacket).toMatchObject({ sleeve: 'none', lapel: 'high', yokeCm: 19, buttons: 3 });
});

test('the Leopard Shirt Dress: made in the house print, with its long-point collar and shirttail', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  const look = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Leopard Shirt Dress' }) });
  await expect(look.getByRole('img', { name: /Technical flat/ })).toBeVisible();
  if (process.env.SHOTS) await look.screenshot({ path: `${process.env.SHOTS}/leopard-look-${test.info().project.name}.png` });
  await look.getByRole('button', { name: 'Make this look' }).click();
  await expectStyle(page, 'Bodice');
  // It comes in the house's own print, photographed from the real cloth, and keeps the house shirt cut.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(saved.finish?.fabric).toMatchObject({ fibre: 'cotton', print: 'oneway', photo: { id: 'house-leopard-python' } });
  expect(saved.bodice).toMatchObject({ collar: 'shirt', shirtCut: 'house', dropCm: 47 });
  // Its own ease (36 cm) leaves no Fit chip pressed, but the folded Fit line still names the cut (bug hunt, Nov 11).
  const fit = main.locator('fieldset.group[data-label="Fit"]');
  if (await fit.locator('.fold-head').count()) await expect(fit.locator('.fold-pick')).toHaveText('Oversized');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/leopard-style-${test.info().project.name}.png`, fullPage: true });
});

test('the collection: the next drop stays hidden until it has a piece, and the Archive shows its records', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  // Drop 01 has no piece yet, so it stays hidden: no strip and no sign-up (Cat, 2026-10-29).
  await expect(main.getByText('Date soon')).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Get the drop alert' })).toHaveCount(0);
  await main.getByRole('group', { name: 'Collection' }).getByRole('button', { name: 'Archive' }).click();
  const records = main.getByRole('list', { name: 'The Archive' }).getByRole('listitem');
  await expect(records).toHaveCount(14);
  await expect(records.first()).toContainText('ARC · 1954 · 001');
  await expect(records.first()).toContainText('To be announced');
  // A history cut can't be made until its source is licensed; the sign-up counts who wants it. Last season's
  // house looks are the house's own, so each of those can be made.
  await expect(records.first().getByRole('button', { name: 'Make this cut' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Make this cut' })).toHaveCount(10);
  await expect(records.filter({ hasText: 'Tailleur' })).toContainText('Maison Tracé, AW26');
  await expect(main.getByRole('heading', { name: 'Tell me when the Archive opens' })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/archive-${test.info().project.name}.png`, fullPage: true });
});

test('the Chocolate Barrel Trouser: made low on the hip with two pleats, in chocolate sateen', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openLooks(page);
  await main.getByRole('button', { name: 'Start from the Maison collection' }).click();
  const look = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Chocolate Barrel Trouser' }) });
  await expect(look.getByRole('img', { name: /Technical flat/ })).toBeVisible();
  if (process.env.SHOTS) await look.screenshot({ path: `${process.env.SHOTS}/chocolate-barrel-look-${test.info().project.name}.png` });
  await look.getByRole('button', { name: 'Make this look' }).click();
  await expectStyle(page, 'Trousers');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(saved.finish?.fabric).toMatchObject({ fibre: 'cotton', colour: '#3d2418', drape: 'crisp', sheen: 'soft' });
  expect(saved.trousers).toMatchObject({ leg: 'barrel', rise: 'low', pleats: 'double', loops: 'loops', length: 'full' });
});
