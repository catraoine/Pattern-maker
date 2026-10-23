// Records the How it works film's shots from the running app (npx vite --port 5173 first): each moment as its own
// full-screen clip, with no captions, into [out dir]/<shot>.mp4. scripts/edit-tour.mjs cuts them into the film.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

// --wide records the computer's version, in the wide layout (Cat, 2026-10-22: a film for each screen).
const WIDE = process.argv.includes('--wide');
const [outArg, appArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OUT = resolve(outArg ?? (WIDE ? 'tour-shots-wide' : 'tour-shots'));
const APP = appArg ?? 'http://127.0.0.1:5173';
const [FW, FH] = WIDE ? [1920, 1080] : [1080, 1920];
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {});
const ctx = await b.newContext(WIDE ? { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 } : { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
// The waitlist front page only lets testers in; the recording browser is one.
await ctx.addInitScript(() => { try { localStorage.setItem('maison-trace-access', 'tester'); } catch {} });
const p = await ctx.newPage();
const main = p.getByRole('main');
const wait = (ms) => p.waitForTimeout(ms);

let cdp, frames;
async function start() {
  // A still screen sends no frames, so start with one. (Taken before the screencast starts: a screenshot during it
  // stalls it on the wide screen.)
  frames = [{ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 }];
  cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', (e) => {
    frames.push({ data: e.data, t: e.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: FW, maxHeight: FH });
  // The screencast can stop sending frames after a tap (on the phone too, 2026-10-23: the pattern shot froze on the
  // drawing); a speck in the corner that never stops changing keeps them coming.
  await p.evaluate(() => {
    if (document.getElementById('rec-tick')) return;
    const st = document.createElement('style');
    st.textContent = '@keyframes rec-tick{to{opacity:.98}}#rec-tick{position:fixed;left:0;top:0;width:2px;height:2px;background:#000;z-index:99999;pointer-events:none;animation:rec-tick .2s linear infinite alternate}';
    const d = document.createElement('div');
    d.id = 'rec-tick';
    document.head.appendChild(st);
    document.body.appendChild(d);
  });
}
async function stop(name) {
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  frames.push({ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 });
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
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', `fps=30,scale=${FW}:${FH},format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', join(OUT, `${name}.mp4`)], { cwd: work });
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

// tape: the tape pulls in across the top of the first page; the form and who; Begin measuring carries it on down
// to the waist, all in one move
{
  // The film skips the welcome (Cat, 2026-10-23): after 01 Measure the tape pulls in along the top from the right,
  // hook first, then the first page comes up under it. Begin is pressed off camera.
  await main.getByRole('button', { name: 'Begin' }).click();
  await main.getByRole('button', { name: 'Begin measuring', exact: true }).waitFor();
  await wait(2500);
  await p.evaluate(() => {
    const tape = document.querySelector('.tape-band.landed');
    const page = [...tape.parentElement.children].filter((c) => c !== tape).flatMap((c) => (getComputedStyle(c).display === 'contents' ? [...c.children] : [c]));
    tape.style.transform = `translateX(${innerWidth - tape.getBoundingClientRect().left + 8}px)`;
    // (The page's own entrance is a CSS animation, which an inline opacity can't hold down; an animation can.)
    window.recHidden = page.map((c) => c.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' }));
  });
  await start();
  await wait(400);
  await p.evaluate(() => new Promise((done) => {
    const tape = document.querySelector('.tape-band.landed');
    const page = [...tape.parentElement.children].filter((c) => c !== tape).flatMap((c) => (getComputedStyle(c).display === 'contents' ? [...c.children] : [c]));
    const from = tape.style.transform;
    tape.style.transform = '';
    tape.animate([{ transform: from }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(0.35, 0.1, 0.25, 1)' }).finished.then(() => {
      page.forEach((c, i) => {
        c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-out', fill: 'forwards' }).finished.then((a) => a.cancel());
        window.recHidden[i].cancel();
      });
      done();
    });
  }));
  await wait(1500);
}
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
// Clicked straight on the button: Playwright's click waits for the screen to settle, and the form never stops moving.
await main.getByRole('radiogroup', { name: 'What would you like to make?' }).getByRole('radio', { name: /^Dress\b/ }).evaluate((el) => el.click());
await wait(1800);
await stop('choose');
await main.getByRole('button', { name: /^(Next: \d+ dress measurements?|Style my dress)$/ }).click();
await fillAll();
await main.getByRole('heading', { level: 1, name: 'Style your dress' }).waitFor();
await wait(1500);

// collection: the Maison collection's looks, a slow scroll down to Épaule (Cat, 2026-10-22: the column dress read
// wide and frumpy on the form; Épaule's bare shoulder and dipped hem are the sharper silhouette)
const entry = main.getByRole('button', { name: 'Start from the Maison collection' });
await entry.scrollIntoViewIfNeeded();
await entry.click();
await wait(1500);
await p.evaluate(() => window.scrollTo(0, 0));
const epaule = main.locator('li.house-look').filter({ has: p.getByRole('heading', { name: 'Épaule', exact: true }) });
const lookTop = await epaule.evaluate((el) => el.getBoundingClientRect().top + scrollY - 70);
const tailleurTop = await main.locator('li.house-look').first().evaluate((el) => el.getBoundingClientRect().top + scrollY - 70);
await glide(tailleurTop, 10);
await wait(800);
await start();
await wait(1400);
await glide(lookTop, 6500);
await wait(1600);
await stop('collection');
await epaule.getByRole('button', { name: 'Make this look' }).click();
await wait(1500);
await fillAll();
await main.getByRole('heading', { level: 1, name: /^Style your/ }).waitFor();
await p.evaluate(() => window.scrollTo(0, 0));
await wait(1500);

// fabric: the Fabric tab, the dress filling with one fabric and colour after another (Cat, 2026-10-22: in place of
// the photo looks). Taps go straight to the buttons so the page doesn't scroll away from the drawing.
const tap = async (loc, ms) => { await loc.evaluate((el) => el.click()); await p.evaluate(() => window.scrollTo(0, 0)); await wait(ms); };
await tap(main.getByRole('tab', { name: 'Fabric', exact: true }), 1200);
const fabric = (name) => main.getByRole('radio', { name, exact: true });
const colour = (name) => main.getByRole('radiogroup', { name: 'Colour' }).getByRole('radio', { name, exact: true });
await start();
await wait(1000);
await tap(fabric('Satin'), 600);
await tap(colour('Black'), 1500);
await tap(fabric('Silk'), 500);
await tap(colour('Ivory'), 1500);
await tap(fabric('Velvet'), 500);
await tap(colour('Emerald'), 1500);
await tap(fabric('Wool'), 500);
await tap(colour('Burgundy'), 1800);
await stop('fabric');
await tap(fabric('Satin'), 300);
await tap(colour('Black'), 600);

// pattern: the pieces you cut
await start();
await wait(500);
const patternView = main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ });
await tap(patternView, 0);
await main.getByRole('button', { name: 'Move points' }).waitFor({ timeout: 20000 });
await wait(3000);
await stop('pattern');
await tap(main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Garment/ }), 800);

