import { stripeLean } from '../src/fabricStraight';
import { MEASUREMENTS, changeLook, expect, expectLook, expectStyle, fillStepPages, goPrint, measureMe, openCollection, openFresh, openGroup, pickToMake, startWithExample, switchGarment, test } from './fixtures';

test('the Maison collection: open it from styling, draw every look, make one', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openCollection(page);
  await expect(main.getByRole('heading', { level: 1, name: 'The collection' })).toBeVisible();
  // Every look is drawn flat, front and back.
  const looks = main.getByRole('listitem');
  // Seven looks; Look 02 is a set of two pieces, the vest and the skirt, side by side (Nov 11), and Look 05 the lilac
  // lace blouse with the chocolate barrel trouser (Nov 14); the Red Pleat Dress and the Ivory Palazzo left the line.
  await expect(looks).toHaveCount(7);
  await expect(main.getByRole('img', { name: /Technical flat/ })).toHaveCount(9);
  // The House shows one season at a time.
  await expect(main.getByText('SS27, Spring Summer 2027')).toBeVisible();

  // Making the Ivory Bias Slip opens the dress cut in one on the bias.
  await looks.filter({ has: page.getByRole('heading', { name: 'Ivory Bias Slip' }) }).getByRole('button', { name: 'Make this look' }).click();
  await expectLook(page, 'Ivory Bias Slip');
  await expect((await openGroup(page, 'Cut')).getByRole('button', { name: 'Bias slip' })).toHaveAttribute('aria-pressed', 'true');
  // It comes in the cloth it's named for (ivory silk satin, faintly see-through), not the last fabric picked.
  const cloth = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}').finish?.fabric);
  expect(cloth).toMatchObject({ fibre: 'silk', colour: 'Ivory', special: 'satin', seeThrough: 'faint' });
});

test('Look 02, the Black Vest Set: both pieces in one look, each made on its own', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openCollection(page);
  const set = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'The Black Vest Set' }) });
  await expect(set).toContainText('SS27 Look 02');
  await expect(set.getByRole('img', { name: /Technical flat/ })).toHaveCount(2);
  // The skirt: wide box pleats, low on the hip, in crisp black wool.
  await set.getByRole('button', { name: 'Make the skirt' }).click();
  await expectLook(page, 'Black Pleated Skirt');
  const skirt = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(skirt.choices).toMatchObject({ pleats: 'box', pleatWidth: 'wide', rise: 'low' });
  expect(skirt.finish?.fabric).toMatchObject({ fibre: 'wool', colour: 'Black', drape: 'crisp' });
  // The vest: a sleeveless jacket with the high lapel and the chest seam.
  await page.goto('/');
  await page.getByRole('button', { name: /^Carry on with your/ }).first().click();
  // Carrying on with a look opens on the look itself; its questions, with the garment menu, are one tap behind it.
  await expectLook(page, 'Black Pleated Skirt');
  await openCollection(page);
  await main.getByRole('button', { name: 'Make the vest' }).click();
  await expectLook(page, 'Black Vest');
  const vest = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(vest.jacket).toMatchObject({ sleeve: 'none', lapel: 'high', yokeCm: 19, buttons: 3 });
});

