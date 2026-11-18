// Records the How it works film's shots from the running app (npx vite --port 5173 first): each moment as its own
// full-screen clip, with no captions, into [out dir]/<shot>.mp4. scripts/edit-tour.mjs cuts them into the film.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
// The tape Begin pulls across the first measuring page is the film's alone (Cat, Nov 14; src/ui/filmTape.ts).
await ctx.addInitScript(() => { window.__filmTape = true; });
const p = await ctx.newPage();
const main = p.getByRole('main');
const wait = (ms) => p.waitForTimeout(ms);

// The photo the film starts from (a dress on a hanger), read as the app would read it. The reading is stubbed, so
// nothing is sent anywhere and the film doesn't use up the tester allowance (as record-demos.mjs does for its clip).
// Cat's own python silk dress (Nov 17: the film's dress is drawn from it), and a close photo of its cloth, which goes in
// as the fabric through the app's own Your photo, so the print on the form is hers.
const PHOTO_FILE = resolve('scripts/tour/photo-python-dress.jpg');
const FABRIC_FILE = resolve('scripts/tour/fabric-python.jpg');
const PHOTO_READING = {
  garment: 'dress', worn: false, details: '',
  pieces: [{ garment: 'dress', x: 0.5, y: 0.5 }],
  silhouette: { value: 'straight', confidence: 'high' },
  length: { value: 'mini', confidence: 'medium' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.6, hemFullness: 1.05, flareAt: null, confidence: 'medium' },
  extras: { volume: 'none', asymHem: 'none', pockets: false, elasticWaist: false, slit: 'none' },
  top: { fit: { value: 'regular', confidence: 'medium' }, neckline: 'crew', sleeve: 'long', sleeveShape: 'straight', length: 'waist', seams: 'darts', opening: 'back', collar: 'none', sleeveCut: 'set_in', cuff: 'none', dressCut: 'shift', peplum: 'none', boned: false, knit: false, waistSeam: false, waistSeamAt: 'none', belt: 'none' },
  trousers: null, outer: null,
  fabric: { type: 'plain', colour: 'ivory', print: 'animal', sheer: false },
  missing: [], unsure: null,
};
await ctx.route('**/.netlify/functions/analyze-photo', async (route) => {
  await new Promise((r) => setTimeout(r, 2200));
  await route.fulfill({ json: { ok: true, reading: PHOTO_READING, changes: [] } });
});
// photo and shop: the two moments the film used to draw itself (a framed photo, a strip of swatch cards), filmed from
// the app's own screens instead (Cat, Nov 14: "all literal matches"). Taken last, from Style, so nothing after them
// changes. shop: the Fabric step's partner-shop list for the silk already picked, gliding down through its swatches.
// photo: Start from a photo in the title's drop-down, the photo going in, and the app's reading of it.
async function extras() {
  const toStyle = p.getByRole('navigation').getByRole('link', { name: /^Style/ }).or(p.getByRole('button', { name: /^Style$/ })).first();
  if (await toStyle.count()) await toStyle.click();
  await main.getByRole('heading', { level: 1, name: /^Style your/ }).waitFor({ timeout: 20000 });
  // The line over each takes the top of the screen, so the app's header is left out under it, as for the collection.
  await p.addStyleTag({ content: 'main .testing-tag, .topbar { display: none !important; } main { padding-top: ' + (WIDE ? 110 : 96) + 'px !important; }' });
  await wait(1200);
  // On a computer the Fabric step is a tab; on a phone, Next through the questions to it, as the style shot does.
  if (WIDE) await main.getByRole('tab', { name: /Fabric/ }).first().click();
  else {
    const n = () => main.locator('button.primary', { hasText: /^Next/ }).first();
    // Back from Print, Style can open on its last step (Review): step back until the Fabric list or a Next shows.
    for (let i = 0; i < 6 && !(await main.locator('.shopfab-tile.photo').filter({ visible: true }).count()) && !(await n().isVisible().catch(() => false)); i++) {
      const back = main.locator('button.step-back-arrow').filter({ visible: true }).first();
      if (!(await back.count())) break;
      await back.click();
      await wait(500);
    }
    for (let i = 0; i < 16 && !(await main.locator('.shopfab-tile.photo').filter({ visible: true }).count()) && !/Fabric/.test(await n().textContent().catch(() => '')); i++) { await n().click(); await wait(250); }
    if (!(await main.locator('.shopfab-tile.photo').filter({ visible: true }).count()) && /Fabric/.test(await n().textContent().catch(() => ''))) await n().click();
  }
  await main.locator('.shopfab-tile.photo').filter({ visible: true }).first().waitFor({ timeout: 30000 });
  await wait(2500);
  const listTop = await main.locator('.shopwrap').evaluate((el) => Math.max(0, el.getBoundingClientRect().top + scrollY - 90));
  await p.evaluate((y) => window.scrollTo(0, y), listTop);
  await wait(800);
  await start();
  await wait(1200);
  await glide(listTop + (WIDE ? 200 : 240), 5200);
  await wait(900);
  await stop('shop');
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(800);
  await main.getByRole('group', { name: 'Garment' }).locator('.drop-button').click();
  await main.getByRole('menuitemradio', { name: /Start from a photo/ }).click();
  await wait(1200);
  await start();
  await wait(1000);
  await main.locator('input[type=file]').first().setInputFiles(PHOTO_FILE);
  await main.locator('.photohead h1').waitFor({ timeout: 20000 });
  await wait(4200);
  await stop('photo');
}

