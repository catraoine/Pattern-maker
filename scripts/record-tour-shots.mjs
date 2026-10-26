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
// TOUR_TAPE_ONLY=1 records just the tape shot, to check the measuring pages without the rest.
if (process.env.TOUR_TAPE_ONLY) {
  await b.close();
  process.exit(0);
}
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

// style: the dress styled with the tools (Cat, 2026-10-23, after a COS dress): the waist seam dropped, the drawing
// filled navy, a white stripe and then Prince of Wales, and to end the hem drawn longer and the neckline a soft boat
// neck straight on the dress in its fabric (D1 Draw on the Dress, 2026-10-24). A tap shows as the pen dot pressing
// the button; marks prints when each moment starts, for edit-tour.mjs.
const tap = async (loc, ms) => { await loc.evaluate((el) => el.click()); await p.evaluate(() => window.scrollTo(0, 0)); await wait(ms); };
const addPen = () => p.evaluate(() => {
  const d = document.createElement('div');
  d.id = 'pen';
  Object.assign(d.style, { position: 'fixed', width: '14px', height: '14px', margin: '-7px 0 0 -7px', borderRadius: '50%', background: '#d8c49c', opacity: 0, zIndex: 99998, pointerEvents: 'none', boxShadow: '0 0 0 6px rgba(216,196,156,.25)', transition: 'opacity .25s' });
  document.body.appendChild(d);
});
await addPen();
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
const mark = (what) => console.log(`  style ${what}: ${((Date.now() - t0) / 1000 - skipped).toFixed(1)} s`);
// The lines, as fractions of the form picture, drawn on the dress itself (Cat's D1 Draw on the Dress, 2026-10-24):
// the mini hem drawn longer, to the knee, then the side drawn out from the hip so the straight skirt flares (Cat,
// 2026-10-24: longer and flare, the neck and waist kept as in her photo).
const LINES = {
  photo: [[0.13, 0.639], [0.5, 0.652], [0.87, 0.639]],
  hem: [[0.104, 0.975], [0.5, 0.99], [0.896, 0.975]],
  side: [[0.143, 0.483], [0.102, 0.638], [-0.104, 0.975]],
};
// Off camera, the dress is made to match the photo the film has just shown, Cat's own check silk dress (Cat,
// 2026-10-24: show that starting from a photo works): a boat neck, short sleeves, a waist seam dropped low on the hip,
// a straight skirt, in a small camel check. The film opens on that dress, the fabric changes, and the drawing
// tool takes it from there. The skirt is set to the knee rather than the mini of the photo, so the flat drawing
// reads as a dress rather than a t-shirt (Cat, 2026-10-26).
const pick = async (name, group) => {
  const r = main.locator(group ? `fieldset[data-label="${group}"] button[aria-pressed]` : 'button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${name}\\b`) }).first();
  if (await r.count()) await r.evaluate((el) => el.click());
  await wait(250);
};
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
// TOUR_FIT and TOUR_SLEEVES try the dress another way (Fitted, Sleeveless) without touching the rest.
const FIT = process.env.TOUR_FIT ?? 'Relaxed';
const SLEEVES = process.env.TOUR_SLEEVES ?? 'Short';
for (const [tab, names] of [['Shape', [[FIT, 'Fit'], 'Dropped']], ['Neck & sleeves', ['Boat', SLEEVES]], ['Skirt & length', [['Straight', 'Skirt'], ['Inverted pleats', 'Skirt details']]]]) {
  await main.getByRole('tab', { name: tab, exact: true }).click();
  await wait(400);
  for (const n of names) await (Array.isArray(n) ? pick(...n) : pick(n));
}
// The sleeves to the photo's length, about 20 cm from the shoulder, on the sleeve slider.
await main.getByRole('tab', { name: 'Neck & sleeves', exact: true }).click();
await wait(300);
if (SLEEVES !== 'Sleeveless') await main.locator('input[type=range][aria-label="Sleeve length, in cm from the shoulder"]').first().evaluate((el) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '20');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(300);
await main.getByRole('tab', { name: 'Skirt & length', exact: true }).click();
await wait(300);
// The length is set from the marks beside the form.
await p.evaluate(() => [...document.querySelectorAll('main .hem-mark')].find((g) => g.textContent.trim() === 'KNEE')?.querySelector('.hit')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
await wait(400);
await main.getByRole('tab', { name: 'Fabric', exact: true }).click();
await wait(400);
const choose = (sel, name) => p.evaluate(([sel, name]) => [...document.querySelectorAll(sel)].find((el) => el.getAttribute('aria-label') === name || el.textContent.trim().startsWith(name))?.click(), [sel, name]);
await choose('[role=radiogroup][aria-label="Fabric for the sketch"] [role=radio]', 'Silk');
await wait(300);
await main.getByRole('radiogroup', { name: 'Colour' }).getByRole('radio', { name: process.env.TOUR_COLOUR ?? 'Camel', exact: true }).first().click();
await wait(300);
const about = main.locator('summary', { hasText: 'About your fabric' });
if (!(await about.evaluate((el) => el.parentElement.open))) await about.evaluate((el) => el.click());
await wait(300);
await choose('[role=radiogroup][aria-label="What\'s printed on your fabric"] [role=radio]', 'Checks');
await wait(300);
await choose('[role=radiogroup][aria-label="Checks or stripes"] [role=radio]', 'Gingham');
await wait(300);
// A gingham of about 2.25 cm squares, as in the photo.
const repeat = main.locator('#fabrepeat');
if (await repeat.count()) await repeat.fill(process.env.TOUR_REPEAT ?? '4.5');
await wait(300);
await main.getByRole('tab', { name: 'Shape', exact: true }).click();
await p.evaluate(() => window.scrollTo(0, 0));
await wait(1200);
if (process.env.TOUR_PROBE4) {
  await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round' }).click();
  await wait(2500);
  await p.screenshot({ path: `${OUT}/probe4.png` });
  // The same, framed as the film holds it at its closest.
  await p.evaluate((K) => {
    const c = document.querySelector('.all-round-canvas');
    document.body.appendChild(c);
    const w = innerWidth * K, h = (innerHeight + 96) * K;
    Object.assign(c.style, { position: 'fixed', zIndex: 9999, background: '#000', maxWidth: 'none', maxHeight: 'none', aspectRatio: 'auto', margin: 0, width: `${w}px`, height: `${h}px`, left: `${innerWidth / 2 - w / 2}px`, top: `${innerHeight / 2 - 0.34 * h}px` });
  }, 1.7);
  await wait(1200);
  await p.screenshot({ path: `${OUT}/probe4-close.png` });
  process.exit(0);
}
if (process.env.TOUR_PROBE) {
  await p.screenshot({ path: `${OUT}/probe.png` });
  console.log('LS', await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('pattern-maker:skirt')).finish)));
  for (const tab of ['Neck & sleeves', 'Skirt & length', 'Fabric']) {
    await main.getByRole('tab', { name: tab, exact: true }).click();
    await wait(400);
    console.log(tab, JSON.stringify(await main.locator('button[aria-pressed], [role=radio]').evaluateAll((els) => els.map((e) => `${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24)}${e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-checked') === 'true' ? '*' : ''}${e.disabled ? '(x)' : ''}`))));
  }
  process.exit(0);
}
await start();
t0 = Date.now();
await wait(2600);
mark('fabric');
await press(main.getByRole('tab', { name: 'Fabric', exact: true }), 900);
// Then the fabric changed to the one-way print, the jade python (Cat, 2026-10-25: no check at all; P2 Jade). Tapping
// the camel again clears the colour, so the print shows in its own.
const PRINT2 = process.env.TOUR_PRINT2 ?? 'One-way';
if (PRINT2) {
  const about2 = main.locator('summary', { hasText: 'About your fabric' });
  if (!(await about2.evaluate((el) => el.parentElement.open))) await about2.evaluate((el) => el.click());
  await wait(300);
  await choose('[role=radiogroup][aria-label="What\'s printed on your fabric"] [role=radio]', PRINT2);
  await wait(400);
}
if (process.env.TOUR_COLOUR2 !== 'none') await press(main.getByRole('radiogroup', { name: 'Colour' }).getByRole('radio', { name: process.env.TOUR_COLOUR2 ?? 'Camel', exact: true }).first(), 2200);
if (process.env.TOUR_PROBE_FABRIC) {
  await main.getByRole('tab', { name: 'Shape', exact: true }).click();
  await wait(1200);
  await p.screenshot({ path: `${OUT}/fabric-${process.env.TOUR_PRINT2 ?? ''}${process.env.TOUR_COLOUR2}.png` });
  process.exit(0);
}
// Enlarged, the preview fills the screen with its tools (Cat, 2026-10-24: use the tools while it's enlarged), and
// drawing on the form from there opens the drawing tool enlarged too, the place where room matters most.
mark('enlarge');
await press(main.getByRole('button', { name: /^Enlarge the drawing/ }), 1300);
mark('draw');
const form = main.getByRole('img', { name: /Your dress form from the/ });
const kinds = main.getByRole('group', { name: 'What you are drawing' });
// The drawing tool takes the dress from as short as the photo's, so the hem drawn to the knee is seen to lengthen it
// (Cat, 2026-10-26: the hem edit should go from a mini, as in the photo, to longer, not start where the dress already
// is). The dress is at the knee until then, so the flat drawing reads as a dress; from the tap on Draw on your form
// until the tool is open on the shorter dress is cut out of the shot.
const drawOn = main.getByRole('button', { name: 'Draw on your form' }).first();
const db = await drawOn.boundingBox();
await pen(db.x + db.width / 2, db.y + db.height / 2, 1);
await wait(380);
cut(true);
await drawOn.evaluate((el) => el.click());
await p.evaluate(() => { const d = document.getElementById('pen'); d.style.opacity = 0; d.style.visibility = 'hidden'; });
await wait(900);
const roomy = main.getByRole('button', { name: 'Enlarge', exact: true });
if (await roomy.count()) await tap(roomy, 900);
await tap(kinds.getByRole('button', { name: 'Hem', exact: true }), 300);
await draw(form, LINES.photo, 600);
await tap(kinds.getByRole('button', { name: 'Neckline', exact: true }), 600);
await p.evaluate(() => { document.getElementById('pen').style.visibility = ''; });
cut(false);
await wait(1100);
const before = await viewBox(form);
if (process.env.TOUR_PROBE2) {
  const bb = await form.boundingBox();
  console.log('FORM', JSON.stringify(bb), JSON.stringify(before));
  await p.screenshot({ path: `${OUT}/probe2.png` });
  process.exit(0);
}
// The hem first, then the side, drawn on the picture as it was measured, as it grows with the longer hem.
mark('hem');
await tap(kinds.getByRole('button', { name: 'Hem', exact: true }), 500);
await draw(form, LINES.hem, 3000);
if (process.env.TOUR_PROBE3) { await p.screenshot({ path: `${OUT}/probe3a.png` }); console.log('HEM', JSON.stringify(before), JSON.stringify(await viewBox(form)), JSON.stringify(await form.boundingBox())); }
mark('side');
await tap(kinds.getByRole('button', { name: 'Side', exact: true }), 500);
await draw(form, LINES.side, 1800, before);
if (process.env.TOUR_PROBE3) {
  await p.screenshot({ path: `${OUT}/probe3.png` });
  process.exit(0);
}
// Done lands on the pattern sheet, and the film stays there (Cat, 2026-10-24: no flash back to the dress).
mark('done');
await press(main.getByRole('button', { name: 'Done', exact: true }), 1200);
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
await p.evaluate((look) => { window.__tourFilm = look === 'old' ? 'old' : true; }, process.env.TOUR_LOOK);
await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round' }).click();
await wait(800);
const CLOSEST = 1.45;
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
    const fy = 0.47 - 0.06 * ((k - from) / (to - from || 1));
    Object.assign(c.style, { top: `${innerHeight / 2 - fy * h}px`, transformOrigin: `50% ${fy * 100}%`, transform: `scale(${k / K})` });
  };
  const t0 = performance.now();
  const ease = (x) => x * x * (3 - 2 * x);
  const step = (now) => { const x = Math.min(1, (now - t0) / (ms || 1)); set(from + (to - from) * ease(x)); x < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
}), [from, to, ms, CLOSEST]);
await zoomTo(1, 1, 0);
await wait(600);
if (process.env.TOUR_PROBE5) {
  // Stills of the All round moment as the film frames it: its first frame and its closest.
  await p.screenshot({ path: `${OUT}/probe5-start.png` });
  await zoomTo(1.45, 1.45, 0);
  await wait(600);
  await p.screenshot({ path: `${OUT}/probe5-end.png` });
  process.exit(0);
}
await start();
await wait(400);
await zoomTo(1, 1.45, 8500);
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
// The paper is a drop-down now (Cat, 2026-10-24); A4 is picked from it when it isn't already.
const paper = main.getByRole('group', { name: 'Paper' }).locator('.drop-button');
if ((await paper.count()) && !/A4/.test(await paper.innerText())) {
  await paper.click();
  await main.getByRole('menuitemradio', { name: /^A4/ }).first().click();
}
await main.getByRole('button', { name: /^Download PDF/ }).waitFor({ timeout: 45000 });
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
// demo button (a film inside the film).
if (!WIDE) {
  await main.locator('.preview.tiles').evaluate((el) => el.querySelectorAll('button').forEach((b) => (b.style.visibility = 'hidden')));
  const box = await main.locator('.preview.tiles').boundingBox();
  const y = await p.evaluate(() => scrollY);
  const s = await ctx.newCDPSession(p);
  const shot = await s.send('Page.captureScreenshot', { format: 'png', clip: { ...box, y: box.y + y, scale: 7 }, captureBeyondViewport: true });
  writeFileSync(join(OUT, 'print-sheet.png'), Buffer.from(shot.data, 'base64'));
}

await b.close();
