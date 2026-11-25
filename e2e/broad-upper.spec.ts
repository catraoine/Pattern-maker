import { MEASUREMENTS, expect, expectStyle, fillStepPages, measureMe, openFresh, pickToMake, test } from './fixtures';

// A top asks a maker whose high bust is as big as her bust or bigger (a broad, athletic upper body) for her across back
// and armhole, which are otherwise guessed from the bust (Cat, Nov 24: a tester shaped so found both tight). The high
// bust is taken on the same pages, so the two are added after it; anyone else is asked as before.
for (const [high, asked] of [['93', true], ['86', false]] as const) {
  test(`a first top with a high bust of ${high} on a 92 bust ${asked ? 'asks' : 'does not ask'} across back and armhole`, async ({ page }) => {
    await openFresh(page);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Begin' }).click();
    await measureMe(page);
    await fillStepPages(page);
    await main.getByRole('button', { name: 'Choose what to make' }).click();
    await pickToMake(page, 'Bodice');
    const seen: string[] = [];
    for (let n = 0; n < 20; n++) {
      const input = main.getByRole('textbox');
      await expect(input).toHaveCount(1);
      const label = (await input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).replace(/\(optional\)/i, '').trim();
      if (seen[seen.length - 1] === label) continue;
      seen.push(label);
      await input.fill(label === 'High bust' ? high : MEASUREMENTS[label]);
      const next = main.getByRole('button', { name: /^Next\b/ });
      const name = (await next.textContent())?.trim() ?? '';
      await next.click();
      if (name !== 'Next') break;
    }
    expect(seen.includes('Across back'), seen.join(', ')).toBe(asked);
    expect(seen.includes('Armhole'), seen.join(', ')).toBe(asked);
    await expectStyle(page, 'Bodice');
  });
}
