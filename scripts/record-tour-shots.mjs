// Records the How it works film's shots from the running app (npx vite --port 5173 first): each moment as its own
// full-screen clip, with no captions, into [out dir]/<shot>.mp4. scripts/edit-tour.mjs cuts them into the film.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = resolve(process.argv[2] ?? 'tour-shots');
const APP = process.argv[3] ?? 'http://127.0.0.1:5173';
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {});
const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
// The waitlist front page only lets testers in; the recording browser is one.
await ctx.addInitScript(() => { try { localStorage.setItem('maison-trace-access', 'tester'); } catch {} });
const p = await ctx.newPage();
const main = p.getByRole('main');
const wait = (ms) => p.waitForTimeout(ms);

let cdp, frames;
async function start() {
  frames = [];
  cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', (e) => {
    frames.push({ data: e.data, t: e.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920 });
  // A still screen sends no frames, so start with one.
  frames.push({ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 });
}
async function stop(name) {
  frames.push({ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 });
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const endT = Date.now() / 1000;
  frames.sort((a, c) => a.t - c.t);
  const work = mkdtempSync(join(tmpdir(), 'shot-'));
  let list = 'ffconcat version 1.0\n';
  frames.forEach((fr, i) => {
    const f = `${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(join(work, f), Buffer.from(fr.data, 'base64'));
    list += `file '${f}'\nduration ${Math.max((i + 1 < frames.length ? frames[i + 1].t : endT) - fr.t, 0.001).toFixed(4)}\n`;
  });
  list += `file '${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(join(work, 'list.txt'), list);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', 'fps=30,scale=1080:1920,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', join(OUT, `${name}.mp4`)], { cwd: work });
  rmSync(work, { recursive: true, force: true });
  console.log(`${name}: ${(endT - frames[0].t).toFixed(1)} s`);
}
const VALUES = { Height: '165', Weight: '', Waist: '76', 'Full hip': '102', 'Waist to hip': '20.5', 'Waist to knee': '58', 'Waist to floor': '104', 'Crotch depth': '27', 'Crotch length': '70', 'Full bust': '92', 'High bust': '86', Neck: '35', 'Shoulder width': '38', 'Back length': '41', 'Front length': '44', 'Bust depth': '26', 'Bust point to bust point': '18', 'Shoulder length': '12', 'Across back': '35', 'Across front': '32', Armhole: '40', 'Upper arm': '28', Wrist: '16', 'Arm length': '58' };
async function fillAll() {
  let last = '';
  const checked = main.getByRole('heading', { name: 'Do these look right?' });
  const styled = main.getByRole('heading', { level: 1, name: /^Style your/ });
  for (let n = 0; n < 40; n++) {
    const input = main.getByRole('textbox');
    for (let k = 0; k < 80; k++) {
      if (await styled.count()) return;
      if (last && (await checked.count())) return;
      if ((await input.count()) === 1) { const l = await input.evaluate((el) => (el.labels?.[0]?.textContent ?? '').replace(/\(optional\)/i, '').trim()); if (l !== last) { last = l; break; } }
      await wait(100);
    }
    const v = VALUES[last] ?? '30';
    if (v) await input.fill(v);
    const next = main.getByRole('button', { name: /^(Next|Done|Save)\b/ });
    const name = ((await next.textContent()) ?? '').trim();
    await next.click();
    if (!/^Next$/.test(name)) return;
  }
}
/** A slow, eased scroll, smoother than the browser's own. */
const glide = (to, ms) => p.evaluate(([to, ms]) => new Promise((done) => {
  const from = scrollY; const t0 = performance.now();
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const step = (now) => { const x = Math.min(1, (now - t0) / ms); scrollTo(0, from + (to - from) * ease(x)); x < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
}), [to, ms]);

// form: the opening drawing, then the welcome's form and its tape tip
await p.goto(`${APP}/?fresh`);
await start();
await wait(9500);
await stop('form');

// tape: Begin pulls the tape out and up to the first page; the form and who; Begin measuring carries it on down
// to the waist, all in one move
await start();
await wait(600);
await main.getByRole('button', { name: 'Begin' }).click();
await wait(3200);
await main.getByRole('radiogroup', { name: 'Which form to draft on?' }).getByRole('radio', { name: /^Womenswear/ }).click();
await wait(600);
await main.getByRole('radio', { name: 'For me' }).click();
await wait(900);
await main.getByRole('button', { name: 'Begin measuring', exact: true }).click();
await wait(3600);
await stop('tape');
await fillAll();

// choose: what to make, and the dress picked
await main.getByRole('button', { name: 'Choose what to make' }).click();
await main.getByRole('heading', { name: 'What would you like to make?' }).waitFor();
await wait(900);
await start();
await wait(1600);
await main.getByRole('radiogroup', { name: 'What would you like to make?' }).getByRole('radio', { name: /^Dress\b/ }).click();
await wait(1800);
await stop('choose');
await main.getByRole('button', { name: /^(Next: \d+ dress measurements?|Style my dress)$/ }).click();
await fillAll();
await main.getByRole('heading', { level: 1, name: 'Style your dress' }).waitFor();
await wait(1500);

// collection: the Maison collection's looks, a slow scroll down to Colonne
const entry = main.getByRole('button', { name: 'Start from the Maison collection' });
await entry.scrollIntoViewIfNeeded();
await entry.click();
await wait(1500);
await p.evaluate(() => window.scrollTo(0, 0));
const colonne = main.locator('li.house-look').filter({ has: p.getByRole('heading', { name: 'Colonne', exact: true }) });
const colTop = await colonne.evaluate((el) => el.getBoundingClientRect().top + scrollY - 70);
const tailleurTop = await main.locator('li.house-look').first().evaluate((el) => el.getBoundingClientRect().top + scrollY - 70);
await glide(tailleurTop, 10);
await wait(800);
await start();
await wait(1400);
await glide(colTop, 9000);
await wait(1600);
await stop('collection');
await colonne.getByRole('button', { name: 'Make this look' }).click();
await wait(1500);
await fillAll();
await main.getByRole('heading', { level: 1, name: /^Style your/ }).waitFor();
await p.evaluate(() => window.scrollTo(0, 0));
await wait(1500);

// dress: the column dress drawn to you
await start();
await wait(3500);
await stop('dress');

// pattern: the pieces you cut
await start();
await wait(500);
const patternView = main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ });
await patternView.click();
await p.waitForFunction((el) => el.getAttribute('aria-pressed') === 'true', await patternView.elementHandle(), { timeout: 5000 }).catch(async () => { await patternView.dispatchEvent('click'); });
await wait(4000);
await stop('pattern');
await main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Garment/ }).click();
await wait(800);

// round: turning all round on the form (after the pattern: from All round, Pattern doesn't redraw in time)
await start();
await wait(500);
await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round' }).click();
await wait(5500);
await stop('round');

// print: the print page, A4, and the tiled pages
await main.getByRole('button', { name: 'Review', exact: true }).click();
await wait(1200);
await main.getByRole('button', { name: 'Print my pattern' }).click();
await wait(1200);
await main.getByRole('group', { name: 'Paper' }).getByRole('button', { name: 'A4', exact: true }).click();
await main.getByRole('button', { name: /^Download PDF/ }).waitFor({ timeout: 45000 });
await p.evaluate(() => window.scrollTo({ top: 0 }));
await wait(800);
await start();
await wait(1500);
await glide(700, 900);
await wait(1800);
await glide(1120, 700);
await wait(3500);
await stop('print');

await b.close();
