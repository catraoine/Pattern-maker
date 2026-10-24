// Cuts the How it works film from the shots scripts/record-tour-shots.mjs records, with its words set in the app's
// own type and the lofi track (scripts/tour-music.m4a) under it. Needs the app running (npx vite --port 5173) for
// the fonts, and ffmpeg. Usage: node scripts/edit-tour.mjs <shots dir> [out.mp4] [--wide]
// --wide cuts the computer's film from the shots record-tour-shots.mjs --wide records (Cat, 2026-10-22).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const WIDE = process.argv.includes('--wide');
const [shotsArg, outArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SHOTS = resolve(shotsArg ?? (WIDE ? 'tour-shots-wide' : 'tour-shots'));
const OUT = resolve(outArg ?? (WIDE ? 'public/tour/walkthrough-wide.mp4' : 'public/tour/walkthrough.mp4'));
const APP = 'http://127.0.0.1:5173';
const MUSIC = resolve('scripts/tour-music.m4a');
const [W, H] = WIDE ? [1920, 1080] : [1080, 1920];
const FPS = 30;
// The words are laid out at the size the app's screens were recorded at, then drawn at the film's size.
const [VW, VH] = WIDE ? [1440, 810] : [432, 768];
const work = mkdtempSync(join(tmpdir(), 'edit-'));

// Words: each a transparent picture the film's size, drawn by the browser in the app's fonts.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {});
const page = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: W / VW })).newPage();
await page.goto(APP);
await page.waitForTimeout(1500);
const CSS = `
  html,body{margin:0;background:transparent!important;width:${VW}px;height:${VH}px;overflow:hidden}
  .f{position:fixed;inset:0;color:#efe4cc;font-family:'Space Grotesk',sans-serif}
  .k{font:400 10px/1 'Chakra Petch',monospace;letter-spacing:.34em;text-transform:uppercase;color:#d9c49b}
  .r{width:96px;height:1px;background:#d9c49b;margin:18px 0}
  .t{font-family:'Archivo Variable',sans-serif;font-stretch:75%;font-weight:600;text-transform:uppercase;line-height:.9;letter-spacing:.005em;margin:0}
  .l{font-weight:300;font-size:17px;line-height:1.45;margin:0}
  .mid{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .mid .r{margin:20px auto}`;
let n = 0;
async function words(html, { solid = false } = {}) {
  const file = join(work, `w${n++}.png`);
  await page.evaluate(([css, h, s]) => {
    document.head.querySelectorAll('style[data-edit]').forEach((x) => x.remove());
    const st = document.createElement('style'); st.dataset.edit = '1'; st.textContent = css + (s ? 'html,body{background:#000!important}' : ''); document.head.appendChild(st);
    document.body.innerHTML = h;
  }, [CSS, html, solid]);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: !solid });
  return file;
}
// The film ends on the house's wordmark (the app icon's stacked MAISON TRACÉ) and the site, for wherever it plays
// without the player's corner, such as the YouTube trailer (Cat, 2026-10-24).
const LOGO = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8').replace(/<rect[^>]*\/>/, '').replace('viewBox="0 0 512 512"', 'viewBox="70 170 372 180"');
const endCard = () => {
  const [w, u] = WIDE ? [360, 15] : [230, 11];
  return words(`<div class="f mid"><div style="width:${w}px">${LOGO}</div><div class="r" style="margin:26px auto 18px;opacity:.7"></div><div class="k" style="font-size:${u}px;text-transform:lowercase">maisontrace.co</div></div>`, { solid: true });
};
// The house name isn't on the cards: the player's corner already says it (Cat, 2026-10-22). No kicker, no rule.
const card = (kicker, title, line = '', size = WIDE ? 76 : 64) => words(`<div class="f mid">${kicker ? `<div class="k">${kicker}</div><div class="r"></div>` : ''}<h1 class="t" style="font-size:${size}px">${title}</h1>${line ? `<p class="l" style="margin-top:18px">${line}</p>` : ''}</div>`, { solid: true });

