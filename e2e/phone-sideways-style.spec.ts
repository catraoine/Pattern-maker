import { expect, openCollection, startWithExample, test } from './fixtures';

// A phone turned sideways on Style: the drawing's corner words (Enlarge, Draw or Move points, Demo) sat on the page
// over the title, and the view bar's dark track ran across the middle of the drawing (bug hunt, Nov 18).
test('turned sideways, the corner words and the view bar stay with the drawing', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'a phone on its side');
  const main = page.getByRole('main');
  await startWithExample(page);
  await openCollection(page);
  const card = main.getByRole('listitem').filter({ hasText: 'Blush Shift' }).first();
  await card.getByRole('button', { name: /^Make (this look|the )/ }).first().click();
  await main.getByRole('button', { name: 'Change a detail' }).click();
  for (const view of ['garment', 'pattern'] as const) {
    if (view === 'pattern') {
      await page.setViewportSize({ width: 390, height: 844 });
      await main.getByRole('button', { name: /^Pattern/ }).first().click();
    }
    await page.setViewportSize({ width: 844, height: 390 });
    const box = (await page.locator('.style-pin .preview').first().boundingBox())!;
    for (const name of [/^Enlarge/, view === 'pattern' ? /^Move points/ : /^Draw/, /^Demo/]) {
      const b = (await page.locator('.preview-corner').getByRole('button', { name }).first().boundingBox())!;
      expect(b.y, `${view}: ${name}`).toBeGreaterThanOrEqual(box.y);
      expect(b.x, `${view}: ${name}`).toBeGreaterThanOrEqual(box.x);
    }
    // The words don't overlap one another.
    const [enlarge, tool, demo] = await Promise.all([/^Enlarge/, view === 'pattern' ? /^Move points/ : /^Draw/, /^Demo/].map(async (name) => (await page.locator('.preview-corner').getByRole('button', { name }).first().boundingBox())!));
    expect(enlarge.x + enlarge.width).toBeLessThanOrEqual(tool.x + 1);
    expect(tool.x + tool.width).toBeLessThanOrEqual(demo.x + 1);
    // The dark track sits on the view bar's line, under the drawing, not across it.
    const track = await page.locator('.style-pin > section > .row.between.wrap').first().evaluate((e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e, '::before');
      return { rowTop: r.top, pos: getComputedStyle(e).position, before: s.position };
    });
    expect(track.rowTop).toBeGreaterThanOrEqual(box.y + box.height - 1);
    expect(track.pos).not.toBe('static');
  }
});
