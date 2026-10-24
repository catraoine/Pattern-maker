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
// While held, no frames are kept: the last one stays on screen until the change is drawn.
let hold = false;
async function start() {
  // A still screen sends no frames, so start with one. (Taken before the screencast starts: a screenshot during it
  // stalls it on the wide screen.)
  frames = [{ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 }];
  cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', (e) => {
    if (!hold) frames.push({ data: e.data, t: e.metadata.timestamp });
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
// A slimmer, taller sample figure, so the clothes read long and lean on the form (Cat, 2026-10-23).
const VALUES = { Height: '176', Weight: '', Waist: '62', 'Full hip': '90', 'Waist to hip': '21', 'Waist to knee': '62', 'Waist to floor': '112', 'Crotch depth': '27', 'Crotch length': '68', 'Full bust': '82', 'High bust': '78', Neck: '33', 'Shoulder width': '37', 'Back length': '43', 'Front length': '45', 'Bust depth': '25', 'Bust point to bust point': '17', 'Shoulder length': '12', 'Across back': '34', 'Across front': '31', Armhole: '38', 'Upper arm': '25', Wrist: '15', 'Arm length': '61' };
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

// style: the dress styled with the tools (Cat, 2026-10-23, after a COS dress): the waist seam dropped, the hem drawn
// longer and the side drawn looser on the form, then the drawing filled navy, a white stripe and, to end, Prince of
// Wales. A tap shows as the pen dot pressing the button; marks prints when each moment starts, for edit-tour.mjs.
const tap = async (loc, ms) => { await loc.evaluate((el) => el.click()); await p.evaluate(() => window.scrollTo(0, 0)); await wait(ms); };
await p.evaluate(() => {
  const d = document.createElement('div');
  d.id = 'pen';
  Object.assign(d.style, { position: 'fixed', width: '14px', height: '14px', margin: '-7px 0 0 -7px', borderRadius: '50%', background: '#d8c49c', opacity: 0, zIndex: 99998, pointerEvents: 'none', boxShadow: '0 0 0 6px rgba(216,196,156,.25)', transition: 'opacity .25s' });
  document.body.appendChild(d);
});
const pen = (x, y, o) => p.evaluate(([x, y, o]) => Object.assign(document.getElementById('pen').style, { left: x + 'px', top: y + 'px', opacity: o }), [x, y, o]);
const press = async (loc, ms) => {
  const bx = await loc.boundingBox();
  if (!bx || bx.y < 0 || bx.y + bx.height > (WIDE ? 810 : 768)) return tap(loc, ms);
  await pen(bx.x + bx.width / 2, bx.y + bx.height / 2, 1);
  await wait(380);
  await loc.evaluate((el) => el.click());
  await wait(220);
  await p.evaluate(() => { document.getElementById('pen').style.opacity = 0; });
  await wait(ms);
};
// A line drawn with the pen dot, through points given as fractions of the form picture.
const draw = async (loc, pts, pause) => {
  const bx = await loc.boundingBox();
  const at = ([x, y]) => [bx.x + x * bx.width, bx.y + y * bx.height];
  const path = [];
  for (let i = 0; i + 1 < pts.length; i++)
    for (let s = 0; s < 14; s++) path.push(at([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * s) / 14, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * s) / 14]));
  path.push(at(pts[pts.length - 1]));
  await p.evaluate(() => { document.getElementById('pen').style.transition = 'none'; });
  await pen(...path[0], 1);
  await p.mouse.move(...path[0]);
  await p.mouse.down();
  for (const [x, y] of path.slice(1)) { await p.mouse.move(x, y); await pen(x, y, 1); await wait(24); }
  await p.mouse.up();
  await pen(...path[path.length - 1], 0);
  await p.evaluate(() => { document.getElementById('pen').style.transition = 'opacity .25s'; });
  await wait(pause);
};
let t0;
const mark = (what) => console.log(`  style ${what}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
// The lines, as fractions of the form picture, drawn on the dress itself (Cat's D1 Draw on the Dress, 2026-10-24):
// the hem longer, down the calf, and the neckline a little wider and shallower, a soft boat neck but not a full one.
const LINES = WIDE
  ? { hem: [[0.36, 0.86], [0.5, 0.875], [0.64, 0.86]], neck: [[0.445, 0.135], [0.475, 0.152], [0.5, 0.156]] }
  : { hem: [[0.32, 0.86], [0.5, 0.875], [0.68, 0.86]], neck: [[0.44, 0.135], [0.47, 0.152], [0.5, 0.156]] };
await p.evaluate(() => window.scrollTo(0, 0));
await wait(600);
await start();
t0 = Date.now();
await wait(1200);
mark('shape');
await press(main.getByRole('tab', { name: 'Shape', exact: true }), 500);
const dropped = main.locator('button, [role=radio]').filter({ hasText: /^\s*Dropped/ }).first();
if (!WIDE) await glide(Math.max(0, await dropped.evaluate((el) => el.getBoundingClientRect().bottom + scrollY - 740)), 900);
await wait(500);
await press(dropped, 1800);
if (!WIDE) await glide(0, 700);
await wait(400);
mark('draw');
await press(main.getByRole('button', { name: 'Draw on your form' }).first(), 1300);
const form = main.getByRole('img', { name: /Your dress form from the/ });
const kinds = main.getByRole('group', { name: 'What you are drawing' });
await tap(kinds.getByRole('button', { name: 'Hem', exact: true }), 500);
await draw(form, LINES.hem, 1500);
await tap(kinds.getByRole('button', { name: 'Neckline', exact: true }), 500);
await draw(form, LINES.neck, 1500);
await press(main.getByRole('button', { name: 'Done', exact: true }), 600);
await p.evaluate(() => window.scrollTo(0, 0));
await press(main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Garment/ }), 700);
mark('fabric');
await tap(main.getByRole('tab', { name: 'Fabric', exact: true }), 1200);
// Two taps in one go, held off camera, so the frame between them (the cloth's own colour, or checks before stripes)
// never shows.
const both = async (first, second) => {
  hold = true;
  await twoTaps(first, second);
  await wait(400);
  hold = false;
};
const twoTaps = (first, second) => p.evaluate(async ([a, b]) => {
  const find = (q) => [...document.querySelectorAll(q.sel)].find((el) => el.getAttribute('aria-label') === q.name || el.textContent.trim().startsWith(q.name));
  find(a).click();
  // (React may draw the second button a task later, still before the next frame.)
  for (let i = 0; i < 20 && !find(b); i++) await new Promise((r) => setTimeout(r, 0));
  find(b).click();
  window.scrollTo(0, 0);
}, [first, second]);
await both({ sel: '[role=radiogroup][aria-label="Fabric for the sketch"] [role=radio]', name: 'Viscose' }, { sel: '[role=radiogroup][aria-label="Colour"] [role=radio]', name: 'Navy' });
await wait(2000);
const about = main.locator('summary', { hasText: 'About your fabric' });
if (!(await about.evaluate((el) => el.parentElement.open))) await tap(about, 100);
await both({ sel: '[role=radiogroup][aria-label="What\'s printed on your fabric"] [role=radio]', name: 'Checks' }, { sel: '[role=radiogroup][aria-label="Checks or stripes"] [role=radio]', name: 'Stripes' });
await wait(2000);
const stripes = main.getByRole('radiogroup', { name: 'Checks or stripes' });
mark('checks');
await tap(stripes.getByRole('radio', { name: 'Checks' }), 2600);
await stop('style');

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
