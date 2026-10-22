// Records the tour's walkthrough video (public/tour/walkthrough.mp4, and a .webm copy) from the running app, with a caption
// under each step and the lofi track from scripts/tour-music.m4a. Re-record it when the app changes enough that the tour looks out of date, then update PARTS,
// TOUR_LENGTH and TOUR_LABEL in src/ui/TourPlayer.tsx from the times this prints.
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
// The waitlist front page only lets testers in; the recording browser is one.
await ctx.addInitScript(() => { try { localStorage.setItem('maison-trace-access', 'tester'); } catch {} });
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
  // The app's own fonts (Archivo, Chakra Petch, Space Grotesk), borrowed from the app in the iframe.
  for (const st of document.getElementById('app').contentDocument.querySelectorAll('style')) if (st.textContent.includes('@font-face')) document.head.appendChild(st.cloneNode(true));
  const s = document.createElement('style');
  s.textContent = `
  html,body{margin:0;background:#000;overflow:hidden}
  #app{position:fixed;left:0;top:0;width:432px;height:672px;border:0;border-bottom:1px solid rgba(239,228,204,.3)}
  #demo-cap{position:fixed;left:0;right:0;bottom:0;height:96px;box-sizing:border-box;z-index:99999;padding:16px 20px;background:#000;color:#efe4cc;font:400 15px/1.4 'Space Grotesk',sans-serif;letter-spacing:.01em;transition:opacity .35s;opacity:0;pointer-events:none}
  #demo-cap small{display:block;font:400 10px/1 'Chakra Petch',monospace;letter-spacing:.24em;text-transform:uppercase;color:#d9c49b;margin-bottom:7px}
  #demo-tap{position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #efe4cc;background:rgba(239,228,204,.25);pointer-events:none;opacity:0;transform:scale(.4);transition:opacity .2s,transform .35s}
  #demo-spot{position:fixed;z-index:99998;border:1px solid #d9c49b;border-radius:2px;box-shadow:0 0 0 9999px rgba(0,0,0,.62);pointer-events:none;opacity:0;transition:opacity .5s, left .5s, top .5s, width .5s, height .5s}
  #demo-card{position:fixed;inset:0;z-index:100000;background:#000;color:#efe4cc;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:0 40px;box-sizing:border-box;transition:opacity .7s;font-family:'Space Grotesk',sans-serif}
  #demo-card .k{font:400 10px/1 'Chakra Petch',monospace;letter-spacing:.32em;text-transform:uppercase;color:#d9c49b}
  #demo-card .r{width:0;height:1px;background:#d9c49b;margin:18px 0 22px;transition:width 1.1s cubic-bezier(.2,.7,.2,1) .15s}
  #demo-card h2{font-family:'Archivo Variable','Archivo',sans-serif;font-stretch:75%;font-weight:600;text-transform:uppercase;font-size:56px;line-height:.95;letter-spacing:.005em;margin:0;opacity:0;transform:translateY(14px);transition:opacity .8s .2s,transform .9s cubic-bezier(.2,.7,.2,1) .2s}
  #demo-card p{font-size:17px;line-height:1.5;font-weight:300;margin:22px 0 0;max-width:330px;opacity:0;transform:translateY(10px);transition:opacity .8s .55s,transform .9s cubic-bezier(.2,.7,.2,1) .55s}
  #demo-card .n{font:400 10px/1.6 'Chakra Petch',monospace;letter-spacing:.24em;text-transform:uppercase;opacity:0;margin-top:30px;transition:opacity .8s .9s;color:#efe4cc}
  #demo-card.on .r{width:120px}#demo-card.on h2,#demo-card.on p{opacity:1;transform:none}#demo-card.on .n{opacity:.6}
  #demo-card.mid{align-items:center;text-align:center}#demo-card.mid p{margin-left:auto;margin-right:auto}`;
  document.head.appendChild(s);
  const d = document.createElement('div'); d.id = 'demo-ov';
  d.innerHTML = '<div id="demo-cap"><small></small><span></span></div><div id="demo-tap"></div><div id="demo-spot"></div>';
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
/** A full-screen explanation page: a small label, a rule that draws in, a title, a line or two, and a note. */
async function card(kicker, title, body = '', note = '', ms = 4200, { stay = false, mid = false, chapter = '' } = {}) {
  if (chapter && !marks.some((m) => m.chapter === chapter)) marks.push({ chapter, at: (Date.now() - started) / 1000 });
  await p.evaluate(([k, t, b, n, m]) => {
    let c = document.getElementById('demo-card');
    if (!c) { c = document.createElement('div'); c.id = 'demo-card'; document.body.appendChild(c); }
    c.className = m ? 'mid' : '';
    c.innerHTML = `<div class="k">${k}</div><div class="r"></div><h2>${t}</h2>${b ? `<p>${b}</p>` : ''}${n ? `<div class="n">${n}</div>` : ''}`;
    c.style.display = 'flex'; c.style.opacity = 1;
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on')));
  }, [kicker, title, body, note, mid]);
  await wait(1800);
  if (cdp) frames.push({ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 });
  await wait(ms - 1800);
  if (stay) return;
  await p.evaluate(() => { const c = document.getElementById('demo-card'); c.style.opacity = 0; setTimeout(() => (c.style.display = 'none'), 700); });
  await wait(700);
}
/** Dims the screen around one thing and outlines it in champagne, while the caption explains it. */
async function spot(loc, ms = 2600, pad = 6) {
  await loc.scrollIntoViewIfNeeded();
  const bx = await loc.boundingBox();
  await p.evaluate(([x, y, w, h]) => { const s = document.getElementById('demo-spot'); Object.assign(s.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', opacity: 1 }); }, [bx.x - pad, bx.y - pad, bx.width + 2 * pad, bx.height + 2 * pad]);
  await wait(ms);
}
async function unspot() {
  await p.evaluate(() => { document.getElementById('demo-spot').style.opacity = 0; });
  await wait(500);
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
  // The app's iframe, not the page around it (which also loaded from the app's address first).
  const fr = p.frames().find((x) => x !== p.mainFrame() && x.url().startsWith(APP));
  await fr.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), px);
  await wait(700);
}

const VALUES = { Height: '165', Weight: '', Waist: '76', 'Full hip': '102', 'Waist to hip': '20.5', 'Waist to knee': '58', 'Waist to floor': '104', 'Crotch depth': '27', 'Crotch length': '70', 'Full bust': '92', 'High bust': '86', Neck: '35', 'Shoulder width': '38', 'Back length': '41', 'Front length': '44', 'Bust depth': '26', 'Bust point to bust point': '18', 'Shoulder length': '12', 'Across back': '35', 'Across front': '32', Armhole: '40' };
async function fillPages(slowFirst) {
  let last = '';
  for (let n = 0; n < 40; n++) {
    const input = main.getByRole('textbox');
    // The optional weight page's Next lands on the check page, which has no box.
    const checked = main.getByRole('heading', { name: 'Do these look right?' });
    for (let k = 0; k < 60; k++) { if (last && (await checked.count())) return; if ((await input.count()) === 1) { const l = await input.evaluate((el) => (el.labels?.[0]?.textContent ?? '').replace(/\(optional\)/i, '').trim()); if (l !== last) { last = l; break; } } await wait(100); }
    const v = VALUES[last] ?? '30';
    await wait(n < slowFirst ? 1700 : 500);
    await input.click();
    if (v) await input.pressSequentially(v, { delay: n < slowFirst ? 140 : 60 });
    await wait(n < slowFirst ? 700 : 250);
    const next = main.getByRole('button', { name: /^(Next|Done|Save)\b/ });
    const name = ((await next.textContent()) ?? '').trim();
    await tap(next, 300);
    if (!/^Next$/.test(name)) return;
  }
}

// 1. Opening
await p.goto(`${APP}/manifest.webmanifest`).catch(() => {});
await p.setContent(`<html><head><meta charset="utf-8"></head><body><iframe id="app" src="${APP}/?fresh"></iframe></body></html>`);
await p.frameLocator('#app').getByRole('main').waitFor();
await p.evaluate(OVERLAY);
await p.evaluate(() => document.fonts.ready);
await startRec();
started = Date.now();
f = p.frameLocator('#app');
main = f.getByRole('main');
await card('Maison Tracé', 'How it<br>works', 'A sewing pattern drafted to your own measurements, not a size chart.', 'Four steps · About two minutes', 4800);
await f.locator('body').press('Escape').catch(() => {});
await cap('Welcome', 'This is where you start. Your dress form, and one button.');
await wait(3000);
await spot(main.getByRole('button', { name: 'Begin' }), 2200);
await unspot();
await tap(main.getByRole('button', { name: 'Begin' }), 1800);

// 2. Measure
await card('Chapter 01 of 04', 'Measure', 'First, a few measurements. One per page, each with a drawing of where the tape goes.', 'A soft tape measure · About five minutes', 5200, { chapter: '01 · Measure' });
const form = main.getByRole('radiogroup', { name: 'Which form to draft on?' });
await cap('01 · Measure', 'Choose the form the pattern is drafted on.');
await spot(form, 2600);
await unspot();
await tap(form.getByRole('radio', { name: /^Womenswear/ }), 900);
await cap('01 · Measure', 'Then who you are measuring: you, or someone else.');
await spot(main.getByRole('radiogroup').filter({ hasText: 'For me' }), 2400);
await unspot();
await tap(main.getByRole('radio', { name: 'For me' }), 900);
await cap('01 · Measure', 'Just looking? Measure later lets you try an example body.');
await spot(main.getByRole('button', { name: 'Measure later' }), 2600);
await unspot();
await tap(main.getByRole('button', { name: 'Begin measuring', exact: true }), 900);
await cap('01 · Measure', 'We begin at the waist. Read the how-to, measure, type the number.');
await wait(1600);
await spot(main.getByRole('textbox'), 2200, 10);
await unspot();
await fillPages(2);
await cap('01 · Measure', 'Before you go on, check them over. Tap any number to change it.');
await wait(1200);
await spot(main.getByRole('list').first(), 3000);
await unspot();
await tap(main.getByRole('button', { name: 'Choose what to make' }), 900);

// 3. Choose
await card('Chapter 02 of 04', 'Choose', 'Pick what to make. Each garment asks only for the few extra measurements it needs.', 'Skirts · Trousers · Dresses · Tees · Jackets · Coats', 4800, { chapter: '02 · Choose' });
await cap('02 · Choose', 'Today, a skirt.');
await wait(1600);
const skirt = main.getByRole('radiogroup', { name: 'What would you like to make?' }).getByRole('radio', { name: /^Skirt\b/ });
await spot(skirt, 1600);
await unspot();
await tap(skirt, 700);
await tap(main.getByRole('button', { name: /^(Next: \d+ skirt measurements?|Style my skirt)$/ }), 600);
await cap('02 · Choose', 'A skirt needs just a few more, from the waist down.');
await fillPages(1);

// 4. Style
await card('Chapter 03 of 04', 'Style', 'Shape, length and details. Every choice redraws the pattern to your body.', 'Undo is always at the bottom', 4800, { chapter: '03 · Style' });
await cap('03 · Style', 'Your skirt, drawn to your measurements. The tabs underneath hold every choice.');
await wait(1800);
await spot(f.getByRole('tablist').first(), 2600);
await unspot();
const tab = async (t) => tap(f.getByRole('tab', { name: t, exact: true }), 900);
// Tapping the picked chip's drawing opens it full size, so only tap choices that aren't picked yet.
const chip = async (g, c) => {
  const b = main.getByRole('group', { name: g, exact: true }).getByRole('button', { name: c, exact: true });
  if (await b.evaluate((el) => el.classList.contains('on'))) throw new Error(`${g}: ${c} is already picked; choose another`);
  await tap(b, 1500);
};
await cap('03 · Style', 'Shape: tap a silhouette. Watch the sketch change.');
await tab('Shape');
await chip('Silhouette', 'Half circle');
await cap('03 · Style', 'Length and hem: from mini to maxi.');
await tab('Length & hem');
await chip('Length', 'Midi');
await cap('03 · Style', 'Details: pockets, pleats or an elastic waist.');
await tab('Details');
await chip('Pockets', 'In-seam');
await scrollBy(-2000);
await cap('03 · Style', 'Turn it all round, to see the back and sides.');
await tap(main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round' }), 3600);
await cap('03 · Style', 'Flip to Pattern to see the pieces you will cut.');
await tap(main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ }), 3000);
await tap(main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Garment/ }), 900);
await cap('03 · Style', 'Happy with it? Review shows the finished sizes beside yours.');
await tap(main.getByRole('button', { name: 'Review', exact: true }), 1400);
await wait(2400);