// Two pieces as one, the first dissolving into the second over d seconds, for a move with no dip to black.
async function dissolve(a, b2, d) {
  const out = join(work, `p${String(k++).padStart(3, '0')}.mp4`);
  const len = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a]).toString());
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', a, '-i', b2, '-filter_complex', `[0:v][1:v]xfade=transition=fade:duration=${d}:offset=${(len - d).toFixed(3)},format=yuv420p[v]`, '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', String(FPS), out]);
  return out;
}
// A black frame round a drawing, so a zoomed-in moment shows the drawing alone, not cut-off words around it.
// top and bottom (and left and right, if given): where the picture shows, as fractions of the frame; it fades in
// over the 3% outside them.
const masks = {};
async function mask([top, bottom, left = -1, right = 2]) {
  const key = `${top}-${bottom}-${left}-${right}`;
  const band = (dir, a, b) => `linear-gradient(${dir},#000 0,#000 ${(a - 0.03) * 100}%,rgba(0,0,0,0) ${a * 100}%,rgba(0,0,0,0) ${b * 100}%,#000 ${(b + 0.03) * 100}%,#000 100%)`;
  masks[key] ??= await words(`<div class="f" style="background:${band('to bottom', top, bottom)},${band('to right', left, right)}"></div>`);
  return masks[key];
}