test('the Leopard Shirt Dress: made in the house print, with its long-point collar and shirttail', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openCollection(page);
  const look = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Leopard Shirt Dress' }) });
  await expect(look.getByRole('img', { name: /Technical flat/ })).toBeVisible();
  if (process.env.SHOTS) await look.screenshot({ path: `${process.env.SHOTS}/leopard-look-${test.info().project.name}.png` });
  await look.getByRole('button', { name: 'Make this look' }).click();
  await changeLook(page);
  // Cut down to a mini, the title calls it a shirt dress, not a bodice (Cat, Nov 12: "How come I'm seeing this dress like
  // this under bodice").
  await expect(main.getByRole('heading', { name: 'Style Leopard Shirt Dress' })).toBeVisible();
  // It comes in the house's own print, photographed from the real cloth, and keeps the house shirt cut.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(saved.finish?.fabric).toMatchObject({ fibre: 'cotton', print: 'oneway', photo: { id: 'house-leopard-python' } });
  expect(saved.bodice).toMatchObject({ collar: 'shirt', shirtCut: 'house', dropCm: 47 });
  // Its own ease (36 cm) leaves no Fit chip pressed, but the folded Fit line still names the cut (bug hunt, Nov 11).
  const fit = main.locator('fieldset.group[data-label="Fit"]');
  if (await fit.locator('.fold-head').count()) await expect(fit.locator('.fold-pick')).toHaveText('Oversized');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/leopard-style-${test.info().project.name}.png`, fullPage: true });
  // Switching to another garment starts it in plain calico; the print doesn't follow (Cat, Nov 12).
  await switchGarment(page, 'Skirt');
  await expectStyle(page, 'Skirt');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(after.finish?.fabric).toBeUndefined();
});

test('the Leopard Shirt Dress: its print runs straight down, from a tile whose address changes with it', async ({ page }) => {
  await startWithExample(page);
  await openCollection(page);
  const look = page.getByRole('main').getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Leopard Shirt Dress' }) });
  // The tile the drawing is painted with.
  const tile = look.locator('.garment-fabric pattern').first();
  const href = await tile.locator('image').getAttribute('href');
  expect(href).toBeTruthy();
  // As drawn: turned by the pattern's own turn, if it has one.
  const turn = Number((await tile.getAttribute('patternTransform'))?.match(/rotate\(([-\d.]+)\)/)?.[1] ?? 0);
  // Its address carries a fingerprint of the file (a built app names it leopard-python-<fingerprint>.jpg), so a phone
  // that kept an earlier tile fetches the new one: at a fixed address Cat's phone kept the first, slanted tile and drew
  // the print on a diagonal two days after it was straightened (Nov 14).
  expect(href).not.toMatch(/\/prints\/house\//);
  // And its stripes run straight down: under the 1.5 degrees the eye can see, read the way a photo of the maker's own
  // cloth is read (fabricStraight.ts). The first tile leaned about 6 degrees.
  const grey = await page.evaluate(
    async ([src, deg]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      // The repeat painted turned, as the drawing paints it, one tile to 128 pixels; read from its middle.
      const n = 128;
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const g = c.getContext('2d')!;
      const pat = g.createPattern(img, 'repeat')!;
      pat.setTransform(new DOMMatrix().rotate(deg).scale(n / img.naturalWidth));
      g.fillStyle = pat;
      g.fillRect(0, 0, n, n);
      const d = g.getImageData(0, 0, n, n).data;
      return Array.from({ length: n * n }, (_, i) => (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3);
    },
    [href!, turn] as const,
  );
  expect(Math.abs((stripeLean(grey, 128) * 180) / Math.PI)).toBeLessThan(1.5);
});

test('the collection: the next drop stays hidden until it has a piece, and the Archive stays hidden until it opens', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openCollection(page);
  // Drop 01 has no piece yet, so it stays hidden: no strip and no sign-up (Cat, 2026-10-29).
  await expect(main.getByText('Date soon')).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Get the drop alert' })).toHaveCount(0);
  // The Archive's records are placeholders, so its tab is hidden for now (Cat, Nov 13).
  const shelves = main.getByRole('group', { name: 'Collection' });
  await expect(shelves.getByRole('button', { name: 'Eras' })).toBeVisible();
  await expect(shelves.getByRole('button', { name: 'Archive' })).toHaveCount(0);
  await expect(main.getByText('ARC 1954/001')).toHaveCount(0);
});

test('the Chocolate Barrel Trouser: made low on the hip with one pleat, in chocolate sateen', async ({ page }) => {
  await startWithExample(page);
  const main = page.getByRole('main');
  await openCollection(page);
  // Worn with the lilac lace blouse as Look 05, a set of two (Cat, Nov 14).
  const set = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'The Lilac Lace Set' }) });
  await expect(set).toContainText('SS27 Look 05');
  await expect(set.getByRole('img', { name: /Technical flat/ })).toHaveCount(2);
  const look = set.locator('.set-piece').filter({ has: page.getByRole('heading', { name: 'Chocolate Barrel Trouser' }) });
  await expect(look.getByRole('img', { name: /Technical flat/ })).toBeVisible();
  if (process.env.SHOTS) await look.screenshot({ path: `${process.env.SHOTS}/chocolate-barrel-look-${test.info().project.name}.png` });
  await look.getByRole('button', { name: 'Make the trouser' }).click();
  await expectLook(page, 'Chocolate Barrel Trouser');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
  expect(saved.finish?.fabric).toMatchObject({ fibre: 'cotton', colour: '#3d2418', drape: 'crisp', sheen: 'soft' });
  expect(saved.trousers).toMatchObject({ leg: 'barrel', rise: 'low', pleats: 'single', loops: 'loops', length: 'full' });
});

test('the Chocolate Barrel Trouser asks to re-measure on its own page when the crotch length is short for the depth', async ({ page }) => {
  // The note sat under the pattern preview, which a look's own page leaves out, so a tester never saw it (tester walk, Nov 16).
  const was = MEASUREMENTS['Crotch length'];
  MEASUREMENTS['Crotch length'] = '56';
  try {
    await openFresh(page);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Begin' }).click();
    await measureMe(page);
    await fillStepPages(page);
    await main.getByRole('button', { name: 'Choose what to make' }).click();
    await pickToMake(page, 'Trousers');
    await fillStepPages(page);
    await expectStyle(page, 'Trousers');
    await openCollection(page);
    const set = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'The Lilac Lace Set' }) });
    await set.locator('.set-piece').filter({ has: page.getByRole('heading', { name: 'Chocolate Barrel Trouser' }) }).getByRole('button', { name: 'Make the trouser' }).click();
    await expect(main.getByRole('button', { name: 'Change a detail' })).toBeVisible();
    await expect(main.getByText(/Your crotch length is short next to your crotch depth/)).toHaveCount(1);
    await expect(main.getByText(/Your crotch length is short next to your crotch depth/)).toBeVisible();
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/trouser-remeasure-${test.info().project.name}.png`, fullPage: true });
  } finally {
    MEASUREMENTS['Crotch length'] = was;
  }
});