// 5. Print
await card('Chapter 04 of 04', 'Print', 'At home on A4 or Letter, or full size at a print shop.', 'Tiled pages · Cutting layout · Sewing steps', 4800, { chapter: '04 · Print' });
const printBtn = main.getByRole('button', { name: 'Print my pattern' });
await cap('04 · Print', 'Print my pattern.');
await tap(printBtn, 1200);
await cap('04 · Print', 'Choose your paper size.');
await wait(800);
await tap(main.getByRole('group', { name: 'Paper' }).getByRole('button', { name: 'A4', exact: true }), 1200);
const dl = main.getByRole('button', { name: /^Download PDF/ });
await dl.waitFor({ timeout: 45000 });
await cap('04 · Print', 'Download the PDF. Print at 100%, check the test square, tape the pages together.');
await spot(dl, 3200);
await unspot();
await scrollBy(600); await wait(2200);
await cap('', '');
await card('Maison Tracé', 'Measure.<br>Choose.<br>Style.<br>Print.', 'Made to measure. Tap Begin to start yours.', '', 4600, { stay: true, mid: true });
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
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', 'silent.mp4'], { cwd: WORK, stdio: 'inherit' });
// The lofi track (scripts/tour-music.py) under it, faded out over the last three seconds.
const MUSIC = resolve('scripts/tour-music.m4a');
const secs = endT - frames[0].t;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', 'silent.mp4', '-i', MUSIC, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `afade=t=out:st=${(secs - 3).toFixed(2)}:d=3`, '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', join(OUT, 'walkthrough.mp4')], { cwd: WORK, stdio: 'inherit' });
// A WebM copy for browsers without H.264, such as Chromium builds without the licensed codecs.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(OUT, 'walkthrough.mp4'), '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-c:a', 'libopus', '-b:a', '96k', join(OUT, 'walkthrough.webm')], { stdio: 'inherit' });
rmSync(WORK, { recursive: true, force: true });
const length = endT - frames[0].t;
console.log(`${OUT}/walkthrough.mp4: ${Math.round(length)} s (${Math.floor(length / 60)}:${String(Math.round(length % 60)).padStart(2, '0')})`);
// Frames start when the screencast does, a moment before `started`.
const lead = started / 1000 - frames[0].t;
for (const m of marks) console.log(`${m.chapter} starts at ${(m.at + lead).toFixed(1)} s`);
