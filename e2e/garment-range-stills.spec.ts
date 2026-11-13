import { chooseDrop, fillStepPages, startWithExample, test } from './fixtures';

// Stills of the Garment range in the app (2026-11-07): each of the fifteen starting Looks of the knit dress, hoodie and
// jumpsuit, on the form and as a flat. Not a CI test.
// RANGE_STILLS=<folder> npx playwright test -c e2e garment-range-stills --project=phone
const OUT = process.env.RANGE_STILLS;
test.skip(!OUT, 'Set RANGE_STILLS to a folder to take the stills');

const RANGE: [string, string[]][] = [
  ['Knit dress', ['T-shirt dress', 'Rib midi', 'Skater', 'Column maxi', 'Jumper dress']],
  ['Hoodie', ['Classic', 'Zip-up', 'Cropped', 'Oversized', 'Half-zip']],
  ['Jumpsuit', ['Boiler', 'Cami wide leg', 'Halter flare', 'Tailored V', 'Playsuit']],
];

test('garment range stills', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/.*/);
  test.setTimeout(900_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  await page.evaluate(() => {
    const k = 'pattern-maker:account';
    const a = JSON.parse(localStorage.getItem(k) ?? '{}');
    for (const person of a.people ?? []) Object.assign(person.values, { arm_length: 59, upper_arm: 27, wrist: 15.5 });
    localStorage.setItem(k, JSON.stringify(a));
  });
  await page.reload();
  await page.waitForTimeout(1500);
  const carryOn = page.getByRole('button', { name: /^Carry on with your/ });
  if (await carryOn.count()) await carryOn.first().click();
  const main = page.getByRole('main');
  page.setDefaultTimeout(20_000);
  for (const [garment, looks] of RANGE) {
    console.log('garment', garment);
    await chooseDrop(page, 'Garment', 'Start a new garment ›');
    await main.getByRole('group', { name: 'What would you like to make?' }).getByRole('button', { name: new RegExp(`^${garment}\\b`) }).click();
    await page.waitForTimeout(800);
    if (await main.getByRole('textbox').count()) await fillStepPages(page);
    await main.getByRole('heading', { level: 1, name: new RegExp(`Style your ${garment.toLowerCase()}`) }).waitFor();
    for (const [i, look] of looks.entries()) {
      console.log('look', look);
      await main.getByRole('button', { name: look, exact: true }).first().click();
      await page.waitForTimeout(700);
      const preview = main.getByRole('region', { name: 'Preview' });
      const shot = async (view: string) => {
        await preview.getByRole('radio', { name: view, exact: true }).or(preview.getByRole('tab', { name: view, exact: true })).or(preview.getByRole('button', { name: view, exact: true })).first().click();
        await page.waitForTimeout(600);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${OUT}/${garment.replace(' ', '-').toLowerCase()}-${i + 1}-${view.toLowerCase()}.png` });
      };
      await shot('Front');
      await shot('Flat');
    }
  }
});
