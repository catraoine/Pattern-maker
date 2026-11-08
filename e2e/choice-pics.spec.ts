import { mkdirSync, writeFileSync } from 'node:fs';
import { startWithExample, switchGarment, test, type GarmentName } from './fixtures';

// Not part of the ordinary end-to-end run: takes the option pictures (Cat's A2, Nov 8: a tight crop of our own
// form drawing, just the detail, no head). CHOICE_PICS=<folder> photographs the Front drawing for every option
// that has a picture, with the cloth's outline, and scripts/choice-pics.py crops them into public/pics.
const OUT = process.env.CHOICE_PICS;
test.skip(!OUT, 'Set CHOICE_PICS to a folder to take the option pictures');
test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3 });

const GARMENTS: GarmentName[] = ['Skirt', 'Bodice', 'Dress', 'Tee', 'Trousers', 'Jacket', 'Coat'];

test('option pictures', async ({ page, consoleErrors }) => {
  test.setTimeout(1_200_000);
  consoleErrors.allow(/.*/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  mkdirSync(OUT!, { recursive: true });
  const shots: Record<string, { garment: string; box: number[]; svg: number[]; cloth: number[]; form: number[] }> = {};
  await startWithExample(page);
  await page.addStyleTag({ content: '.preview-svg .guide, .preview-svg .handle, .preview-svg .form-stand { display: none !important; }' });
  for (const g of GARMENTS) {
    if (g !== 'Skirt') await switchGarment(page, g);
    await page.waitForTimeout(800);
    const tabs = page.getByRole('main').getByRole('tablist', { name: 'Style choices' }).getByRole('tab');
    for (let t = 0, n = await tabs.count(); t < n; t++) {
    await tabs.nth(t).click();
    await page.waitForTimeout(500);
    const keys = await page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('main :is(svg.pic, img.pic-photo)')).map((s) => [...s.classList].find((c) => /^pic-[a-z]+-/.test(c)) ?? ''))].filter(Boolean));
    for (const key of keys) {
      if (shots[key]) continue;
      // The pick to come back to, so the next group starts from the example's own look.
      const was = await page.evaluate((key) => {
        const chip = document.querySelector(`main .${key}`)!.closest('.chips')!;
        return Array.from(chip.querySelectorAll(':is(svg.pic, img.pic-photo)')).findIndex((s) => s.closest('.chip')!.classList.contains('on'));
      }, key);
      const ok = await page.evaluate((key) => {
        const b = document.querySelector(`main .${key}`)!.closest('button') as HTMLButtonElement;
        if (b.disabled) return false;
        b.click();
        return true;
      }, key);
      if (!ok) { console.log('disabled', g, key); continue; }
      await page.waitForTimeout(900);
      const r = await page.evaluate(() => {
        const svg = document.querySelector('main .preview .preview-svg') as SVGSVGElement;
        const cloth = svg.querySelector('g.cloth') as SVGGraphicsElement | null;
        const body = svg.querySelector('g.form-head') as SVGGraphicsElement | null;
        const vb = svg.viewBox.baseVal;
        const rb = svg.getBoundingClientRect();
        const c = cloth?.getBBox();
        const h = body?.getBBox();
        return { svg: [vb.x, vb.y, vb.width, vb.height, rb.width, rb.height], cloth: c ? [c.x, c.y, c.width, c.height] : [], form: h ? [h.x, h.y, h.width, h.height] : [] };
      });
      const file = `${OUT}/${key}.png`;
      await page.locator('main .preview .preview-svg').first().screenshot({ path: file });
      shots[key] = { garment: g, box: [], ...r };
      // Back to the pick it had.
      if (was >= 0) await page.evaluate(([key, was]) => {
        const chip = document.querySelector(`main .${key}`)!.closest('.chips')!;
        (Array.from(chip.querySelectorAll(':is(svg.pic, img.pic-photo)'))[was as number].closest('button') as HTMLButtonElement).click();
      }, [key, was] as const);
      await page.waitForTimeout(400);
    }
    }
  }
  writeFileSync(`${OUT}/shots.json`, JSON.stringify(shots, null, 1));
});
