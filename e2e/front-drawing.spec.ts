import { mkdirSync, writeFileSync } from 'node:fs';
import { startWithExample, test } from './fixtures';
import { patternDesigns } from '../src/patternSweep';
import { INITIAL } from '../src/savedWork';

// Not part of the ordinary end-to-end run: the Front drawing check's capture (Quality: Automated checks, Cat 2026-11-04).
// Every option of every garment is saved as the app saves it, the Style page is opened in the real app, and the Front
// drawing it shows (the garment's cloth over the form, which also stands in for All round when that fails) is read out
// of the page: its frame and every piece of cloth. src/frontCheck.test.ts scores what this writes, as All round's
// quality check scores a sewn drawing. FRONT_CHECK=<folder> takes it; FRONT_SHARD=i/n takes one share of the designs.
const OUT = process.env.FRONT_CHECK;
test.skip(!OUT, 'Set FRONT_CHECK to a folder to capture the Front drawings');

const CHUNKS = 4;
const [shard, shards] = (process.env.FRONT_SHARD ?? '1/1').split('/').map(Number);
const all = patternDesigns();
const mine = all.filter((_, i) => i % shards === shard - 1);

for (let chunk = 0; chunk < CHUNKS; chunk++) {
  test(`front drawings ${shard}/${shards} part ${chunk + 1}`, async ({ page, consoleErrors }, info) => {
    test.skip(info.project.name !== 'desktop', 'The Front drawing is the same shape on a phone; one size is enough');
    test.setTimeout(3_600_000);
    consoleErrors.allow(/.*/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startWithExample(page);
    const main = page.getByRole('main');
    const base = await page.evaluate(() => JSON.parse(localStorage.getItem('pattern-maker:skirt') ?? '{}'));
    const out: Record<string, unknown> = {};
    for (const d of mine.filter((_, i) => i % CHUNKS === chunk)) {
      await page.evaluate(
        ({ d, base, initial }) => {
          // Each design from the same saved work (the example body), with only its own choices set, as patternDesigns
          // drafts it.
          const saved = { ...base, ...initial, garment: d.garment, ...d.saved, finish: { ...(base.finish ?? {}), ...(d.finish ?? {}) } };
          for (const k of ['dress', 'tee', 'trousers', 'jacket', 'coat']) if (!(k in d.saved)) delete saved[k];
          localStorage.setItem('pattern-maker:skirt', JSON.stringify(saved));
        },
        { d, base, initial: { choices: INITIAL.choices, bodice: INITIAL.bodice } },
      );
      try {
        await page.goto('/');
        const heading = main.getByRole('heading', { level: 1, name: /^Style your/ });
        const again = page.getByRole('button', { name: /^Carry on with your/ });
        await again.or(heading).first().waitFor({ timeout: 30_000 });
        if (await again.count()) await again.first().click();
        await heading.waitFor({ timeout: 30_000 });
        const svg = main.locator('section[aria-label="Preview"] svg.form-still, section[aria-label="Preview"] svg:has(g.cloth)').first();
        await svg.waitFor({ timeout: 20_000 });
        out[d.key] = await svg.evaluate((el) => ({
          viewBox: el.getAttribute('viewBox'),
          cloth: [...el.querySelectorAll('g.cloth path.cloth-fill')].map((p) => p.getAttribute('d') ?? ''),
        }));
      } catch (e) {
        out[d.key] = { error: String(e).split('\n')[0] };
      }
    }
    mkdirSync(OUT!, { recursive: true });
    writeFileSync(`${OUT}/front-${shard}-${chunk + 1}.json`, JSON.stringify(out));
  });
}
