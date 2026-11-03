import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, startWithExample, test } from './fixtures';

// Not a test that runs in CI: the All round eye check (Sewist Fit Testing, 2026-11-02). About thirty unusual designs,
// each shaped as the draw tool and the dragged points shape them (a drawn hem, a dragged neckline, a dragged waist
// seam, a dragged slit), are saved as the app saves them, sewn on the form in the real page, and shot front, side
// and back, with what the score said (ready, or fallen back to "still in testing"). EYE_CHECK=<folder> takes it.
const OUT = process.env.EYE_CHECK;
test.skip(!OUT, 'Set EYE_CHECK to a folder to take the stills');

import { DESIGNS as EYE_DESIGNS, Design } from './eye-designs';

// EYE_FROM=<file> looks at a sample written by drapeSweep.test.ts (DRAPE_EYE) in place of the fixed designs: the
// weekly eye check's random designs and new options (All round quality, Cat 2026-11-03).
const DESIGNS: Design[] = process.env.EYE_FROM ? JSON.parse(readFileSync(process.env.EYE_FROM, 'utf8')) : EYE_DESIGNS;

const WORD: Record<string, string> = { skirt: 'skirt', bodice: 'bodice', dress: 'dress', jacket: 'jacket', coat: 'coat' };

test('all round eye check', async ({ page, consoleErrors }, info) => {
  test.setTimeout(3_600_000);
  consoleErrors.allow(/.*/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithExample(page);
  const main = page.getByRole('main');
  const only = process.env.EYE_ONLY?.split(',');
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  const results: Record<string, unknown>[] = [];
  for (const d of DESIGNS) {
    if (only && !only.includes(d.code)) continue;
    await page.evaluate(({ d }) => {
      const k = 'pattern-maker:skirt';
      const saved = JSON.parse(localStorage.getItem(k) ?? '{}');
      saved.garment = d.garment;
      Object.assign(saved, d.saved);
      saved.finish = { ...(saved.finish ?? {}), fabric: d.fabric };
      localStorage.setItem(k, JSON.stringify(saved));
    }, { d });
    await page.goto(process.env.EYE_SEWN === 'all' ? '/?sewn=all' : '/?sewn=outer');
    await page.waitForTimeout(800);
    const loading = page.getByRole('status', { name: /^Loading/ });
    if (await loading.isVisible().catch(() => false)) await page.keyboard.press('Escape');
    const again = page.getByRole('button', { name: /^Carry on with your/ });
    if (await again.count()) await again.first().click();
    await main.getByRole('heading', { level: 1, name: new RegExp(`^Style your ${WORD[d.garment]}`) }).waitFor({ timeout: 30_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const views = main.getByRole('group', { name: 'Garment view' });
    await views.getByRole('button', { name: 'All round', exact: true }).click();
    const cv = main.locator('canvas.all-round-canvas');
    await expect(cv).toBeAttached();
    let sewn = 'none';
    try {
      await expect(cv).not.toHaveAttribute('data-sewn', 'pending', { timeout: 90_000 });
      sewn = (await cv.getAttribute('data-sewn')) ?? 'none';
    } catch {
      sewn = 'timeout';
    }
    await page.waitForTimeout(1500);
    const note = (await main.locator('.all-round-note').textContent().catch(() => '')) ?? '';
    // With the Front drawing standing in for a failed sewn drawing, the whole view is shot.
    const standIn = await main.locator('.all-round-stand-in').count();
    const shotOf = standIn ? main.locator('.all-round') : cv;
    await shotOf.scrollIntoViewIfNeeded();
    const shots: string[] = [];
    for (const [k, at] of [['front', 0], ['side', 1.5708], ['back', 3.1416]] as const) {
      await cv.evaluate((el, at) => el.dispatchEvent(new CustomEvent('allround-turn', { detail: { at, probe: false } })), at);
      await page.waitForTimeout(500);
      const path = `${dir}/${d.code}-${k}.png`;
      await shotOf.screenshot({ path });
      shots.push(path);
    }
    results.push({ code: d.code, name: d.name, garment: d.garment, sewn, note: note.trim(), shots });
    writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2));
    console.log(`${d.code} ${sewn} ${d.name}`);
  }
});
