// Records the tour's walkthrough video (public/tour/walkthrough.mp4, and a .webm copy) from the running app, with a caption
// under each step. Re-record it whenever the welcome or the first measuring pages change (Cat's rule,
// 2026-10-17), then update PARTS and TOUR_LABEL in src/ui/TourPlayer.tsx from the times this prints.
//
//   npx vite --port 5173            (in another terminal)
//   npm run record:tour             (or: node scripts/record-demo.mjs [out dir] [app url])
//
// Needs ffmpeg. Chromium records through a CDP screencast, since Playwright's own video can't go above the
// viewport's size; the frames are joined into a 1080x1920 MP4.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
const OUT = resolve(process.argv[2] ?? 'public/tour');
// The frames go to a scratch folder; only the finished video lands in OUT.
const WORK = mkdtempSync(join(tmpdir(), 'tour-'));
const APP = process.argv[3] ?? 'http://127.0.0.1:5173';
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {});
const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
mkdirSync(WORK + '/frames', { recursive: true });
mkdirSync(OUT, { recursive: true });
let started = 0;
const marks = [];
const frames = [];
let cdp;
async function startRec() {
  cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', async (e) => {
    frames.push({ data: e.data, t: e.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
}
let f; let main;
const wait = (ms) => p.waitForTimeout(ms);

const OVERLAY = () => {
  if (document.getElementById('demo-ov')) return;
  const s = document.createElement('style');
  s.textContent = `
  html,body{margin:0;background:#000;overflow:hidden}
  #app{position:fixed;left:0;top:0;width:432px;height:672px;border:0;border-bottom:1px solid rgba(239,228,204,.3)}
  #demo-cap{position:fixed;left:0;right:0;bottom:0;height:96px;box-sizing:border-box;z-index:99999;padding:16px 20px;background:#000;color:#efe4cc;font:500 16px/1.35 'Space Grotesk',sans-serif;letter-spacing:.01em;transition:opacity .35s;opacity:0;pointer-events:none}
  #demo-cap small{display:block;font:400 10px/1 'Chakra Petch',monospace;letter-spacing:.22em;text-transform:uppercase;opacity:.7;margin-bottom:6px}
  #demo-tap{position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #efe4cc;background:rgba(239,228,204,.25);pointer-events:none;opacity:0;transform:scale(.4);transition:opacity .2s,transform .35s}
  #demo-card{position:fixed;inset:0;z-index:100000;background:#000;color:#efe4cc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;transition:opacity .6s;font-family:'Space Grotesk',sans-serif}
  #demo-card .k{font:400 11px/1 'Chakra Petch',monospace;letter-spacing:.3em;text-transform:uppercase;opacity:.75}
  #demo-card h2{font-weight:400;font-size:28px;line-height:1.2;margin:0 32px;white-space:normal}
  #demo-card .r{width:120px;height:1px;background:#efe4cc;opacity:.6}`;
  document.head.appendChild(s);
  const d = document.createElement('div'); d.id = 'demo-ov';
  d.innerHTML = '<div id="demo-cap"><small></small><span></span></div><div id="demo-tap"></div>';
  document.body.appendChild(d);
};


async function cap(chapter, text) {
  if (chapter && !marks.some((m) => m.chapter === chapter)) marks.push({ chapter, at: (Date.now() - started) / 1000 });
  await p.evaluate(([c, t]) => {
    const el = document.getElementById('demo-cap');
    el.style.opacity = 0;
    setTimeout(() => { el.querySelector('small').textContent = c; el.querySelector('span').textContent = t; el.style.opacity = t ? 1 : 0; }, 300);
  }, [chapter, text]);
  await wait(400);
}
async function card(kicker, title, ms = 2600, stay = false) {
  await p.evaluate(([k, t]) => {
    let c = document.getElementById('demo-card');
    if (!c) { c = document.createElement('div'); c.id = 'demo-card'; document.body.appendChild(c); }
    c.innerHTML = `<div class="k">${k}</div><div class="r"></div><h2>${t}</h2>`;
    c.style.opacity = 1; c.style.display = 'flex';
  }, [kicker, title]);
  await wait(700);
  if (cdp) frames.push({ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 });
  await wait(ms - 700);
  if (stay) return;
  await p.evaluate(() => { const c = document.getElementById('demo-card'); c.style.opacity = 0; setTimeout(() => (c.style.display = 'none'), 600); });
  await wait(600);
}
async function tap(loc, pause = 500) {
  await loc.scrollIntoViewIfNeeded();
  const bx = await loc.boundingBox();
  await p.evaluate(([x, y]) => {
    const t = document.getElementById('demo-tap');
    t.style.transition = 'none'; t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.opacity = 1; t.style.transform = 'scale(.4)';
    requestAnimationFrame(() => { t.style.transition = 'opacity .5s .25s, transform .4s'; t.style.transform = 'scale(1)'; t.style.opacity = 0; });
  }, [bx.x + bx.width / 2, bx.y + bx.height / 2]);
  await wait(350);
  await loc.click();
  await wait(pause);
}
async function scrollBy(px) {
  const fr = p.frames().find((x) => x.url().includes('5173'));
  await fr.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), px);
  await wait(700);
}