// round: turning all round on the form, filling the screen and drawing closer as it turns (Cat, 2026-10-22: start
// close, then in and in, cinematic). The canvas is lifted out at its closest size, so it is drawn sharp, and shown
// smaller by a scale that grows; resizing it as it goes would blank it between redraws.
// (After the pattern: from All round, Pattern doesn't redraw in time.)
await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round' }).click();
await wait(800);
const CLOSEST = 3.4;
await p.evaluate((K) => {
  const c = document.querySelector('.all-round-canvas');
  document.body.appendChild(c);
  const w = innerWidth * K, h = (innerHeight + 96) * K;
  Object.assign(c.style, { position: 'fixed', zIndex: 9999, background: '#000', maxWidth: 'none', maxHeight: 'none', aspectRatio: 'auto', margin: 0, width: `${w}px`, height: `${h}px`, left: `${innerWidth / 2 - w / 2}px` });
}, CLOSEST);
const zoomTo = (from, to, ms) => p.evaluate(([from, to, ms, K]) => new Promise((done) => {
  const c = document.querySelector('.all-round-canvas');
  const h = (innerHeight + 96) * K;
  // Where to keep still as it grows, as a fraction of the canvas: the bodice, rising a little towards the bust.
  const set = (k) => {
    const fy = 0.42 - 0.08 * ((k - from) / (to - from || 1));
    Object.assign(c.style, { top: `${innerHeight / 2 - fy * h}px`, transformOrigin: `50% ${fy * 100}%`, transform: `scale(${k / K})` });
  };
  const t0 = performance.now();
  const ease = (x) => x * x * (3 - 2 * x);
  const step = (now) => { const x = Math.min(1, (now - t0) / (ms || 1)); set(from + (to - from) * ease(x)); x < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
}), [from, to, ms, CLOSEST]);
await zoomTo(1.3, 1.3, 0);
await wait(600);
await start();
await wait(400);
await zoomTo(1.3, 3.4, 8500);
await wait(600);
await stop('round');
// Put the canvas back where it was.
await p.evaluate(() => {
  const c = document.querySelector('.all-round-canvas');
  document.querySelector('.all-round')?.prepend(c);
  c.removeAttribute('style');
});
await wait(600);

// print: the print page, A4, and the tiled pages
// On a computer the summary and Print sit beside the drawing; there's no Review page.
if (!WIDE) {
  await main.getByRole('button', { name: 'Review', exact: true }).click();
  await wait(1200);
}
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