// A piece of the film: part of a shot (or a still picture), eased in by a zoom, faded or cut, words laid over it.
// zoom: [from, to] scale; at: [x, y] the point zoomed into, as fractions of the frame.
let k = 0;
// overs: more words, each [picture, when it fades in], laid over one after another.
// reverse: play the moment backwards (a push-in becomes a pull-back).
// cam: a camera that moves, as [time in the piece, zoom, x, y] stops, eased from one to the next, in place of zoom and at.
const eased = (stops, i) => {
  const t = `(on/${FPS})`;
  let e = String(stops[stops.length - 1][i]);
  for (let j = stops.length - 2; j >= 0; j--) {
    const [t0, t1, a, b] = [stops[j][0], stops[j + 1][0], stops[j][i], stops[j + 1][i]];
    const u = `min(1,max(0,(${t}-${t0})/${Math.max(t1 - t0, 0.001)}))`;
    e = `if(lt(${t},${t1}),${a}+(${b - a})*${u}*${u}*(3-2*${u}),${e})`;
  }
  return e;
};
// notes: captions, each [picture, when it fades in, when it fades out], so a first-time viewer knows what each tap does.
async function piece({ shot, still, from = 0, dur, speed = 1, zoom = [1, 1], at = [0.5, 0.5], cam, frame, tint, fadeIn = 0, fadeOut = 0, over, overIn = 0.4, overAt = 0, overs = [], notes = [], reverse = false }) {
  const edge = frame ? await mask(frame) : undefined;
  const out = join(work, `p${String(k++).padStart(3, '0')}.mp4`);
  const frames = Math.round(dur * FPS);
  const args = ['-v', 'error', '-y'];
  if (still) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', still);
  else args.push('-ss', String(from), '-t', String(dur * speed + 0.5), '-i', join(SHOTS, `${shot}.mp4`));
  if (edge) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', edge);
  if (over) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', over);
  for (const [o] of overs) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', o);
  for (const [o] of notes) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', o);
  const oi = edge ? 2 : 1;
  const firstOver = oi + (over ? 1 : 0);
  const [z0, z1] = zoom;
  const z = cam ? eased(cam, 1) : `(${z0}+(${z1 - z0})*on/${frames})`;
  const [ax, ay] = cam ? [eased(cam, 2), eased(cam, 3)] : at;
  let v = `[0:v]setpts=(PTS-STARTPTS)/${speed},fps=${FPS},scale=${2 * W}:${2 * H},zoompan=z='${z}':x='max(0,min(iw-iw/zoom,(${ax})*iw-iw/zoom/2))':y='max(0,min(ih-ih/zoom,(${ay})*ih-ih/zoom/2))':d=1:s=${W}x${H}:fps=${FPS},trim=end_frame=${frames},setsar=1${reverse ? ',reverse' : ''}`;
  // tint: [r, g, b] multipliers, e.g. to take the cream pattern paper down to a deeper champagne.
  if (tint) v += `,colorchannelmixer=rr=${tint[0]}:gg=${tint[1]}:bb=${tint[2]}`;
  if (edge) v += `[raw];[raw][1:v]overlay=0:0:shortest=1`;
  if (over) v += `[base];[${oi}:v]format=rgba,fade=t=in:st=${overAt}:d=${overIn}:alpha=1[o];[base][o]overlay=0:0:shortest=1`;
  overs.forEach(([, when], i) => {
    v += `[b${i}];[${firstOver + i}:v]format=rgba,fade=t=in:st=${when}:d=0.5:alpha=1[w${i}];[b${i}][w${i}]overlay=0:0:shortest=1`;
  });
  const firstNote = firstOver + overs.length;
  notes.forEach(([, on, off], i) => {
    v += `[n${i}];[${firstNote + i}:v]format=rgba,fade=t=in:st=${on}:d=0.45:alpha=1,fade=t=out:st=${off - 0.45}:d=0.45:alpha=1[c${i}];[n${i}][c${i}]overlay=0:0:shortest=1`;
  });
  if (fadeIn) v += `,fade=t=in:st=0:d=${fadeIn}`;
  if (fadeOut) v += `,fade=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut}`;
  v += ',format=yuv420p[v]';
  execFileSync('ffmpeg', [...args, '-filter_complex', v, '-map', '[v]', '-frames:v', String(frames), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', String(FPS), out]);
  return out;
}

// The Style chapter as one unbroken move (Cat, 2026-10-24: too choppy; hand-hold on an elegant journey): the waist
// seam dropped, the dress filled navy, stripe, then Prince of Wales (Cat, 2026-10-23), and the hem and a boat neck
// drawn straight on the dress in its fabric, enlarged (D1 Draw on the Dress, 2026-10-24), through Done to the pattern
// sheet. The camera glides between the moments, and a big word or two names each step. Times are in the style shot,
// as record-tour-shots.mjs prints them.
const MARKS = WIDE ? { shape: 0.9, fabric: 4.7, checks: 12.1, draw: 14.4, done: 26.2 } : { shape: 0.9, fabric: 6.3, checks: 13.7, draw: 16.0, done: 27.5 };
const JOURNEY = { from: 0.6, to: MARKS.done + 0.9, dur: 17 };
const atOut = (t) => ((t - JOURNEY.from) * JOURNEY.dur) / (JOURNEY.to - JOURNEY.from);
// [shot time, zoom, x, y]: on a computer, close on the dress and the shapes, out a little for the fabrics beside it,
// in on the enlarged form to draw, and back as the pattern comes up. A phone shows the whole screen throughout.
const STYLE_CAM = (WIDE
  ? [[0.6, 1.3, 0.6, 0.46], [MARKS.fabric - 0.6, 1.3, 0.6, 0.46], [MARKS.fabric + 1, 1.12, 0.5, 0.5], [MARKS.draw, 1.12, 0.5, 0.5], [MARKS.draw + 1.6, 1.22, 0.5, 0.46], [MARKS.done, 1.22, 0.5, 0.46], [JOURNEY.to, 1, 0.5, 0.5]]
  : [[0.6, 1, 0.5, 0.5], [JOURNEY.to, 1.05, 0.5, 0.47]]).map(([t, ...r]) => [atOut(t), ...r]);
const STYLE_NOTES = [
  ['Drop the waist.', MARKS.shape, MARKS.fabric - 0.4],
  ['Choose the fabric.', MARKS.fabric + 0.2, MARKS.fabric + 4.6],
  ['Add a print.', MARKS.fabric + 4.8, MARKS.draw - 0.3],
  ['Draw it longer.', MARKS.draw + 1.9, MARKS.draw + 5.6],
  ['Draw a boat neck.', MARKS.draw + 5.8, MARKS.done - 0.2],
];
const styleJourney = async () => {
  // One at a time: the words are all drawn on the one page.
  const notes = [];
  for (const [line, on, off] of STYLE_NOTES) notes.push([await note(line), atOut(on), atOut(off)]);
  return piece({ shot: 'style', from: JOURNEY.from, dur: JOURNEY.dur, speed: (JOURNEY.to - JOURNEY.from) / JOURNEY.dur, cam: STYLE_CAM, fadeIn: 0.5, notes });
};
// Cat (2026-10-22): the cream pattern paper was too bright after the black pages; a deeper champagne here.
// Wide: from the moment the pattern is up, slowed a touch to fill its time (Cat, 2026-10-22: the drawing flashed before it).
const PATTERN = WIDE
  ? { from: 1.1, speed: 0.8, zoom: [1.6, 1.66], at: [0.42, 0.72], frame: [0.09, 1.05, 0.1, 0.92], tint: [0.84, 0.78, 0.66] }
  : { from: 1.1, speed: 0.75, zoom: [1.1, 1.14], at: [0.5, 0.56], frame: [0.305, 0.712], tint: [0.84, 0.78, 0.66] };
// On a phone the whole sheet of pages shows, the words round it in black (Cat, 2026-10-24: 1.6 was too close).
const PAGES = { shot: 'print', from: 5.2, speed: 0.75, ...(WIDE ? { frame: [0.1, 1.05] } : { zoom: [1.15, 1.2], at: [0.5, 0.49], frame: [0.12, 0.89] }) };
// Cat's B Three Checks (2026-10-22): what All round is for, a line at a time over the turning form. On a phone in a
// dark band along the bottom; on a computer to the left of the form. Each line is its own picture, all laid out
// together so they stack in place; only the first carries the dark band.
async function threeChecks() {
  const lines = ['Seams meet.', 'Hem sits level.', 'Before you cut.'];
  const size = WIDE ? 54 : 40;
  const pics = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines.map((l, j) => `<h1 class="t" style="font-size:${size}px;margin:0 0 10px;${j === 2 ? 'color:#d9c49b;' : ''}opacity:${j === i ? 1 : 0}">${l}</h1>`).join('');
    const band = i === 0;
    pics.push(await words(WIDE
      ? `<div class="f" style="display:flex;flex-direction:column;justify-content:center;padding-left:96px;${band ? 'background:linear-gradient(to right,rgba(0,0,0,.75) 0,rgba(0,0,0,.45) 30%,rgba(0,0,0,0) 42%)' : ''}"><div>${h}</div></div>`
      : `<div class="f" style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;padding:0 28px 70px;${band ? 'background:linear-gradient(to top,rgba(0,0,0,.8) 0,rgba(0,0,0,.5) 22%,rgba(0,0,0,0) 34%)' : ''}"><div>${h}</div></div>`));
  }
  return pics;
}
// A caption for a step in the Style chapter (Cat, 2026-10-24: not clear what's being picked), in a dark band along
// the top, over the app's own header, so the choices being tapped stay clear.
const note = (line) => words(WIDE
  ? `<div class="f" style="background:linear-gradient(to bottom,rgba(0,0,0,.92) 0,rgba(0,0,0,.8) 13%,rgba(0,0,0,0) 22%);padding:44px 0 0 96px"><h1 class="t" style="font-size:46px">${line}</h1></div>`
  : `<div class="f" style="background:linear-gradient(to bottom,rgba(0,0,0,.92) 0,rgba(0,0,0,.8) 11%,rgba(0,0,0,0) 17%);padding:40px 0 0 28px"><h1 class="t" style="font-size:36px">${line}</h1></div>`);
// P2 Or Start From a Photo (Cat, 2026-10-24): after the garments, a photo of a dress (made for the film, no person in
// it) dissolves into the same dress drafted on the form, enlarged, before its lines are drawn. Its words are the
// same size and place as the Style steps'.
const PHOTO = readFileSync(new URL('./tour/photo-dress.jpg', import.meta.url)).toString('base64');
const DRAFTED = WIDE
  ? { t: 16.8, zoom: [1.84, 1.8], at: [0.5, 0.46], frame: [-1, 2, 0.3, 0.7] }
  : { t: 18.3, zoom: [2.04, 2], at: [0.5, 0.45], frame: [-1, 2, 0.16, 0.84] };
async function photoMoment() {
  const pic = await words(`<div class="f" style="display:flex;align-items:center;justify-content:center;padding-top:${WIDE ? 70 : 60}px"><img src="data:image/jpeg;base64,${PHOTO}" style="height:${WIDE ? 640 : 560}px;max-width:94%;object-fit:cover"></div>`, { solid: true });
  const drafted = join(work, 'drafted.png');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(DRAFTED.t), '-i', join(SHOTS, 'style.mp4'), '-frames:v', '1', drafted]);
  const words1 = await note('Or start from a photo.');
  return dissolve(
    await piece({ still: pic, dur: 2.6, zoom: [1, 1.03], fadeIn: 0.5, notes: [[words1, 0.3, 3]] }),
    await piece({ still: drafted, dur: 2.6, zoom: DRAFTED.zoom, at: DRAFTED.at, frame: DRAFTED.frame, fadeOut: 0.5, notes: [[words1, 0, 2]] }),
    1,
  );
}
// The opening (Cat, 2026-10-22: the old one repeated the loading screen and welcome the viewer had just seen).
const INTRO = process.env.TOUR_INTRO ?? 'C2'; // Cat's pick, 2026-10-22: C2 Pull Back
const TITLE = `<h1 class="t" style="font-size:${WIDE ? 84 : 64}px">How it works</h1>`;
const title = async (where = 'centre') => words(where === 'centre'
  ? `<div class="f mid" style="display:flex;background:radial-gradient(ellipse at center,rgba(0,0,0,.55) 0,rgba(0,0,0,0) 60%)">${TITLE}</div>`
  : WIDE
    ? `<div class="f" style="display:flex;flex-direction:column;justify-content:center;padding-left:96px;background:linear-gradient(to right,rgba(0,0,0,.75) 0,rgba(0,0,0,.45) 30%,rgba(0,0,0,0) 42%)">${TITLE}</div>`
    : `<div class="f" style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:84px;background:linear-gradient(to top,rgba(0,0,0,.8) 0,rgba(0,0,0,.5) 22%,rgba(0,0,0,0) 34%)">${TITLE}</div>`);
