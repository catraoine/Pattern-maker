import { addCloserFit, chooseChip, expect, fillStepPages, lower, measureMe, openAccount, openFresh, pickToMake, printA4, stepButton, switchGarment, test, type GarmentName } from './fixtures';

// Two chips to change on each garment's style screen: [group legend, chip].
const STYLE_CHANGES: Record<GarmentName, [string, string][]> = {
  // A pencil skirt keeps its zip, so this one stays A-line for the elastic waist.
  Skirt: [
    ['Silhouette', 'A-line'],
    ['Length', 'Midi'],
    ['Pockets', 'In-seam'],
    ['Waist', 'Elastic, pull-on'],
  ],
  Trousers: [
    ['Leg', 'Wide'],
    ['Fit', 'Fitted'],
  ],
  Bodice: [
    ['Neckline', 'V-neck'],
    ['Sleeves', 'Short'],
  ],
  Dress: [
    ['Neckline', 'Scoop'],
    ['Silhouette', 'Full circle'],
  ],
  Tee: [
    ['Neckline', 'V-neck'],
    ['Sleeves', 'Long'],
  ],
  Jacket: [
    ['Front', 'Double-breasted'],
    ['Collar', 'Stand collar'],
  ],
  Coat: [
    ['Length', 'Midi'],
    ['Below the hip', 'A-line'],
  ],
};

test('fresh visitor: welcome, measure, style every garment, print the A4 PDF', async ({ page }, info) => {
  test.setTimeout(240_000);
  await openFresh(page);
  const main = page.getByRole('main');

  // Welcome: one button, and the tour plays from the dress form.
  await expect(main.getByRole('button', { name: /Try an example/ })).toHaveCount(0);
  await main.getByRole('button', { name: /^Watch how it works/ }).click();
  const tour = page.getByRole('dialog', { name: 'How it works' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: /Skip tour/ }).click();
  await expect(tour).toHaveCount(0);

  // Begin, then the base measurements one page at a time.
  await main.getByRole('button', { name: 'Begin' }).click();
  await expect(main.getByRole('heading', { name: /take some measurements/i })).toBeVisible();

  // Who you're designing for, and the form, come first: someone else asks their name before any measurement;
  // this visitor measures herself.
  await main.getByRole('radio', { name: 'Someone else' }).click();
  const who = main.getByRole('textbox', { name: 'Name' });
  await expect(who).toBeVisible();
  await expect(who).not.toHaveAttribute('placeholder');
  await expect(main.getByRole('button', { name: 'Begin measuring' })).toBeDisabled();
  await main.getByRole('radio', { name: 'For me' }).click();
  await expect(who).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Begin measuring' })).toBeEnabled();

  await measureMe(page);
  await fillStepPages(page);

  await expect(main.getByRole('heading', { name: 'Do these look right?' })).toBeVisible();
  await expect(main.getByRole('list')).toContainText('92 cm');
  await main.getByRole('button', { name: 'Choose what to make' }).click();

  // The skirt first: its extra measurements, then straight on to styling it.
  await pickToMake(page, 'Skirt');
  await fillStepPages(page);

  // Then each garment in turn: style it, print it.
  const order: GarmentName[] = ['Skirt', 'Trousers', 'Bodice', 'Dress', 'Tee', 'Jacket', 'Coat'];
  for (const g of order) {
    await test.step(g, async () => {
      if (g !== 'Skirt') {
        await stepButton(page, 'Style').click();
        await switchGarment(page, g);
      }
      await expect(main.getByRole('heading', { name: `Style your ${lower(g)}` })).toBeVisible();
      // The bodice's sleeves wait for the arm measurements, which it doesn't ask for up front.
      if (g === 'Bodice') await addCloserFit(page, g);
      for (const [group, chip] of STYLE_CHANGES[g]) await chooseChip(page, group, chip);
      if (g === 'Skirt') await expect(main.getByText(/^Pulls on over your hips, so there is no zip/)).toBeVisible();
      await printA4(page, info);
    });
  }

  // Her name, given in Your account, shows on the header's account button.
  await openAccount(page);
  await main.getByRole('button', { name: 'Add your name' }).click();
  const name = main.getByRole('textbox', { name: 'Name', exact: true });
  await expect(name).not.toHaveAttribute('placeholder');
  await name.fill('Ada');
  await expect(page.getByRole('banner').getByRole('button', { name: 'Your account (Ada)' })).toBeVisible();
});
