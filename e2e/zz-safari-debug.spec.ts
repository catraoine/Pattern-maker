import { expect, goPrint, startWithExample, test } from './fixtures';

// Temporary: where Safari's page crashes on a reload. Removed once found.
for (const [name, wait, print] of [['style, reload at once', 0, false], ['print, reload at once', 0, true], ['print, wait 60 s, reload', 60_000, true], ['print, blank page first, then reload', -1, true]] as const) {
  test(`debug: ${name}`, async ({ page }) => {
    const log: string[] = [];
    page.on('console', (m) => log.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
    page.on('crash', () => log.push('CRASH'));
    page.on('worker', (w) => log.push(`worker ${w.url()}`));
    await startWithExample(page);
    if (print) {
      await goPrint(page);
      await expect(page.getByRole('main').getByRole('group', { name: 'Paper' })).toBeVisible();
    }
    if (wait > 0) await page.waitForTimeout(wait);
    let err = '';
    try {
      if (wait < 0) await page.goto('about:blank');
      await page.reload();
    } catch (e) {
      err = String(e).slice(0, 200);
    }
    console.log(`DEBUG ${name}: ${err || 'reload ok'}\n  ${log.slice(-15).join('\n  ')}`);
  });
}
