import { expect, test } from './fixtures';
import { auditScreen } from './screenAudit';

// The screen check's eye (screenAudit.ts) on a page made to fail it, and on one that shouldn't.
test('the screen check finds words cut off and things past the screen edge', async ({ page }) => {
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0">
    <button style="width:60px;overflow:hidden;white-space:nowrap">Print my pattern now</button>
    <p style="width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">A long line of words that does not fit</p>
    <div style="position:relative;left:${(page.viewportSize()?.width ?? 400) - 40}px;width:200px">Standing out</div>
    <span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">For screen readers only</span>
    <div style="overflow-x:auto;width:100px;white-space:nowrap"><span>A row that slides along, read by scrolling</span></div>
  </body>`);
  const found = (await auditScreen(page)).join('\n');
  expect(found).toMatch(/cut off: button "Print my pattern now" is too wide/);
  expect(found).toMatch(/cut off: p "A long line of words/);
  expect(found).toMatch(/off the screen: div "Standing out"/);
  expect(found).toMatch(/the page scrolls sideways/);
  expect(found).not.toMatch(/screen readers|slides along/);
});