test('a collection top with sleeves asks for the arms first, so its pattern has its sleeves', async ({ page }) => {
  // Measured for a skirt only: no arms yet. Made before, the Leopard Shirt Dress printed with no sleeve piece and said
  // "Sleeveless" (bug hunt, Nov 12).
  await openFresh(page);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Begin' }).click();
  await measureMe(page);
  await fillStepPages(page);
  await main.getByRole('button', { name: 'Choose what to make' }).click();
  await pickToMake(page, 'Skirt');
  await fillStepPages(page);
  await expectStyle(page, 'Skirt');
  await openCollection(page);
  await main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Leopard Shirt Dress', exact: true }) }).getByRole('button', { name: 'Make this look' }).click();
  // The pages it takes, then the look itself, ready to print.
  const made = main.getByRole('button', { name: 'Change a detail' });
  for (let n = 0; n < 4 && !(await made.isVisible()); n++) {
    if (await main.getByRole('textbox').count()) await fillStepPages(page);
    else await page.waitForTimeout(300);
  }
  await expect(made).toBeVisible();
  await expect(main.getByRole('heading', { level: 1, name: /Leopard Shirt Dress/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:account') ?? '{}'));
  expect(JSON.stringify(saved)).toContain('"arm_length"');
  await goPrint(page);
  // The pieces and their cut counts are the rows of Print only some pieces (Cat, Nov 28: one pieces list).
  await main.getByText('Print only some pieces').click();
  await expect(main.getByText(/^Sleeve\b.*: cut/).first()).toBeVisible();
  await expect(main.getByText(/Sleeveless/)).toHaveCount(0);
});