const VALUES = { Waist: '76', 'Full hip': '102', 'Waist to hip': '20.5', 'Waist to knee': '58', 'Waist to floor': '104', 'Crotch depth': '27', 'Crotch length': '70', 'Full bust': '92', 'High bust': '86', Neck: '35', 'Shoulder width': '38', 'Back length': '41', 'Front length': '44', 'Bust depth': '26', 'Bust point to bust point': '18', 'Shoulder length': '12', 'Across back': '35', 'Across front': '32', Armhole: '40' };
async function fillPages(slowFirst) {
  let last = '';
  for (let n = 0; n < 40; n++) {
    const input = main.getByRole('textbox');
    for (let k = 0; k < 60; k++) { if ((await input.count()) === 1) { const l = await input.evaluate((el) => (el.labels?.[0]?.textContent ?? '').replace(/\(optional\)/i, '').trim()); if (l !== last) { last = l; break; } } await wait(100); }
    const v = VALUES[last] ?? '30';
    await wait(n < slowFirst ? 1700 : 500);
    await input.click();
    await input.pressSequentially(v, { delay: n < slowFirst ? 140 : 60 });
    await wait(n < slowFirst ? 700 : 250);
    const next = main.getByRole('button', { name: /^(Next|Done|Save)\b/ });
    const name = ((await next.textContent()) ?? '').trim();
    await tap(next, 300);
    if (!/^Next$/.test(name)) return;
  }
}

// 1. Opening
await p.goto(`${APP}/manifest.webmanifest`).catch(() => {});
await p.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&family=Chakra+Petch&display=swap"></head><body><iframe id="app" src="${APP}/?fresh"></iframe></body></html>`);
await p.evaluate(OVERLAY);
await startRec();
started = Date.now();
await p.evaluate(() => { const c = document.getElementById('demo-cap'); c.style.opacity = 0; });
f = p.frameLocator('#app');
main = f.getByRole('main');
await wait(300);
await card('Maison Tracé', 'How it works', 2800);
await wait(4500); // the loading animation draws the bodice into the form
await f.locator('body').press('Escape').catch(() => {});
await wait(1200);
await cap('Welcome', 'Sewing patterns drafted to your measurements, not a size chart.');
await wait(3200);
await cap('Welcome', 'Three steps: measure, style, print. Tap Begin.');
await wait(2400);
await tap(main.getByRole('button', { name: 'Begin' }), 2000);

// 2. Measure
await cap('01 · Measure', 'Measuring yourself, or someone else? Skip on the tape tries an example.');
await wait(3200);
await tap(main.getByRole('button', { name: 'Me', exact: true }), 600);
await cap('01 · Measure', 'One measurement per page, each with a short how-to.');
await fillPages(2);
await cap('01 · Measure', 'Check them over before you carry on.');
await wait(2600);
await tap(main.getByRole('button', { name: 'Choose what to make' }), 800);
await cap('02 · Choose', 'Skirts, trousers, bodices, dresses, tees, jackets and coats.');
await wait(2500);
await scrollBy(300); await wait(800); await scrollBy(-300);
const skirt = main.getByRole('radiogroup', { name: 'What would you like to make?' }).getByRole('radio', { name: /^Skirt\b/ });
await tap(skirt, 700);
await tap(main.getByRole('button', { name: /^(Continue measuring|Start measurements)$/ }), 600);
await cap('01 · Measure', 'Each garment asks only for the few extra measurements it needs.');
await fillPages(1);

// 3. Style
await cap('02 · Style', 'Style it. Every choice redraws the pattern to your body.');
await wait(2800);
const chip = async (g, c) => tap(main.getByRole('group', { name: g, exact: true }).getByRole('button', { name: c, exact: true }), 1300);
await chip('Silhouette', 'A-line');
await chip('Length', 'Midi');
await cap('02 · Style', 'Add pockets, change the waist, set the fit.');
await chip('Pockets', 'In-seam');
await scrollBy(500); await wait(1500); await scrollBy(400); await wait(1500);

// 4. Print
const printBtn = main.getByRole('button', { name: 'Print my pattern' });
await cap('03 · Print', 'When it looks right, print it.');
await tap(printBtn, 1200);
await cap('03 · Print', 'Home printer on A4 or Letter, or full size at a print shop.');
await wait(1200);
await tap(main.getByRole('group', { name: 'Paper' }).getByRole('button', { name: 'A4', exact: true }), 1200);
const dl = main.getByRole('button', { name: /^Download PDF/ });
await dl.waitFor({ timeout: 45000 });
await dl.scrollIntoViewIfNeeded();
await cap('03 · Print', 'Download the PDF: tiled pages, cutting layout and sewing steps.');
await wait(3500);
await scrollBy(600); await wait(1800);
await cap('', '');
await card('Maison Tracé', 'Measure. Style. Print.<br>Made to measure.', 3500, true);
await wait(300);
await cdp.send('Page.stopScreencast');
frames.sort((a, b) => a.t - b.t);
const endT = Date.now() / 1000;
let list = 'ffconcat version 1.0\n';
frames.forEach((fr, i) => {
  const name = `frames/${String(i).padStart(5, '0')}.jpg`;
  writeFileSync(`${WORK}/${name}`, Buffer.from(fr.data, 'base64'));
  const d = (i + 1 < frames.length ? frames[i + 1].t : endT) - fr.t;
  list += `file '${name}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n`;
});
list += `file 'frames/${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
writeFileSync(`${WORK}/list.txt`, list);
await ctx.close();
await b.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-movflags', '+faststart', join(OUT, 'walkthrough.mp4')], { cwd: WORK, stdio: 'inherit' });
// A WebM copy for browsers without H.264, such as Chromium builds without the licensed codecs.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(OUT, 'walkthrough.mp4'), '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-an', join(OUT, 'walkthrough.webm')], { stdio: 'inherit' });
rmSync(WORK, { recursive: true, force: true });
const length = endT - frames[0].t;
console.log(`${OUT}/walkthrough.mp4: ${Math.round(length)} s (${Math.floor(length / 60)}:${String(Math.round(length % 60)).padStart(2, '0')})`);
// Frames start when the screencast does, a moment before `started`.
const lead = started / 1000 - frames[0].t;
for (const m of marks) console.log(`${m.chapter} starts at ${(m.at + lead).toFixed(1)} s`);