const INTROS = {
  // A Title Card: the words alone, then straight on.
  A: async () => [await piece({ still: await card('', 'How it works'), dur: 2.8, fadeIn: 0.8, fadeOut: 0.5 })],
  // B Straight In: no title at all; the film opens on 01 Measure.
  B: async () => [],
  // C Spin First: the finished dress turning close, the title over it.
  C: async () => [await piece({ shot: 'round', from: 6.5, dur: 3.6, fadeIn: 0.8, fadeOut: 0.5, over: await title(), overAt: 0.6 })],
  // Takes on C (Cat, 2026-10-22).
  // C2 Pull Back: from close on the seams, drawing back to the form as the title arrives.
  // Tightened (Cat, 2026-10-24: too long to start): shorter, the title in sooner.
  C2: async () => [await piece({ shot: 'round', from: 2.4, dur: 3.4, reverse: true, fadeIn: 0.5, fadeOut: 0.5, over: await title(), overAt: 0.8, overIn: 0.7 })],
  // C3 Title First: the words on black, the turning form rising behind them.
  C3: async () => [await piece({ shot: 'round', from: 6.2, dur: 4, fadeIn: 1.8, fadeOut: 0.5, over: await title(), overAt: 0, overIn: 0.6 })],
  // C4 Title Aside: the close turn with the words low (phone) or to the left (computer), the form left clear.
  C4: async () => [await piece({ shot: 'round', from: 6.5, dur: 3.8, fadeIn: 0.8, fadeOut: 0.5, over: await title('aside'), overAt: 0.8, overIn: 0.6 })],
  // C5 Long Push: the whole form, pushed in fast to the seams, the title landing as it gets close.
  C5: async () => [await piece({ shot: 'round', from: 0.4, dur: 4.6, speed: 1.8, fadeIn: 0.8, fadeOut: 0.5, over: await title(), overAt: 2.4, overIn: 0.6 })],
  // D Fabric First: the dress flicking through fabrics, the title over it.
  D: async () => [await piece({ shot: 'style', from: 24.4, dur: 3.6, speed: 3, ...(WIDE ? { zoom: [2.1, 2.15], at: [0.41, 0.6], frame: [-0.1, 1.05, -0.1, 0.92] } : { zoom: [1.7, 1.75], at: [0.48, 0.49], frame: [0.23, 0.76] }), fadeIn: 0.8, fadeOut: 0.5, over: await title(), overAt: 0.6 })],
};
const CUTS = {
  // V1 Chapter Words (Cat's pick, 2026-10-22): slow and cinematic, a word or two on a page between the moments;
  // Style is about the clothes: a dress styled with the tools and filled with fabric (Cat, 2026-10-23), then all
  // round on you, drawing closer as it turns (the recorder fills the screen with it; Cat, 2026-10-22).
  words: async () => {
    const f = 0.5;
    const opening = [
      ...(await INTROS[INTRO]()),
      await piece({ still: await card('01', 'Measure', 'Just a few, once.'), dur: 2.2, fadeIn: f, fadeOut: f }),
      // One unbroken move to the waist (Cat, 2026-10-22: starting mid-pull, it appeared from nowhere, small): from
      // black, the tape pulling in across the top of the first page, the welcome skipped (Cat, 2026-10-23). On a phone
      // it fills the screen, drawn in just enough that the header is off the top (Cat, 2026-10-23: no black band). It
      // joins with the tape already on its way in, past the black second it took to reach the screen (Cat, 2026-10-24).
      await piece({ shot: 'tape', from: 1, dur: 7.8, ...(WIDE ? { frame: [0.1, 1.05] } : { zoom: [1.1, 1.1], at: [0.5, 0.545] }), fadeIn: f, fadeOut: f }),
    ];
    // TOUR_PREVIEW=1 stops after the opening and the tape, to try an opening without cutting the whole film.
    if (process.env.TOUR_PREVIEW) return opening;
    return [
      ...opening,
      await piece({ still: await card('02', 'Choose', 'Then what to make.'), dur: 3, fadeIn: f, fadeOut: f }),
      await piece({ shot: 'choose', from: 0.3, dur: 3.2, fadeIn: f, fadeOut: f }),
      await photoMoment(),
      await piece({ still: await card('03', 'Style', 'Make it yours.'), dur: 3, fadeIn: f, fadeOut: f }),
      // Done lands on the pattern sheet, so the pattern follows straight on, then the dress all round (Cat,
      // 2026-10-24: no flash back to the dress between them), each dissolving into the next.
      await dissolve(
        await dissolve(await styleJourney(), await piece({ shot: 'pattern', dur: 3.6, ...PATTERN, notes: [[await note('Your pattern, drafted.'), 0.5, 3.4]] }), 0.8),
        await piece({ shot: 'round', from: 0.3, dur: 8.6, fadeOut: f, overs: (await threeChecks()).map((p, i) => [p, 0.9 + i * 1.8]) }),
        1,
      ),
      await piece({ still: await card('04', 'Print', 'At home, or full size.'), dur: 3, fadeIn: f, fadeOut: f }),
      await piece({ ...PAGES, dur: 4.4, fadeIn: f, fadeOut: f }),
      await piece({ still: await card('', 'Drafted<br>to your body'), dur: 4.5, fadeIn: 0.8, fadeOut: 1.2 }),
      await piece({ still: await endCard(), dur: 3, fadeIn: 0.8, fadeOut: 0.8 }),
    ];
  },
};

const pieces = await CUTS.words();
await b.close();
writeFileSync(join(work, 'list.txt'), pieces.map((p) => `file '${p}'`).join('\n'));
const film = join(work, 'film.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-c', 'copy', film]);
const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', film]).toString());
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', film, '-i', MUSIC, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-af', `afade=t=in:d=0.4,afade=t=out:st=${(secs - 3).toFixed(2)}:d=3`, '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', OUT]);
// A WebM copy beside it, for browsers without H.264.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', OUT, '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-c:a', 'libopus', '-b:a', '96k', OUT.replace(/\.mp4$/, '.webm')]);
rmSync(work, { recursive: true, force: true });
console.log(`${OUT}: ${secs.toFixed(1)} s`);