let cdp, frames;
// While held, no frames are kept: the last one stays on screen until the change is drawn.
let hold = false;
// While cut, no frames are kept and the time is taken out of the shot, so the change jumps in without a pause.
let cutAt = null, skipped = 0;
const cut = (on) => { if (on) cutAt = Date.now() / 1000; else { skipped += Date.now() / 1000 - cutAt; cutAt = null; } };
async function start() {
  // A still screen sends no frames, so start with one. (Taken before the screencast starts: a screenshot during it
  // stalls it on the wide screen.)
  skipped = 0;
  frames = [{ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 }];
  cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', (e) => {
    if (!hold && cutAt === null) frames.push({ data: e.data, t: e.metadata.timestamp - skipped });
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
  frames.push({ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 - skipped });
  const endT = Date.now() / 1000 - skipped;
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
// A shot taken frame by frame on the page's own clock (Cat, 2026-10-28: "the all round jumps and skips"): the real
// body takes longer to draw than a frame lasts in the recorder's browser, so filmed live the turn only moved every
// half second or so. Here the page's time stands still between frames: each frame the clock moves on 1/30 s, the
// page draws it, and it is captured, so the film turns smoothly at the speed a maker sees.
async function stepped(name, ms, kick) {
  await p.evaluate(() => {
    const real = { raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window), now: performance.now.bind(performance) };
    let vt = real.now();
    let q = new Map();
    let id = 1e6;
    window.requestAnimationFrame = (cb) => { q.set(++id, cb); return id; };
    window.cancelAnimationFrame = (i) => { q.delete(i); };
    performance.now = () => vt;
    window.__step = (dt) => { vt += dt; const run = [...q.values()]; q = new Map(); for (const cb of run) cb(vt); };
    window.__unstep = () => {
      Object.assign(window, { requestAnimationFrame: real.raf, cancelAnimationFrame: real.caf });
      performance.now = real.now;
      for (const cb of q.values()) real.raf(cb);
      q = new Map();
    };
  });
  const done = kick ? kick() : Promise.resolve();
  const session = await ctx.newCDPSession(p);
  const work = mkdtempSync(join(tmpdir(), 'shot-'));
  const n = Math.round((ms / 1000) * 30);
  for (let i = 0; i < n; i++) {
    await p.evaluate(() => window.__step(1000 / 30));
    const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    writeFileSync(join(work, `${String(i).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
  }
  await session.detach();
  await p.evaluate(() => window.__unstep());
  await done;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', '%05d.jpg', '-vf', `scale=${FW}:${FH},format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', join(OUT, `${name}.mp4`)], { cwd: work });
  rmSync(work, { recursive: true, force: true });
  console.log(`${name}: ${(n / 30).toFixed(1)} s (stepped)`);
}
// A slimmer, taller sample figure, so the clothes read long and lean on the form (Cat, 2026-10-23).
const VALUES = { Height: '176', Weight: '', Waist: '62', 'Full hip': '90', 'Waist to hip': '21', 'Waist to knee': '62', 'Waist to floor': '112', 'Crotch depth': '27', 'Crotch length': '68', 'Full bust': '82', 'High bust': '78', Neck: '33', 'Shoulder width': '37', 'Back length': '43', 'Front length': '45', 'Bust depth': '25', 'Bust point to bust point': '17', 'Shoulder length': '12', 'Across back': '34', 'Across front': '31', Armhole: '38', 'Upper arm': '25', Wrist: '15', 'Arm length': '61' };
// A black veil faded over the screen (below top px, so the tape across the top stays), so a change that would jump
// (a page going blank, the cut to just the form) passes through black instead (Cat, 2026-11-07: "no jarring jumps").
const dip = (o, top = 0) => p.evaluate(([o, top]) => {
  let d = document.getElementById('dip');
  if (!d) {
    d = document.createElement('div');
    d.id = 'dip';
    Object.assign(d.style, { position: 'fixed', left: 0, right: 0, bottom: 0, background: '#000000', zIndex: 99997, pointerEvents: 'none', opacity: 0, transition: 'opacity .35s' });
    document.body.appendChild(d);
    void d.offsetWidth; // laid out at 0 first, so the change to 1 fades
  }
  d.style.top = `${top}px`;
  d.style.setProperty('visibility', 'visible', 'important');
  d.style.opacity = String(o);
}, [o, top]);
async function fillAll() {
  let last = '';
  const checked = main.getByRole('heading', { name: 'Do these look right?' });
  const styled = main.getByRole('heading', { level: 1, name: /^Style your/ });
  const startStyling = main.getByRole('button', { name: /^Start styling/ });
  for (let n = 0; n < 40; n++) {
    const input = main.getByRole('textbox');
    for (let k = 0; k < 80; k++) {
      if ((await styled.count()) || (await startStyling.count())) return;
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
// The first visit to Style opens on How styling works (Nov 14); the film passes it off camera with Start styling.
async function intoStyle() {
  const startStyling = main.getByRole('button', { name: /^Start styling/ });
  const styled = main.getByRole('heading', { level: 1, name: /^Style your/ });
  for (let i = 0; i < 100 && !(await styled.count()); i++) {
    if (await startStyling.count()) await startStyling.click();
    await wait(200);
  }
  await styled.first().waitFor();
}
/** A slow, eased scroll, smoother than the browser's own. */
const glide = (to, ms) => p.evaluate(([to, ms]) => new Promise((done) => {
  const from = scrollY; const t0 = performance.now();
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const step = (now) => { const x = Math.min(1, (now - t0) / ms); scrollTo(0, from + (to - from) * ease(x)); x < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
}), [to, ms]);

// TOUR_EXTRAS=<saved design json> records just photo and shop, from a design saved by SAVE_DESIGN, and stops.
if (process.env.TOUR_EXTRAS) {
  const saved = JSON.parse(readFileSync(process.env.TOUR_EXTRAS, 'utf8'));
  await ctx.addInitScript((saved) => { if (!sessionStorage.getItem('rec-loaded')) { sessionStorage.setItem('rec-loaded', '1'); for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v); } }, saved);
  await p.goto(APP);
  await wait(4000);
  const carry = p.getByRole('button', { name: /^Carry on with your/ });
  if (await carry.count()) await carry.first().click();
  await wait(1500);
  await extras();
  await b.close();
  process.exit(0);
}
// welcome: the film's opening (Cat, 2026-10-30: "this smooth zoom in version"). The welcome page as it stands, then
// its words and button fade as the camera pushes in on the form and it starts to turn, slowly. The page is taken
// twice (whole, and without the form), then each frame is drawn on one canvas the film's size: the form painted
// fresh at the push's scale, so its lines stay fine, and the page's words over it, fading as they grow.
// TOUR_WELCOME=1 records only this take (welcome.mp4) and stops; edit-tour's W intro cuts the opening from it.
if (process.env.TOUR_WELCOME) {
  const wp = await (await b.newContext({ ...(WIDE ? { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 } : { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }), reducedMotion: 'reduce' })).newPage();
  await wp.addInitScript(() => { try { localStorage.setItem('maison-trace-access', 'tester'); } catch {} });
  await wp.goto(APP);
  await wp.waitForTimeout(6000);
  const rect = await wp.evaluate(() => { const c = document.querySelector('canvas.contour'); const r = c.getBoundingClientRect(); c.style.visibility = 'hidden'; return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  // On a phone the form is drawn as an iPhone's welcome draws it (its canvas 366 x 481.5 on a 390 x 844 screen), taller
  // than this 432 x 768 page's, so the film's form is as big as the one on the page the viewer tapped play on, and the
  // app's pull in grows into it rather than shrinking (Cat, 2026-11-07: a jump on play). TourPlayer FILM_RECT follows.
  if (!WIDE) rect.h = rect.w * (481.5 / 366);
  await wp.waitForTimeout(300);
  const words = (await wp.screenshot()).toString('base64');
  await wp.evaluate(async ([words, rect, FW, FH]) => {
    // Loaded by the dev server inside the page, not by Node: held in a variable so the dead-code check doesn't try to
    // resolve it from here.
    const opening = '/src/ui/filmOpening.ts';
    const op = await import(opening);
    const img = new Image();
    img.src = `data:image/png;base64,${words}`;
    await img.decode();
    document.body.innerHTML = '';
    document.body.style.background = '#000000';
    const c = document.createElement('canvas');
    c.width = FW; c.height = FH;
    Object.assign(c.style, { position: 'fixed', left: 0, top: 0, width: `${innerWidth}px`, height: `${innerHeight}px` });
    document.body.appendChild(c);
    const g = c.getContext('2d');
    const k = FW / innerWidth;
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const cx0 = rect.x + rect.w / 2, cy0 = rect.y + rect.h / 2;
    // O1 Gentle Glide (Cat, 2026-11-08): the form moves from the first frame, the push and the turn as one move
    // (filmOpening.ts, which the app also draws from until the film is ready), the page's words fading as it goes,
    // as fast as the page's own (.welcome.pulling).
    window.__welcomeFrame = (t) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000000';
      g.fillRect(0, 0, FW, FH);
      g.setTransform(k, 0, 0, k, 0, 0);
      op.paintOpening(g, rect, innerWidth, innerHeight, t);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const { p, z } = op.openingAt(t);
      const cx = cx0 + (innerWidth / 2 - cx0) * p, cy = cy0 + (innerHeight / 2 - cy0) * p;
      // The words fade as fast as the page's own (filmOpening.ts OPENING.wordsS, 0.4 s; no longer exported).
      const ua = 1 - ease(t / 0.4);
      if (ua > 0) {
        g.globalAlpha = ua;
        g.globalCompositeOperation = 'screen';
        g.drawImage(img, k * (cx - z * cx0), k * (cy - z * cy0), FW * z, FH * z);
      }
      return c.toDataURL('image/jpeg', 0.94);
    };
  }, [words, rect, FW, FH]);
  const work = mkdtempSync(join(tmpdir(), 'shot-'));
  const n = 9 * 30;
  for (let i = 0; i < n; i++) {
    const data = await wp.evaluate((t) => window.__welcomeFrame(t), i / 30);
    writeFileSync(join(work, `${String(i).padStart(5, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', '%05d.jpg', '-vf', `scale=${FW}:${FH},format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', join(OUT, 'welcome.mp4')], { cwd: work });
  rmSync(work, { recursive: true, force: true });
  console.log('welcome: 9.0 s (drawn)');
  process.exit(0);
}

// form: the opening drawing, then the welcome's form and its tape tip
await p.goto(`${APP}/?fresh`);
await start();
await wait(9500);
await stop('form');

// tape: chapter 1 as a story, not one idle page (Cat, Nov 16: "the whole measure section was just rough cut"). Begin
// goes straight to the waist (no first page since Nov 15). The welcome dips to black off camera, Begin is pressed
// under it, and the take opens as the waist page comes up, its tape coming round the waist. Then each of the five is
// typed in with the pen dot pressing Next, the form taking the body's shape page by page, to "Do these look right?".
// The app's header is left out, as on the Choose and Style shots. Each page's time is kept in tape-marks.json.
const tapeMarks = {};
let noTop, onlyNumber;
{
  // The app's header is hidden for this take only: the film opens on the page, not the app's chrome (Cat, Nov 16), and
  // the page is set down, as on the Choose shot, to leave the film's line of words room above the form.
  noTop = await p.addStyleTag({ content: '.topbar { display: none !important; } main { padding-top: ' + (WIDE ? 110 : 96) + 'px !important; }' });
  // Just the form and the number going in under it (Cat, Nov 18: show the numbers being entered): the page's other
  // words and buttons are left out, so the number sits right under the tape for the film's close-up.
  onlyNumber = await p.addStyleTag({ content: '.measure-step .who-line, .measure-step .step-words > .eyebrow, .measure-step .step-words h1, .measure-step .step-words h2, .measure-step .step-tip, .measure-step .friend-nudge, .measure-step .how-row, .measure-step .later, .measure-step .measure-entry .step-next, .measure-step .estimate-link, .measure-step .msg { visibility: hidden !important; } .measure-step .who-line, .measure-step .step-words > .eyebrow, .measure-step .step-tip, .measure-step .friend-nudge, .measure-step .how-row { display: none !important; }' });
  await addPen();
  await dip(1, 30);
  await wait(450);
  await start();
  const tt0 = Date.now();
  const tmark = (what) => {
    tapeMarks[what] = Number(((Date.now() - tt0) / 1000).toFixed(2));
    writeFileSync(join(OUT, 'tape-marks.json'), JSON.stringify(tapeMarks));
  };
  await wait(300);
  await main.getByRole('button', { name: 'Begin' }).click();
  await main.getByRole('heading', { name: /Your waist/i, includeHidden: true }).waitFor({ state: 'attached' });
  await wait(250);
  await dip(0, 30);
  tmark('waist');
  await wait(3000);
  for (let n = 0; n < 6; n++) {
    const input = main.getByRole('textbox');
    if (!(await input.count())) break;
    const label = (await input.evaluate((el) => el.labels?.[0]?.textContent ?? '')).replace(/\(optional\)/i, '').trim();
    const v = VALUES[label];
    // Weight is optional and the example body has none: the pen skips it, as most people will.
    if (!v) {
      tmark(`skip-${n}`);
      // By its words: hidden from the film, it is out of the accessibility tree.
      await press(main.locator('button', { hasText: 'Skip this step' }).first(), 300);
      await wait(1500);
      break;
    }
    tmark(`type-${n}`);
    await input.pressSequentially(v, { delay: 170 });
    // The first number is held in the take itself, so the film shows it in without a slowed or cut-in hold (Cat,
    // Nov 18: a jarring skip as it was typed in).
    await wait(n === 0 ? 1900 : 650);
    tmark(`next-${n}`);
    await press(main.locator('button.step-next').first(), 300);
    // The next page comes in and its tape plays round (or down) the body.
    await wait(2700);
    tmark(`page-${n + 1}`);
  }
  tmark('check');
  await main.getByRole('heading', { name: 'Do these look right?' }).waitFor({ timeout: 8000 }).catch(() => console.log('  no check page'));
  await wait(2600);
  tmark('end');
}
await stop('tape');
await noTop.evaluate((el) => el.remove());
await onlyNumber.evaluate((el) => el.remove());
// TOUR_TAPE_ONLY=1 records just the tape shot, to check the measuring pages without the rest.
if (process.env.TOUR_TAPE_ONLY) {
  await b.close();
  process.exit(0);
}
if (!(await main.getByRole('heading', { name: 'Do these look right?' }).count())) await fillAll();

// choose: what to make, and the dress picked
await main.getByRole('button', { name: 'Choose what to make' }).click();
await main.getByRole('heading', { name: 'What would you like to make?' }).waitFor();
// 'Pick a garment,' takes the top of the screen in the film, so the app's header is left out under it, the page set
// down the same as the collection after it (Cat, 2026-10-30).
// The line naming the garments still in testing is left out of the film too (Cat, 2026-11-07).
const captionRoom = 'main .testing-tag, main .testing-note, .topbar { display: none !important; } main { padding-top: ' + (WIDE ? 110 : 96) + 'px !important; }';
// The page's own question left out too, so the grid sits right under the film's line, and the buttons' outlines a
// little heavier to read on film (Cat, Nov 18: the page looked empty under the line).
const chooseOnly = await p.addStyleTag({ content: captionRoom + ' main #stitle, main .measure-step .eyebrow { display: none !important; } main .make-grid button { border-width: 2px !important; }' });
await wait(900);
await start();
await wait(900);
// The pen presses Dress early, so the choice is seen to land before the film moves on (the critic's review, Nov 16:
// Dress lit up only as the screen faded). press() clicks straight on the button: the form never stops moving.
await press(main.getByRole('group', { name: 'What would you like to make?' }).getByRole('button', { name: /^Dress\b/ }), 0);
await wait(2000);
await stop('choose');
// TOUR_CHOOSE_ONLY=1 records the tape and choose shots and stops, to take the garment pick again on its own.
if (process.env.TOUR_CHOOSE_ONLY) {
  await b.close();
  process.exit(0);
}
await chooseOnly.evaluate((el) => el.remove());
await wait(800);
await fillAll();
await intoStyle();
await wait(1500);

// list: every measurement the dress is drafted from, on the app's own Your measurements page, a slow glide down the
// list (Cat, Nov 18: show more measures than the first five). The page's header, name and title are left out under
// the film's line. Taken once the dress has all its numbers, then back to Style.
await p.locator('nav[aria-label="Steps"] button', { hasText: /^Measure$/i }).first().click();
await main.locator('.measure-list .check-list').waitFor({ timeout: 20000 });
const listOnly = await p.addStyleTag({ content: '.topbar, main .measure-list .garment-eyebrow, main .measure-list #mtitle, main .measure-list .msg { display: none !important; } main { padding-top: ' + (WIDE ? 110 : 96) + 'px !important; }' });
await p.evaluate(() => window.scrollTo(0, 0));
await wait(1200);
{
  const listEnd = await main.locator('.measure-list .check-list li').last().evaluate((el) => el.getBoundingClientRect().bottom + scrollY - innerHeight + 40);
  await start();
  await wait(1000);
  if (listEnd > 0) await glide(listEnd, WIDE ? 3500 : 5000);
  await wait(1200);
  await stop('list');
}
await listOnly.evaluate((el) => el.remove());
await p.evaluate(() => window.scrollTo(0, 0));
await p.locator('nav[aria-label="Steps"] button', { hasText: /^Style$/i }).first().click();
await main.getByRole('heading', { level: 1, name: /^Style your/ }).first().waitFor({ timeout: 20000 });
await wait(1500);

// collection: the Maison collection's looks, a slow scroll down through them from just under the drop alert, for
// "start from a look" (Cat, 2026-10-29: add it back, the film longer, nothing cut). Taken before the dress is styled.
await main.getByRole('group', { name: 'Garment' }).locator('.drop-button').click();
// The collection is its own line in the Style title's drop-down now (Cat, Nov 12).
await main.getByRole('menuitemradio', { name: /^The collection/ }).click();
await main.getByRole('heading', { level: 1, name: 'The collection' }).waitFor();
await wait(1500);
// From the top, so the season reads (Cat picked A, 2026-10-29), in one eased glide down to the last look. In the film
// the In testing tag and the drop alert are left out, so the season leads straight into the looks (her fixes 1 and 2).
// The caption takes the top of the screen, so the app's header is left out under it (Cat, 2026-10-30: the two overlapped).
const filmOnly = await p.addStyleTag({ content: captionRoom + ' main .drop-slot { display: none !important; }' });
await wait(300);
const lookTop = (el) => el.getBoundingClientRect().top + scrollY - 70;
const lastLook = await main.locator('li.house-look').last().evaluate(lookTop);
await p.evaluate(() => window.scrollTo(0, 0));
await wait(1000);
await start();
await wait(1400);
await glide(lastLook, WIDE ? 11000 : 14000);
await wait(1400);
await stop('collection');
await filmOnly.evaluate((el) => el.remove());
await main.getByRole('button', { name: 'Back to styling' }).click();
await main.getByRole('heading', { level: 1, name: 'Style your dress' }).waitFor();
await p.evaluate(() => window.scrollTo(0, 0));
await wait(1500);

// style: the dress styled with the tools (Cat, 2026-10-23, after a COS dress): the waist seam dropped, the drawing
// filled navy, a white stripe and then Prince of Wales, and to end the hem drawn longer and the neckline a soft boat
// neck straight on the dress in its fabric (D1 Draw on the Dress, 2026-10-24). A tap shows as the pen dot pressing
// the button; marks prints when each moment starts, for edit-tour.mjs.
async function tap(loc, ms) { await loc.evaluate((el) => el.click()); await p.evaluate(() => window.scrollTo(0, 0)); await wait(ms); }
function addPen() { return p.evaluate(() => {
  if (document.getElementById('pen')) return;
  const d = document.createElement('div');
  d.id = 'pen';
  Object.assign(d.style, { position: 'fixed', width: '8px', height: '8px', margin: '-4px 0 0 -4px', borderRadius: '50%', background: '#f2ece0', opacity: 0, zIndex: 99998, pointerEvents: 'none', transition: 'opacity .25s' });
  // Never shown now (Cat, Nov 18: the dot for a tap "isn't helping anything", take it out throughout); kept as the
  // place the takes time their taps from. TOUR_PEN=1 shows it again.
  if (!window.__tourPen) d.style.display = 'none';
  document.body.appendChild(d);
}); }
await addPen();
function pen(x, y, o) { return p.evaluate(([x, y, o]) => Object.assign(document.getElementById('pen').style, { left: x + 'px', top: y + 'px', opacity: o }), [x, y, o]); }
async function press(loc, ms) {
  const bx = await loc.boundingBox();
  if (!bx || bx.y < 0 || bx.y + bx.height > (WIDE ? 810 : 768)) return tap(loc, ms);
  // On a wide button the dot presses its blank right end, not its letters (Fable's review, Nov 15).
  await pen(bx.width > 160 ? bx.x + bx.width - 22 : bx.x + bx.width / 2, bx.y + bx.height / 2, 1);
  await wait(380);
  await loc.evaluate((el) => el.click());
  await wait(220);
  await p.evaluate(() => { document.getElementById('pen').style.opacity = 0; });
  await wait(ms);
}
// A line drawn with the pen dot, through points given as fractions of the form picture.
// ref: the picture's viewBox the points were measured on; a longer hem makes the picture taller, so the points are
// moved to stay on the same place on the form.
const viewBox = (loc) => loc.evaluate((svg) => { const v = svg.viewBox.baseVal; return [v.x, v.y, v.width, v.height]; });
const draw = async (loc, pts, pause, ref) => {
  // The picture's own drawing box, which an enlarged form centres inside a wider box.
  const box = await loc.boundingBox();
  const [vx, vy, vw, vh] = await viewBox(loc);
  const k = Math.min(box.width / vw, box.height / vh);
  const bx = { x: box.x + (box.width - vw * k) / 2, y: box.y + (box.height - vh * k) / 2, width: vw * k, height: vh * k };
  const on = ref ? ([x, y]) => [(ref[0] + x * ref[2] - vx) / vw, (ref[1] + y * ref[3] - vy) / vh] : (q) => q;
  const at = (q) => { const [x, y] = on(q); return [bx.x + x * bx.width, bx.y + y * bx.height]; };
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
// Each moment's time in the style take, printed and kept in marks.json for edit-tour.mjs (the times shift a little
// from take to take).
const marks = {};
const mark = (what) => {
  const at = Number(((Date.now() - t0) / 1000 - skipped).toFixed(1));
  marks[what.split(' ')[0]] = at;
  writeFileSync(join(OUT, 'marks.json'), JSON.stringify(marks));
  console.log(`  style ${what}: ${at} s`);
};
// The lines, as fractions of the form picture, drawn on the dress itself (Cat's D1 Draw on the Dress, 2026-10-24):
// the mini hem drawn longer, to the knee, then the side drawn out from the hip so the straight skirt flares (Cat,
// 2026-10-24: longer and flare, the neck and waist kept as in her photo).
const LINES = {
  photo: [[0.13, 0.639], [0.5, 0.652], [0.87, 0.639]],
  hem: WIDE ? [[0.104, 0.975], [0.5, 0.99], [0.896, 0.975]] : [[0.104, 0.99], [0.5, 1.0], [0.896, 0.99]],
  // From the knee down to mid-calf, on the A-line (Cat's H, Nov 15).
  hemDown: [[0.04, 0.925], [0.5, 0.935], [0.96, 0.925]],
  // Further down, to a true midi: at hemDown the skirt was 67.5 cm, just under the knee, and read as a knee shift
  // all round (Fable's review, Nov 15).
  hemMidi: [[0.03, 0.97], [0.5, 0.98], [0.97, 0.97]],
  side: WIDE ? [[0.13, 0.6], [0.11, 0.68], [-0.104, 0.975]] : [[0.143, 0.483], [0.102, 0.638], [-0.104, 0.99]],
};
// Off camera, the dress is made to match the photo the film has just shown, Cat's own check silk dress (Cat,
// 2026-10-24: show that starting from a photo works): a boat neck, short sleeves, a waist seam dropped low on the hip,
// a straight skirt, in a small camel check. The film opens on that dress, the fabric changes, and the drawing
// tool takes it from there. The skirt is set to the knee rather than the mini of the photo, so the flat drawing
// reads as a dress rather than a t-shirt (Cat, 2026-10-26).
const pick = async (name, group) => {
  const r = main.locator(group ? `fieldset[data-label="${group}"] button[aria-pressed]` : 'button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${name}(?![a-z])`) }).first();
  if (await r.count()) await r.evaluate((el) => el.click());
  await wait(250);
};
// The style steps by name. On a phone the step bars are gone (Cat's P1, 2026-10-31): the list opens from "Step 1 of
// 5" and shuts once a step is picked. The dress's skirt step is now Length & hem (J4).
const STEP_NAMES = { 'Skirt & length': 'Length & hem' };
const stepTab = (name) => main.getByRole('tablist', { name: 'Style choices', includeHidden: true }).getByRole('tab', { name: STEP_NAMES[name] ?? name, exact: true, includeHidden: true });
const openSteps = async (on) => {
  const opener = main.locator('button.chapter-step');
  if (!(await main.getByRole('tablist', { name: 'Style choices' }).isVisible()) && (await opener.isVisible())) await (on ? press(opener, 700) : opener.click());
};
const goStep = async (name) => { await openSteps(false); await stepTab(name).click(); };
// Sleeves need the arm measurements, which the dress didn't ask for: added off camera, straight into the saved
// measurements, and the page opened again.
await p.evaluate(() => {
  const k = 'pattern-maker:account';
  const a = JSON.parse(localStorage.getItem(k));
  for (const person of a.people ?? []) Object.assign(person.values, { arm_length: 61, upper_arm: 25, wrist: 15 });
  localStorage.setItem(k, JSON.stringify(a));
});
await p.reload();
await wait(2500);
const carryOn = p.getByRole('button', { name: /^Carry on with your/ });
if (await carryOn.count()) await carryOn.first().click();
await wait(1500);
await main.getByRole('heading', { level: 1, name: /^Style your/ }).waitFor({ timeout: 15000 });
await addPen();
await wait(800);
// The film's opening All round (Cat, 2026-10-27): the dress as the Style page first opens it, before any styling, in
// lines on the same body as the second All round, no fabric. TOUR_OPENER=1 records only that take (opener.mp4) and
// stops; edit-tour cuts its opening from it (OPENER=<dir>/opener.mp4).
if (process.env.TOUR_OPENER) {
  await p.evaluate(() => { window.__tourFilm = 'old'; });
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round' }).click();
  await wait(1500);
  const K = 1.45;
  await p.evaluate((K) => {
    const c = document.querySelector('.all-round-canvas');
    document.body.appendChild(c);
    const w = innerWidth * K, h = (innerHeight + 96) * K;
    Object.assign(c.style, { position: 'fixed', zIndex: 9999, background: '#000000', maxWidth: 'none', maxHeight: 'none', aspectRatio: 'auto', margin: 0, width: `${w}px`, height: `${h}px`, left: `${innerWidth / 2 - w / 2}px`, top: `${innerHeight / 2 - 0.47 * h}px`, transformOrigin: '50% 47%', transform: `scale(${1 / K})` });
  }, K);
  await wait(1200);
  await stepped('opener', 9500, () =>
  p.evaluate(([K, ms]) => new Promise((done) => {
      const c = document.querySelector('.all-round-canvas');
      const t0 = performance.now() + 400;
      const ease = (x) => x * x * (3 - 2 * x);
      const step = (now) => { const x = Math.max(0, Math.min(1, (now - t0) / ms)); const k = 1 + (K - 1) * ease(x); const fy = 0.47 - 0.06 * ((k - 1) / (K - 1)); c.style.transformOrigin = `50% ${fy * 100}%`; c.style.transform = `scale(${k / K})`; x < 1 ? requestAnimationFrame(step) : done(); };
      requestAnimationFrame(step);
    }), [K, 8500]));
  process.exit(0);
}
// The film's dress (Cat, 2026-11-08: start in calico, then build the dress; Nov 15 she picked H, an A-line midi with
// long sleeves, as the shift looked bad on the form; Nov 17 a python dress of her own is the film's dress): it opens
// in calico as a shift with long sleeves, the cut (a waist seam), darts and neckline (crew) are answered one question
// at a time on camera, then her own cloth drops in from her photo, and the hem is drawn down from the knee to mid-calf.
await p.evaluate(([H, LEN]) => {
  const k = 'pattern-maker:skirt';
  const saved = JSON.parse(localStorage.getItem(k) ?? '{}');
  saved.dress = {
    // Her dress's long sleeves and round neck on the A-line of Nov 15: drawn on the form, a shift of any fit read as
    // a coat (probes, Nov 17), as Cat found on Nov 15. TOUR_LOOK=shift keeps the fitted shift.
    garment: 'dress', fit: H ? 'regular' : 'fitted',
    bodice: { garment: 'bodice', fit: H ? 'regular' : 'fitted', neckline: H ? 'scoop' : 'crew', length: 'waist', darts: H ? 'bust' : 'bust_waist', bustDart: 'french', sleeve: 'long', sleeveShape: 'straight', closure: 'back_zip' },
    // The calico starts as the shift her photo reads as (on the fitted shift with her crew neck already, so no frame shows another neck), and the questions on camera answer Waist seam,
    // Bust and waist, Crew (her dress's round neck). TOUR_LEN sets the fitted shift's length.
    skirt: H ? { fit: 'regular', silhouette: 'a_line', length: 'knee', flareCm: 6, noSeam: 'shift' } : { fit: 'fitted', silhouette: 'straight', length: LEN },
  };
  if (saved.finish) { delete saved.finish.fabric; delete saved.finish.cloth; }
  localStorage.setItem(k, JSON.stringify(saved));
}, [process.env.TOUR_LOOK !== 'shift', process.env.TOUR_LEN ?? 'mini']);
await p.reload();
await wait(1500);
{
  const again = p.getByRole('button', { name: /^Carry on with your/ });
  if (await again.count()) await again.first().click();
}
await main.getByRole('heading', { level: 1, name: /^Style your/ }).waitFor();
await addPen();
// The film leaves off In testing tags on the Style page and drawing tool, as it does on projector mode (Cat, 2026-10-29).
// and without the hem's drag handle, its length name and the hint to drag it: the film lengthens the hem by drawing, and the name read as
// app text under the dress (Cat, Nov 17).
// The collection link above the drawing is hidden too (Cat, Nov 18: clutter in the film); its room is kept.
await p.addStyleTag({ content: 'main .testing-tag, main svg .handle, main .length-hint { display: none !important; } main .collection-go { visibility: hidden !important; }' });
await p.evaluate(() => window.scrollTo(0, 0));
await wait(1500);
const choose = (sel, name) => p.evaluate(([sel, name]) => [...document.querySelectorAll(sel)].find((el) => el.getAttribute('aria-label') === name || el.textContent.trim().startsWith(name))?.click(), [sel, name]);
// A visible answer chip by name (the question showing now), pressed with the pen dot.
const chip = (name) => main.locator(WIDE ? 'button' : 'button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${name}(?![a-z])`) }).filter({ visible: true }).first();
const next = () => main.locator('button.primary', { hasText: /^Next/ }).first();
const PHONE_QS = !WIDE && (await next().count()) > 0;
const H = process.env.TOUR_LOOK !== 'shift';
const JADE = process.env.TOUR_CLOTH === 'jade'; // the jade python print of Nov 15, in place of her own cloth
const [CUT, DARTS, NECK] = H ? ['Waist seam', 'Bust and waist', 'Crew'] : ['Shift', 'Bust only', 'Crew'];
await start();
t0 = Date.now();
await wait(1600);
mark('calico');
const QUICK = !WIDE && process.env.TOUR_QUICK !== '0'; // A computer keeps the enlarge: there the drawing tool is small without it.
if (PHONE_QS) {
  // One question at a time (Cat's B + K, live Nov 8): Cut, then the darts, then the neckline.
  await press(next(), 700);
  await press(chip(CUT), 1300);
  // Waist height is held a full 2 s, long enough to read (Fable's review, Nov 15).
  const asked = () => main.locator('main h2, h2').filter({ visible: true }).allTextContents().then((t) => t.join('|'));
  for (let i = 0; i < 3 && !/Darts/.test(await asked()); i++) { await press(next(), 600); if (/Waist height/.test(await asked())) await wait(1400); }
  await press(chip(DARTS), 1200);
  await press(next(), 700);
  await press(chip(NECK), 1500);
  mark('questions done');
  // On to the fabric through a short dip to black: the questions between (collar, back, sleeves, skirt) stay as
  // they are, and stepping through them would only be app text.
  await dip(1); await wait(450);
  cut(true);
  for (let i = 0; i < 14 && !/Fabric/.test(await next().textContent().catch(() => '')) ; i++) { await next().click(); await wait(250); }
  if (/Fabric/.test(await next().textContent().catch(() => ''))) { await next().click(); await wait(600); }
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(600);
  cut(false);
  await dip(0); await wait(500);
} else {
  // On a computer each step is a list of rows (release W): a row opens its choices in place, and a choice closes it.
  // Shape: the cut, then the darts; Next on to Neck & sleeves for the neckline; then the Fabric step.
  const row = (name) => main.locator('button').filter({ hasText: new RegExp(`^\\s*${name}`) }).filter({ visible: true }).first();
  await wait(600);
  await press(row('Cut'), 700);
  await press(chip(CUT), 1300);
  await press(row('Darts'), 700);
  await press(chip(DARTS), 1200);
  await press(main.locator('button', { hasText: /^\s*Next/ }).filter({ visible: true }).first(), 900);
  await press(row('Neckline'), 700);
  await press(chip(NECK), 1500);
  mark('questions done');
  await press(main.getByRole('tab', { name: /Fabric/ }).first(), 900);
}
// Then the cloth: silk, then her own python from her photo (TOUR_CLOTH=jade: the jade print, one way), as one change.
// The calico dress is held a beat first, then each choice is pressed with the pen dot, so the cloth is seen being
// chosen and the dress seen changing (Fable's review, Nov 15).
mark('cloth');
await wait(900);
const swatch = (label, name) => p.evaluateHandle(([label, name]) => [...document.querySelectorAll(`[role=radiogroup][aria-label="${label}"] [role=radio], [role=radiogroup][aria-label="${label}"] button[aria-pressed]`)].find((el) => (el.getAttribute('aria-label') || el.textContent.trim()).startsWith(name)), [label, name]).then((h) => h.asElement());
for (const [label, name, ms] of [['Fabric for the sketch', 'Silk', 900], ...(JADE ? [["What's printed on your fabric", 'One-way', 2600]] : [])]) {
  const el = await swatch(label, name);
  if (el) await press(el, ms);
  else console.log(`  no ${name} in ${label}`);
}
// Her own cloth, through Your photo: the pen presses the tile, and the photo goes in as if picked from the phone.
if (!JADE) {
  const yours = main.getByRole('button', { name: /^Your photo/ }).filter({ visible: true }).first();
  // No tile (the Fabric step changed): say so and carry on in silk, as the swatches above do, not stop the take.
  if (!(await yours.count())) console.log('  no Your photo tile');
  else {
    const yb = await yours.boundingBox();
    if (yb) { await pen(yb.x + yb.width / 2, yb.y + yb.height / 2, 1); await wait(380); }
    await yours.locator('xpath=following-sibling::input[@type="file"]').first().setInputFiles(FABRIC_FILE);
    await wait(220);
    await p.evaluate(() => { document.getElementById('pen').style.opacity = 0; });
    await main.getByRole('button', { name: 'Your photo: take or pick another' }).first().waitFor({ timeout: 15000 }).catch(() => console.log('  fabric photo not taken'));
    await wait(2400);
  }
}
console.log('  dress', await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('pattern-maker:skirt')); return JSON.stringify({ dress: d.dress, fabric: d.finish?.fabric }); }));
if (process.env.TOUR_PROBE_STYLE) {
  await p.screenshot({ path: `${OUT}/probe-style.png` });
  console.log('LS', await p.evaluate(() => localStorage.getItem('pattern-maker:skirt')));
  process.exit(0);
}
// No drawing on the form (Cat, Nov 18: the draw tool came out as a hem tool and wasn't compelling): the style take
// ends on the dress in her cloth, and the pattern tools follow in their own take. TOUR_DRAW=1 draws the hem as before.
const DRAW = process.env.TOUR_DRAW === '1';
const DRAW_FOCUS = DRAW && process.env.TOUR_DRAW_FOCUS !== '0';
// By class, so it is still found with the rest of the screen hidden (out of the accessibility tree).
const form = p.locator('main svg.form-svg').first();
if (DRAW) {
  // Enlarged, the preview fills the screen with its tools (Cat, 2026-10-24: use the tools while it's enlarged), and
  // drawing on the form from there opens the drawing tool enlarged too, the place where room matters most.
  mark('enlarge');
  if (!QUICK) await press(main.getByRole('button', { name: /^Enlarge the drawing/ }), 1300);
  mark('draw');
  const kinds = main.getByRole('group', { name: 'What you are drawing' });
  // The drawing tool takes the dress from as short as the photo's, so the hem drawn to the knee is seen to lengthen it
  // (Cat, 2026-10-26: the hem edit should go from a mini, as in the photo, to longer, not start where the dress already
  // is). The dress is at the knee until then, so the flat drawing reads as a dress; from the tap on Draw on your form
  // until the tool is open on the shorter dress is cut out of the shot.
  const drawOn = main.getByRole('button', { name: 'Draw on your form' }).first();
  const db = await drawOn.boundingBox();
  await pen(db.x + db.width - 3, db.y + db.height - 3, 1); // the button's corner, not its letters (Fable, Nov 15)
  await wait(380);
  // Into just the form through a short dip to black, so the cut from the whole screen to the form isn't a jump.
  if (process.env.TOUR_DRAW_FOCUS !== '0') { await p.evaluate(() => { document.getElementById('pen').style.opacity = 0; }); await dip(1); await wait(450); }
  cut(true);
  await drawOn.evaluate((el) => el.click());
  await p.evaluate(() => { const d = document.getElementById('pen'); d.style.opacity = 0; d.style.visibility = 'hidden'; });
  await wait(900);
  const roomy = main.getByRole('button', { name: 'Enlarge', exact: true });
  if (!QUICK && (await roomy.count())) await tap(roomy, 900);
  await tap(kinds.getByRole('button', { name: 'Hem', exact: true }), 300);
  // The dress already opens at the photo's length (TOUR_START_MINI); drawn again only when it doesn't.
  if (process.env.TOUR_START_MINI === '0') await draw(form, LINES.photo, 600);
  await tap(kinds.getByRole('button', { name: 'Neckline', exact: true }), 600);
  // Just the form, as in the Draw Watch demo (Cat, 2026-11-07: "less cluttered"): the rest of the screen hidden, the
  // form drawn large in the middle of the frame, only the pen moving on it. TOUR_DRAW_FOCUS=0 shows the whole screen.
  if (DRAW_FOCUS) {
    await form.evaluate((svg) => {
      const st = document.createElement('style');
      st.id = 'draw-focus';
      st.textContent = 'body{background:#000000!important} body *{visibility:hidden!important} #pen,#dip,svg.form-svg,svg.form-svg *,defs,defs *,pattern,pattern *,mask,mask *,clipPath,clipPath *{visibility:visible!important} svg.form-svg .hem-ghost text,svg.form-svg text.hint{visibility:hidden!important}';
      document.head.appendChild(st);
      const h = innerHeight * (innerHeight > innerWidth ? 0.8 : 0.86);
      const b = svg.getBoundingClientRect();
      const w = (b.width / b.height) * h;
      Object.assign(svg.style, { position: 'fixed', zIndex: 9990, left: `${innerWidth / 2 - w / 2}px`, top: `${innerHeight / 2 - h / 2 + (innerHeight > innerWidth ? 34 : 0)}px`, width: `${w}px`, height: `${h}px`, maxWidth: 'none', maxHeight: 'none' });
    });
    await wait(600);
  }
  const pickKind = (name, ms) => (DRAW_FOCUS ? p.locator('main .form-kinds button', { hasText: new RegExp(`^${name}$`) }).first().dispatchEvent('click').then(() => wait(ms)) : tap(kinds.getByRole('button', { name, exact: true }), ms));
  await p.evaluate(() => { document.getElementById('pen').style.visibility = ''; });
  cut(false);
  if (DRAW_FOCUS) { await dip(0); await wait(450); }
  await wait(1100);
  const before = await viewBox(form);
  if (process.env.TOUR_PROBE2) {
    const bb = await form.boundingBox();
    console.log('FORM', JSON.stringify(bb), JSON.stringify(before));
    await p.screenshot({ path: `${OUT}/probe2.png` });
    process.exit(0);
  }
  // The hem drawn down from the knee to mid-calf (Cat's H, Nov 15), to 74 cm (hemMidi); TOUR_HEM=hemDown draws the
  // shorter 67.5 cm; the fitted shift (TOUR_LOOK=shift) draws its mini down to the knee.
  // The side stays straight. TOUR_FLARE=1 draws the side out as the earlier films did.
  mark('hem');
  await pickKind('Hem', 500);
  if (process.env.TOUR_PROBE3) await p.screenshot({ path: `${OUT}/probe3b.png` });
  await draw(form, process.env.TOUR_FLARE ? LINES.hem : LINES[process.env.TOUR_HEM ?? (H ? 'hemMidi' : 'hem')], process.env.TOUR_FLARE ? 3000 : 3600);
  if (process.env.TOUR_PROBE3) { await p.screenshot({ path: `${OUT}/probe3a.png` }); console.log('HEM', JSON.stringify(before), JSON.stringify(await viewBox(form)), JSON.stringify(await form.boundingBox())); }
  if (process.env.TOUR_FLARE) {
    mark('side');
    await pickKind('Side', 500);
    await draw(form, LINES.side, 1800, before);
  } else mark('side');
  if (process.env.TOUR_PROBE3) {
    await p.screenshot({ path: `${OUT}/probe3.png` });
    process.exit(0);
  }
} else {
  for (const m of ['enlarge', 'draw', 'hem', 'side']) mark(m);
  await wait(1800);
}
// TOUR_STATE=<file> saves the dress as drawn (the saved design after the hem is drawn) and stops, so All round can
// be checked on the exact garment the film shows.
if (process.env.TOUR_STATE) {
  writeFileSync(process.env.TOUR_STATE, await p.evaluate(() => localStorage.getItem('pattern-maker:skirt')));
  process.exit(0);
}
// Done lands on the pattern sheet, and the film stays there (Cat, 2026-10-24: no flash back to the dress).
mark('done');
if (DRAW_FOCUS) await form.evaluate((svg) => { document.getElementById('draw-focus')?.remove(); svg.removeAttribute('style'); });
if (!DRAW) await wait(200);
else if (WIDE) {
  // On a computer Done now leaves the page scrolled to the summary: back up to the pattern straight away.
  await press(main.getByRole('button', { name: 'Done', exact: true }), 0);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(1200);
} else await press(main.getByRole('button', { name: 'Done', exact: true }), 1200);
await stop('style');

// pattern: the pattern tools on her pieces (Cat, Nov 18: "show a tool work on the actual pattern pieces instead, like
// dragging darts and cutting pieces off"; "or design straight from your pattern"). Move points is opened off camera
// and the pieces alone are shown large on the app's chalk, nothing else on screen: the bust dart is drawn from its
// point up to the shoulder and moved there, then a line across the back cuts a yoke off as a new piece. The choices
// the app asks are pressed off screen (the line's own answer shows on the pieces). Each moment's time is kept in
// pattern-marks.json for edit-tour.mjs. TOUR_DRAW=1 keeps the old shot of the pattern view.
// The words an edited piece carries ("EDITED BY YOU · IN TESTING") are drawn as text inside the pieces, so no class
// can hide them: each such text is hidden as it appears, here and on the print and projector takes after.
await p.addStyleTag({ content: '[data-tour-hide] { display: none !important; }' });
await p.evaluate((words) => {
  const hide = () => document.querySelectorAll('text').forEach((t) => { if (t.textContent?.trim() === words) t.setAttribute('data-tour-hide', ''); });
  hide();
  new MutationObserver(hide).observe(document.body, { childList: true, subtree: true, characterData: true });
}, 'EDITED BY YOU · IN TESTING');
const patternView = main.getByRole('group', { name: 'Preview view' }).getByRole('button', { name: /^Pattern/ });
if (DRAW) {
  await start();
  await wait(500);
  await tap(patternView, 0);
  await main.getByRole('button', { name: 'Move points' }).waitFor({ timeout: 20000 });
  await wait(3000);
  await stop('pattern');
} else {
  await tap(patternView, 0);
  await main.getByRole('button', { name: 'Move points' }).waitFor({ timeout: 20000 });
  await tap(main.getByRole('button', { name: 'Move points' }), 1200);
  await p.locator('main svg.point-svg').waitFor({ timeout: 20000 });
  // The paper behind the pieces, as the app draws it.
  const paper = await p.locator('main svg.point-svg').evaluate((el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'transparent' && !c.endsWith(', 0)')) return c; } return '#ddd5c6'; });
  const focusPieces = () => p.evaluate(([paper, wide]) => {
    const svg = document.querySelector('main svg.point-svg');
    let st = document.getElementById('pieces-focus');
    if (!st) {
      st = document.createElement('style');
      st.id = 'pieces-focus';
      st.textContent = 'body{background:#000000!important} body *{visibility:hidden!important} svg.point-svg,svg.point-svg *{visibility:visible!important} main *:has(svg.point-svg){clip-path:none!important}';
      document.head.appendChild(st);
    }
    // Under the film's line at the top: the paper fills the rest of a phone, and a tall panel in the middle of a computer.
    const [x0, y0, x1, y1] = wide ? [0.31, 0.17, 0.69, 0.95] : [0.04, 0.19, 0.96, 0.96];
    // The picture fills the panel, the pieces centred in it on the paper (the picture's own background).
    // Set over the app's own sizes for the pinned drawing. No padding: the app finds where a finger is on the pieces
    // from the picture's own box.
    const set = { position: 'fixed', 'z-index': '9990', left: `${x0 * innerWidth}px`, top: `${y0 * innerHeight}px`, width: `${(x1 - x0) * innerWidth}px`, height: `${(y1 - y0) * innerHeight}px`, 'max-width': 'none', 'max-height': 'none', 'min-height': '0', 'aspect-ratio': 'auto', margin: '0', padding: '0', transform: 'none', overflow: 'hidden', background: paper };
    for (const [k, v] of Object.entries(set)) svg.style.setProperty(k, v, 'important');
  }, [paper, WIDE]);
  await focusPieces();
  await wait(900);
  const pm = {};
  const pt0 = Date.now();
  const pmark = (what) => { pm[what] = Number(((Date.now() - pt0) / 1000).toFixed(2)); writeFileSync(join(OUT, 'pattern-marks.json'), JSON.stringify(pm)); };
  const box = (name) => p.locator(`path.pe-piece[data-piece="${name}"]`).boundingBox();
  const line = async (a, z, steps = 26) => {
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    for (let k = 1; k <= steps; k++) { const t = k / steps; const e = t * t * (3 - 2 * t); await p.mouse.move(a.x + (z.x - a.x) * e, a.y + (z.y - a.y) * e); await wait(30); }
    await p.mouse.up();
  };
  const hidden = (loc, ms) => loc.evaluate((el) => el.click()).then(() => wait(ms));
  await start();
  await wait(1600);
  // The bust dart, from its point up to the middle of the shoulder: the dart moves there, as a cutter pivots it.
  const dartAt = await p.locator('circle.pe-point.dart').first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, piece: el.dataset.piece }; });
  const fb = await box(dartAt.piece);
  pmark('dart');
  // The middle of the shoulder: between the piece's two highest points (the neck and the shoulder's tip), just inside.
  const top2 = (await p.locator(`circle.pe-point[data-piece="${dartAt.piece}"]`).evaluateAll((es) => es.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }))).sort((a, c) => a.y - c.y).slice(0, 2);
  await line(dartAt, { x: (top2[0].x + top2[1].x) / 2, y: (top2[0].y + top2[1].y) / 2 + 3 });
  // By their words: hidden, they are out of the accessibility tree.
  const toDart = p.locator('.pe-sheet button', { hasText: 'Move the dart here' });
  if (await toDart.count()) await hidden(toDart, 400);
  const moved = p.locator('.pe-sheet[aria-label="Dart moved"]');
  if (await moved.count()) { pmark('dart moved'); await hidden(moved.locator('.pe-done'), 300); } else console.log('  the dart did not move');
  await focusPieces();
  await wait(2200);
  // A yoke across the back, a fifth of the way down, cut off as a new piece.
  const back = (await p.locator('path.pe-piece').evaluateAll((es) => es.map((e) => e.dataset.piece))).find((n) => /back/i.test(n));
  const bb = await box(back);
  pmark('cut');
  await line({ x: bb.x + 2, y: bb.y + bb.height * 0.2 }, { x: bb.x + bb.width - 2, y: bb.y + bb.height * 0.2 });
  const newPiece = p.locator('.pe-sheet button', { hasText: 'Make a new piece' });
  if (await newPiece.count()) { await hidden(newPiece, 500); pmark('new piece'); await hidden(p.locator('.pe-done').first(), 300); } else console.log('  no new piece');
  await focusPieces();
  await wait(2800);
  pmark('end');
  await stop('pattern');
  await p.evaluate(() => { document.getElementById('pieces-focus')?.remove(); document.querySelector('main svg.point-svg')?.removeAttribute('style'); });
  await tap(main.getByRole('button', { name: 'Done moving points' }), 1200);
}
// The pattern's own drawing, kept for the film's Print climax, where edit-tour.mjs draws it line by line from her
// numbers (the critic's review, Nov 16: show the pattern being drafted from her body).
writeFileSync(join(OUT, 'draft.svg'), await main.locator('svg.preview-svg').first().evaluate((el) => el.outerHTML));
if (process.env.TOUR_PROBE) process.exit(0);
await tap(main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: /^Front/ }).first(), 800);

// round: turning all round on the form, filling the screen and drawing closer as it turns (Cat, 2026-10-22: start
// close, then in and in, cinematic). The canvas is lifted out at its closest size, so it is drawn sharp, and shown
// smaller by a scale that grows; resizing it as it goes would blank it between redraws.
// (After the pattern: from All round, Pattern doesn't redraw in time.)
// On black (Cat, Nov 15: keep All round on a black background): the film's switch draws it in the app's dark tone.
await p.evaluate((look) => { window.__tourFilm = look === 'old' ? 'old' : true; window.__tourFilmDark = true; }, process.env.TOUR_LOOK);
await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round' }).click();
await wait(800);
// The garment is sewn from its pattern pieces a few seconds after All round opens: shot once it's drawn.
await p.waitForFunction(() => document.querySelector('.all-round-canvas')?.dataset.sewn !== 'pending', null, { timeout: 60000 });
await wait(600);
const CLOSEST = 1.45;
await p.evaluate((K) => {
  const c = document.querySelector('.all-round-canvas');
  document.body.appendChild(c);
  const w = innerWidth * K, h = (innerHeight + 96) * K;
  // On black, the whole screen black round it; the legs fade out at the canvas's foot rather than stopping on a line
  // (Cat, Nov 14: close-ups like All round may leave things out).
  const fade = 'linear-gradient(to bottom, #000 0, #000 93%, transparent 100%)';
  Object.assign(c.style, { position: 'fixed', zIndex: 9999, background: '#000000', maxWidth: 'none', maxHeight: 'none', aspectRatio: 'auto', margin: 0, width: `${w}px`, height: `${h}px`, left: `${innerWidth / 2 - w / 2}px`, maskImage: fade, webkitMaskImage: fade });
}, CLOSEST);
const zoomTo = (from, to, ms, delay = 0) => p.evaluate(([from, to, ms, K, delay]) => new Promise((done) => {
  const c = document.querySelector('.all-round-canvas');
  const h = (innerHeight + 96) * K;
  // Where to keep still as it grows, as a fraction of the canvas: the bodice, rising a little towards the bust.
  // Whole dress (Cat's C, 2026-11-07: smaller and in full view): below 1 it stays whole, held at the same point, and on
  // a phone lifted a little so the three lines sit in the black under the hem.
  const whole = to <= 1;
  const set = (k) => {
    const u = (k - from) / (to - from || 1);
    const fy = whole ? 0.47 : 0.47 - 0.06 * u;
    const lift = whole && innerHeight > innerWidth ? 30 + 20 * u : 0;
    Object.assign(c.style, { top: `${innerHeight / 2 - fy * h - lift}px`, transformOrigin: `50% ${fy * 100}%`, transform: `scale(${k / K})` });
  };
  const t0 = performance.now() + delay;
  const ease = (x) => x * x * (3 - 2 * x);
  const step = (now) => { const x = Math.max(0, Math.min(1, (now - t0) / (ms || 1))); set(from + (to - from) * ease(x)); x < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
}), [from, to, ms, CLOSEST, delay]);
// Black behind the canvas, so the page doesn't show round a dress drawn smaller than the screen.
await p.evaluate(() => { const d = document.createElement('div'); d.id = 'round-ground'; Object.assign(d.style, { position: 'fixed', inset: 0, background: '#000000', zIndex: 9998 }); document.body.appendChild(d); });
// On a computer the screen is short, so the whole dress can be drawn larger than on a phone and still fit.
// Cat picked Z2 (2026-11-08): on a phone the dress held at 0.95 throughout, leaving room for the words.
// Held at 0.6 on a phone, the whole dress above the words.
const [ROUND_FROM, ROUND_TO] = process.env.ROUND_Z ? process.env.ROUND_Z.split(',').map(Number) : WIDE ? [0.66, 0.85] : [0.6, 0.6];
await zoomTo(ROUND_FROM, ROUND_FROM, 0);
await wait(600);
if (process.env.SAVE_DESIGN) {
  const all = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  (await import('node:fs')).writeFileSync(process.env.SAVE_DESIGN, JSON.stringify(all, null, 2));
  process.exit(0);
}
if (process.env.TOUR_ROUND_STILLS) {
  // Stills of the All round at a few sizes, to try a smaller, whole-figure framing (Cat, 2026-11-07).
  for (const k of process.env.TOUR_ROUND_STILLS.split(',').map(Number)) {
    await zoomTo(k, k, 0);
    await wait(1500);
    for (let i = 0; i < 40; i++) { await wait(350); await p.screenshot({ path: `${OUT}/rs-${k}-${String(i).padStart(2, '0')}.png` }); }
  }
  process.exit(0);
}
if (process.env.TOUR_PROBE5) {
  // Stills of the All round moment as the film frames it: its first frame and its closest.
  await p.screenshot({ path: `${OUT}/probe5-start.png` });
  await zoomTo(1.45, 1.45, 0);
  await wait(600);
  await p.screenshot({ path: `${OUT}/probe5-end.png` });
  process.exit(0);
}
// Still a moment, then in and in as it turns, frame by frame (see stepped).
const RLEN = Number(process.env.ROUND_MS ?? 12000);
// The turn (Cat picked S2, 2026-11-08: "a more complete turn, but shouldn't look fast"): almost all the way round,
// ROUND_TURN degrees over the whole shot, from a standstill and settling softly, ending a few degrees off square to the
// front (straight on, a hair-thin line shows past each shoulder at full size), ready for "Seams meet.".
const ROUND_TURN = Number(process.env.ROUND_TURN ?? 320);
const turnAround = () => p.evaluate(([deg, ms, end]) => {
  const c = document.querySelector('.all-round-canvas');
  const t0 = performance.now();
  const from = end - (deg * Math.PI) / 180;
  const tick = () => {
    const x = Math.min(1, (performance.now() - t0) / ms);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * x);
    c.dispatchEvent(new CustomEvent('allround-turn', { detail: { at: from + (end - from) * e, probe: false } }));
    if (x < 1) requestAnimationFrame(tick);
  };
  tick();
}, [ROUND_TURN, RLEN, Number(process.env.ROUND_END ?? 0.1)]);
await stepped('round', RLEN, () => Promise.all([zoomTo(ROUND_FROM, ROUND_TO, RLEN - 1000, 400), ROUND_TURN ? turnAround() : null]));
if (process.env.ROUND_ONLY) process.exit(0);
// Put the canvas back where it was.
await p.evaluate(() => {
  const c = document.querySelector('.all-round-canvas');
  document.querySelector('.all-round')?.prepend(c);
  document.getElementById('round-ground')?.remove();
  c.removeAttribute('style');
});
await wait(600);

// print: the print page, A4, and the tiled pages
// On a computer the summary and Print sit beside the drawing; there's no Review page.
// review: on a phone, the Review page scrolled down to Print my pattern and the tap (Cat, 2026-10-29: add back the
// scroll down to print); on a computer the tap on Print my pattern beside the drawing.
if (!WIDE) {
  // Review left the bar for a quiet link at the end of each step (Cat's P1, 2026-10-31).
  // One question at a time (release W): Next through the questions, off camera, until Review shows.
  const review = main.locator('button.step-review').or(main.getByRole('button', { name: /^Review/ })).filter({ visible: true });
  for (let i = 0; i < 24 && !(await review.count()); i++) { await main.locator('button.primary', { hasText: /^Next/ }).first().evaluate((el) => el.click()); await wait(250); }
  await review.first().evaluate((el) => el.click());
  await wait(1200);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(600);
}
const printMine = main.getByRole('button', { name: 'Print my pattern' });
await start();
await wait(1200);
if (!WIDE) {
  await glide(await printMine.evaluate((el) => Math.max(0, el.getBoundingClientRect().bottom + scrollY - innerHeight + 140)), 2600);
  await wait(700);
}
await press(printMine, 1000);
await stop('review');
await wait(1200);
// The paper is a drop-down now (Cat, 2026-10-24); A4 is picked from it when it isn't already.
const paper = main.getByRole('group', { name: 'Paper' }).locator('.drop-button');
if ((await paper.count()) && !/A4/.test(await paper.innerText())) {
  await paper.click();
  await main.getByRole('menuitemradio', { name: /^A4/ }).first().click();
}
await main.getByRole('button', { name: /^(Download PDF|Download pattern)/ }).waitFor({ timeout: 45000 });
// On a phone the sheet of pages is folded away (Cat, 2026-10-24); it is opened off camera, so the film can glide to it.
const see = main.locator('button.see-pages');
if (!WIDE && (await see.count()) && (await see.getAttribute('aria-expanded')) !== 'true') await see.evaluate((el) => el.click());
await wait(800);
const sheetAt = !WIDE && (await see.count()) ? await see.evaluate((el) => el.getBoundingClientRect().bottom + scrollY - 100) : 1120;
await p.evaluate(() => window.scrollTo({ top: 0 }));
await wait(800);
await start();
await wait(1500);
await glide(Math.min(700, sheetAt / 2), 900);
await wait(1800);
await glide(sheetAt, 700);
await wait(3500);
await stop('print');
// On a phone the film fills the screen with the sheet and drifts across it (Cat picked P2, 2026-10-25); the screencast
// is too soft to blow up, so the sheet is also taken as one sharp picture, drawn seven times over, without its Watch
// demo button (a film inside the film). A computer's film drifts down the same sheet (Fable's review, Nov 15).
if (await main.locator('.preview.tiles').count()) {
  await main.locator('.preview.tiles').evaluate((el) => el.querySelectorAll('button').forEach((b) => (b.style.visibility = 'hidden')));
  const box = await main.locator('.preview.tiles').boundingBox();
  const y = await p.evaluate(() => scrollY);
  const s = await ctx.newCDPSession(p);
  const shot = await s.send('Page.captureScreenshot', { format: 'png', clip: { ...box, y: box.y + y, scale: 7 }, captureBeyondViewport: true });
  writeFileSync(join(OUT, 'print-sheet.png'), Buffer.from(shot.data, 'base64'));
}

// projector: Projector picked as the paper, then projector mode showing a piece at true size (Cat, 2026-10-29: show
// the projector feature). Lined up once off camera, so on camera it opens straight onto the piece.
const paperMenu = main.getByRole('group', { name: 'Paper' }).locator('.drop-button');
const pickPaper = async (name, pressIt) => {
  if (pressIt) await press(paperMenu, 700); else await paperMenu.click();
  const item = main.getByRole('menuitemradio', { name }).first();
  if (pressIt) await press(item, 900); else await item.click();
};
// The film shows projector mode without its In testing tag; the app keeps it until the projector test (Cat, 2026-10-29),
// and without its small heading and hint, which flashed under the words as the caption faded (Cat, 2026-10-30).
await p.addStyleTag({ content: '.projector-offer .testing-tag, .projector .testing-tag { display: none !important; } .projector .pj-top, .projector .pj-hint { visibility: hidden !important; }' });
await pickPaper(/^Projector/);
await main.getByRole('button', { name: 'Open projector mode' }).click();
await p.getByRole('button', { name: /^Next: check/ }).click();
await p.getByRole('button', { name: 'Yes: start projecting' }).click();
await wait(600);
await p.getByRole('dialog', { name: 'Projector mode' }).getByRole('button', { name: 'Close', exact: true }).click();
await wait(600);
await pickPaper(/^A4/);
await main.locator('.preview.tiles button').evaluateAll((bs) => bs.forEach((b) => (b.style.visibility = '')));
const paperAt = await paperMenu.evaluate((el) => Math.max(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.35));
await p.evaluate((y) => window.scrollTo(0, y), WIDE ? 0 : Math.max(0, paperAt - 500));
await wait(1000);
await start();
await wait(900);
if (!WIDE) await glide(paperAt, 1800);
await wait(500);
await pickPaper(/^Projector/, true);
const offer = main.locator('.projector-offer');
await glide(await offer.evaluate((el) => Math.max(0, el.getBoundingClientRect().bottom + scrollY - innerHeight + 40)), 2200);
await wait(1200);
await press(offer.getByRole('button', { name: 'Open projector mode' }), 0);
// On a phone the screen can still read as new while filming, and it opens on the line-up again: that is cut out.
const lineUpNext = p.getByRole('button', { name: /^Next: check/ });
if (await lineUpNext.isVisible()) {
  cut(true);
  await lineUpNext.click();
  await p.getByRole('button', { name: 'Yes: start projecting' }).click();
  await wait(700);
  cut(false);
}
// At true size the piece runs off the top of a phone: moved down off camera, so its top is in view (Cat, Nov 15:
// the top was cut off). PJ_DROP sets how far, in screen points.
if (!WIDE) {
  await wait(500);
  cut(true);
  const drop = Number(process.env.PJ_DROP ?? 170);
  const vp = p.viewportSize();
  const cx = vp.width * 0.35, cy = vp.height * 0.3;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(cx, cy + (drop * i) / 12);
  await p.mouse.up();
  await wait(500);
  cut(false);
}
await wait(WIDE ? 3600 : 4100);
await stop('projector');
await p.keyboard.press('Escape');
await wait(600);
await extras();

await b.close();
