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
  /* The film's words are champagne, its own voice apart from the app's cream (Cat, 2026-10-31: the gold looked bad). */
  .t{color:#d9c49b;font-family:'Archivo Variable',sans-serif;font-stretch:87%;font-weight:600;text-transform:uppercase;line-height:.9;letter-spacing:.005em;margin:0}
  /* The captions over the app (Cat's V5, 2026-11-06): Space Grotesk medium in sentence case, one line, champagne, big
     enough to be read at once, so the viewer knows where to look. */
  .n{color:#d9c49b;font-family:'Space Grotesk',sans-serif;font-weight:500;text-transform:none;font-stretch:100%;line-height:1.1;letter-spacing:-0.005em;white-space:nowrap;margin:0}
  .l{color:#d9c49b;font-weight:300;font-size:17px;line-height:1.45;margin:0}
  .mid{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .mid .r{margin:20px auto}`;
let n = 0;
async function words(html, { solid = false } = {}) {
  const file = join(work, `w${n++}.png`);
  await page.evaluate(([css, h, s]) => {
    document.head.querySelectorAll('style[data-edit]').forEach((x) => x.remove());
    const st = document.createElement('style'); st.dataset.edit = '1'; st.textContent = css + (s ? 'html,body{background:#000000!important}' : ''); document.head.appendChild(st);
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
// One size for every title card, How it works included, small enough that HOW IT WORKS sits on one line on a phone
// (Cat, 2026-11-06: "on one line and smaller", and the same size as Measure, Choose, Style and Print).
const HEAD = WIDE ? 62 : 52;
const card = (kicker, title, line = '', size = HEAD) => words(`<div class="f mid">${kicker ? `<div class="k">${kicker}</div><div class="r"></div>` : ''}<h1 class="t" style="font-size:${size}px">${title}</h1>${line ? `<p class="l" style="margin-top:18px">${line}</p>` : ''}</div>`, { solid: true });

// Two pieces as one, the first dissolving into the second over d seconds, for a move with no dip to black.
async function dissolve(a, b2, d) {
  const out = join(work, `p${String(k++).padStart(3, '0')}.mp4`);
  const len = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a]).toString());
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', a, '-i', b2, '-filter_complex', `[0:v][1:v]xfade=transition=fade:duration=${d}:offset=${(len - d).toFixed(3)},format=yuv420p[v]`, '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', String(FPS), out]);
  return out;
}
// A black frame round a drawing, so a zoomed-in moment shows the drawing alone, not cut-off words around it.
// top and bottom (and left and right, if given): where the picture shows, as fractions of the frame; it fades in
// over the 3% outside them, or over soft at the top (a crisp top reads as the paper's own edge, not a blur).
const masks = {};
async function mask([top, bottom, left = -1, right = 2, soft = 0.03]) {
  const key = `${top}-${bottom}-${left}-${right}-${soft}`;
  const band = (dir, a, b, sa = 0.03) => `linear-gradient(${dir},#000000 0,#000000 ${(a - sa) * 100}%,rgba(0,0,0,0) ${a * 100}%,rgba(0,0,0,0) ${b * 100}%,#000000 ${(b + 0.03) * 100}%,#000000 100%)`;
  masks[key] ??= await words(`<div class="f" style="background:${band('to bottom', top, bottom, soft)},${band('to right', left, right)}"></div>`);
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
async function piece({ shot, src, slide = 0, still, from = 0, dur, speed = 1, zoom = [1, 1], at = [0.5, 0.5], cam, frame, tint, fadeIn = 0, fadeOut = 0, over, overIn = 0.4, overAt = 0, overs = [], notes = [], cards = [], strip, reverse = false, lift, drop }) {
  const edge = frame ? await mask(frame) : undefined;
  const out = join(work, `p${String(k++).padStart(3, '0')}.mp4`);
  const frames = Math.round(dur * FPS);
  const args = ['-v', 'error', '-y'];
  if (still) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', still);
  else args.push('-ss', String(from), '-t', String(dur * speed + 0.5), '-i', src ?? join(SHOTS, `${shot}.mp4`));
  if (edge) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', edge);
  if (over) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', over);
  for (const [o] of overs) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', o);
  for (const [o] of notes) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', o);
  for (const [o] of cards) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', o);
  if (strip) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', strip.file);
  const oi = edge ? 2 : 1;
  const firstOver = oi + (over ? 1 : 0);
  const [z0, z1] = zoom;
  const z = cam ? eased(cam, 1) : `(${z0}+(${z1 - z0})*on/${frames})`;
  const [ax, ay] = cam ? [eased(cam, 2), eased(cam, 3)] : at;
  let v = `[0:v]setpts=(PTS-STARTPTS)/${speed},fps=${FPS},scale=${2 * W}:${2 * H},zoompan=z='${z}':x='max(0,min(iw-iw/zoom,(${ax})*iw-iw/zoom/2))':y='max(0,min(ih-ih/zoom,(${ay})*ih-ih/zoom/2))':d=1:s=${W}x${H}:fps=${FPS},trim=end_frame=${frames},setsar=1${reverse ? ',reverse' : ''}`;
  // slide: the picture travels in from the right edge to its place over that many seconds, starting gently and
  // gathering speed as it goes, like a camera move (Cat, 2026-10-24: "starts slower and ramps up slightly").
  // lift: [how far, of the frame height, the picture moves up; when it starts to; over how long], so the pattern
  // sheet sits just under its words, not far below them (Cat, 2026-10-25: "such a big gap").
  if (lift) {
    const [l, a = -1, d = 0.001] = lift;
    const px = Math.round(l * H);
    v += `,pad=iw:ih+${px}:0:0:0x000000,crop=${W}:${H}:0:'${px}*clip((t-${a})/${d},0,1)'`;
  }
  // drop: how far, of the frame height, the picture sits lower, to leave room for two lines of words above it.
  if (drop) v += `,pad=iw:ih+${Math.round(drop * H)}:0:${Math.round(drop * H)}:0x000000,crop=${W}:${H}:0:0`;
  if (slide) v += `,pad=iw*2:ih:iw:0:0x000000,crop=${W}:${H}:x='${W}*(0.3*min(1,t/${slide})+0.7*pow(min(1,t/${slide}),2))':y=0`;
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
  // cards: [picture, when it comes in, when it goes], a card that glides in a little from the right as it fades in,
  // holds still, and fades away.
  const firstCard = firstNote + notes.length;
  cards.forEach(([, on, off], i) => {
    const glide = Math.round(W * 0.03);
    v += `[q${i}];[${firstCard + i}:v]format=rgba,fade=t=in:st=${on}:d=0.5:alpha=1,fade=t=out:st=${off - 0.4}:d=0.4:alpha=1[d${i}];[q${i}][d${i}]overlay=x='${glide}*pow(1-min(1,max(0,(t-${on})/0.6)),2)':y=0:shortest=1`;
  });
  // strip: { file, x0, x1, y, on } a wide row of cards (in output pixels) that fades in and glides steadily from x0 to x1
  // across the whole piece, like turning through a swatch book (Cat's S2 Slow Strip, 2026-11-02).
  if (strip) {
    const si = firstCard + cards.length;
    v += `[sb];[${si}:v]format=rgba,fade=t=in:st=${strip.on ?? 0.2}:d=0.6:alpha=1[sp];[sb][sp]overlay=x='${strip.x0}+(${strip.x1 - strip.x0})*t/${dur}':y=${strip.y}:shortest=1`;
  }
  if (fadeIn) v += `,fade=t=in:st=0:d=${fadeIn}`;
  if (fadeOut) v += `,fade=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut}`;
  v += ',format=yuv420p[v]';
  execFileSync('ffmpeg', [...args, '-filter_complex', v, '-map', '[v]', '-frames:v', String(frames), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', String(FPS), out]);
  return out;
}

// The Style chapter as one unbroken move (Cat, 2026-10-24: hand-hold on an elegant journey): it opens on the dress
// already drafted from the photo the film has just shown (Cat, 2026-10-24: show that starting from a photo works),
// then refilled in a big print, enlarged, and the drawing tool, enlarged with it, takes the boat neck straight
// across, the hem longer and the waist seam down, and Done goes on to the pattern sheet. The camera glides between the moments, and a big word or two names
// each step. Times are in the style shot, as record-tour-shots.mjs prints them.
/** One frame of the tape shot, as a picture. */
function tapeAcross(t) {
  const out = join(work, `tape-${t}.png`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', join(SHOTS, 'tape.mp4'), '-frames:v', '1', out]);
  return out;
}
const MARKS = WIDE
  ? { fabric: 1.4, enlarge: 6.8, draw: 8.8, hem: 10.3, side: 15.6, done: 19.9 }
  : { fabric: 1.4, enlarge: 7.2, draw: 7.2, hem: 8.7, side: 14.3, done: 18.6 };
// Played at 1.4 times its speed, however long the take (Cat, 2026-11-01: less time on the dress page, no enlarge).
// Ends as Done is tapped, on the drawing: Shop the fabric follows, not the pattern sheet (Cat, 2026-11-02).
const JOURNEY = { from: 0.6, to: MARKS.done - 0.2, dur: Math.round(((MARKS.done + 0.3) / 1.4) * 10) / 10 };
const atOut = (t) => ((t - JOURNEY.from) * JOURNEY.dur) / (JOURNEY.to - JOURNEY.from);
// [shot time, zoom, x, y]: on a computer, the whole page, then in on the enlarged form to draw, and back as the
// pattern comes up. A phone shows the whole screen throughout. Both end framed as the pattern shot opens, so the
// sheet doesn't jump as one dissolves into the other (Cat, 2026-10-25).
const STYLE_CAM = (WIDE
  ? [[0.6, 1, 0.5, 0.5], [MARKS.draw, 1, 0.5, 0.5], [MARKS.hem - 0.2, 1.25, 0.5, 0.44], [JOURNEY.to, 1.25, 0.5, 0.44]]
  : [[0.6, 1, 0.5, 0.5], [JOURNEY.to, 1.05, 0.5, 0.47]]).map(([t, ...r]) => [atOut(t), ...r]);
// No step words over the Style journey: what each move does is left to show itself (Cat, 2026-10-24: "take out
// these headings, just leave it implied"), nor over the pattern: after the photo's own line, the next words are
// "Drafted to your body".
const STYLE_NOTES = [];
// D1 One Palette Card (Cat, 2026-11-02): as the dress takes the new cloth, one tall swatch card of it, the app's cream
// label strip under it, glides in beside the form and holds still, gone before the drawing tool opens. Its swatch is
// cut from the dress itself once the cloth is on, so it is the very cloth on the form. CARD_AT: shot time the cloth
// changes on screen, about 1 s after the "style cloth" mark record-tour-shots.mjs prints.
const CARD = { at: Number(process.env.CARD_AT ?? (WIDE ? 4.3 : 5.1)), name: process.env.CARD_NAME ?? 'Snakeskin', colour: process.env.CARD_COLOUR ?? 'Aqua' };
const CARD_OFF = (WIDE ? MARKS.enlarge : MARKS.draw) - 0.3;
async function clothCard() {
  const grab = join(work, 'cloth.png');
  // Phone: the bodice below the neck; computer: the same on the smaller form. On a phone the card covers the
  // whole spec list beside the form, so no half-hidden words show at its edges.
  const [cx, cy, cw, ch] = WIDE ? [630, 430, 120, 190] : [290, 520, 200, 290];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(CARD.at + 0.8), '-i', join(SHOTS, 'style.mp4'), '-frames:v', '1', '-vf', `crop=${cw}:${ch}:${cx}:${cy}`, grab]);
  const cloth = readFileSync(grab).toString('base64');
  const [left, top, w, tex, strip] = WIDE ? [690, 250, 120, 170, 46] : [300, 166, 108, 214, 44];
  return words(`<div style="position:fixed;left:${left}px;top:${top}px;width:${w}px;box-shadow:0 12px 28px rgba(0,0,0,.6)"><div style="height:${tex}px;background:url(data:image/png;base64,${cloth}) center/cover"></div><div style="height:${strip}px;box-sizing:border-box;padding:${WIDE ? 10 : 8}px ${WIDE ? 10 : 8}px;background:linear-gradient(90deg,#ece2cb 0%,#ece2cb 78%,#d3c7ab 100%);font-family:'Chakra Petch',monospace;text-transform:uppercase;white-space:nowrap;overflow:hidden"><div style="font-weight:600;font-size:${WIDE ? 10.5 : 8.5}px;letter-spacing:.16em;color:#151311">${CARD.name}</div><div style="font-size:${WIDE ? 8.5 : 7}px;letter-spacing:.14em;color:#6c6250;margin-top:4px">${CARD.colour}</div></div></div>`);
}
const styleJourney = async () => {
  // One at a time: the words are all drawn on the one page.
  const notes = [];
  for (const [line, on, off, where] of STYLE_NOTES) notes.push([await note(line, where), atOut(on), atOut(off)]);
  // The app now draws its own palette card beside the form (Release 53), so the film's card is off unless CARD=1.
  const cards = process.env.CARD !== '1' ? [] : [[await clothCard(), atOut(CARD.at), atOut(CARD_OFF)]];
  return piece({ shot: 'style', from: JOURNEY.from, dur: JOURNEY.dur, speed: (JOURNEY.to - JOURNEY.from) / JOURNEY.dur, cam: STYLE_CAM, fadeIn: 0.5, notes, cards, ...(LIFT && { lift: [LIFT, JOURNEY.dur - 2.4, 1.6] }) });
};
// Cat (2026-10-22): the cream pattern paper was too bright after the black pages; a deeper champagne here.
// Wide: from the moment the pattern is up, slowed a touch to fill its time (Cat, 2026-10-22: the drawing flashed before it).
// On a phone the sheet rises the last part of the journey, to sit just under 'Your pattern, in seconds.'
const LIFT = WIDE ? 0 : 0.065;
const PATTERN = WIDE
  ? { from: 1.1, speed: 0.8, zoom: [1.6, 1.66], at: [0.42, 0.72], frame: [0.1, 1.05, 0.1, 0.92, 0.002], tint: [0.84, 0.78, 0.66] }
  // Drawn in close so the pieces fill the screen, the steps under the sheet masked off (Cat, 2026-10-29).
  : { from: 1.1, speed: 0.75, zoom: [1.42, 1.46], at: [0.5, 0.473], frame: [0.215, 0.9, -1, 2, 0.002], tint: [0.84, 0.78, 0.66] };
// On a phone the whole sheet of pages shows, opened under See the pages, the words round it in black (Cat, 2026-10-24:
// 1.6 was too close).
// On a phone the sheet of pages is thin champagne lines on black; lifted so they read (walkthrough, 2026-10-24).
const PAGES = { shot: 'print', from: 5.2, speed: 0.75, ...(WIDE ? { frame: [0.1, 1.05] } : { zoom: [1.08, 1.12], at: [0.5, 0.36], frame: [0.155, 0.62], tint: [1.4, 1.4, 1.4] }) };
// Cat picked P2 (2026-10-25): on a phone the sheet fills the height of the screen, and the camera drifts slowly from
// the left pieces to the right ones, eased at each end. Drawn from the sharp picture of the sheet the recorder takes.
const SHEET = join(SHOTS, 'print-sheet.png');
function sheetPan(dur) {
  const out = join(work, 'sheet-pan.mp4');
  const th = Math.round(H * 0.92 / 2) * 2;
  const m = Math.round(W * 0.04);
  const u = `(0.5-0.5*cos(PI*min(1,t/${dur})))`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=black:s=${W}x${H}:d=${dur + 0.5}:r=${FPS}`, '-loop', '1', '-framerate', String(FPS), '-t', String(dur + 0.5), '-i', SHEET,
    '-filter_complex', `[1:v]scale=-2:${th}:flags=lanczos[s];[0:v][s]overlay=x='${m}-(overlay_w+${2 * m}-${W})*${u}':y=${(H - th) / 2}:shortest=1,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', out]);
  return out;
}
const pages = (dur, fades) => (!WIDE && existsSync(SHEET) ? piece({ src: sheetPan(dur), dur, tint: [1.4, 1.4, 1.4], ...fades }) : piece({ ...PAGES, dur, ...fades }));
// Cat's B Three Checks (2026-10-22): what All round is for, a line at a time over the turning form. On a phone in a
// dark band along the bottom; on a computer to the left of the form. Each line is its own picture, all laid out
// together so they stack in place; only the first carries the dark band.
async function threeChecks() {
  const lines = ['Seams meet.', 'Hem sits level.', 'Before you cut.'];
  const size = WIDE ? 54 : 40;
  const pics = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines.map((l, j) => `<h1 class="t" style="font-size:${size}px;margin:0 0 10px;${j === 2 ? 'color:#efe4cc;' : ''}opacity:${j === i ? 1 : 0}">${l}</h1>`).join('');
    const band = i === 0;
    pics.push(await words(WIDE
      ? `<div class="f" style="display:flex;flex-direction:column;justify-content:center;padding-left:96px;${band ? 'background:linear-gradient(to right,rgba(0,0,0,.75) 0,rgba(0,0,0,.45) 30%,rgba(0,0,0,0) 42%)' : ''}"><div>${h}</div></div>`
      : `<div class="f" style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;padding:0 28px 70px;${band ? 'background:linear-gradient(to top,rgba(0,0,0,.8) 0,rgba(0,0,0,.5) 22%,rgba(0,0,0,0) 34%)' : ''}"><div>${h}</div></div>`));
  }
  return pics;
}
// A caption for a step in the Style chapter (Cat, 2026-10-24: not clear what's being picked), in a dark band along
// the top, over the app's own header, so the choices being tapped stay clear.
// On a computer the enlarged preview keeps its view switches top left, so its words sit to the left of the form.
// 'low' sits nearer the picture under it, over the black above the photo and the pattern sheet (Cat, 2026-10-25:
// the photo's words a little too high, and the pattern's at the same height).
// shade false: no dark fade behind the words, where they already sit on black (Cat, 2026-10-25: "so much black blur").
// The film's words are gold (.t), so they read apart from the app's cream headings; on a phone they are 40px, the longer
// lines breaking in two (Cat, 2026-10-30: T1 C; 32px read too small next to the app's bigger headings).
// The shade is near solid down past the words, so a page scrolling under them never shows through (Cat, 2026-10-30).
// V5 (Cat, 2026-11-06): one line of Space Grotesk medium, 72px on the 1080-wide phone film (29px here), 34px on the
// computer's; the two-line phone captions are joined into one.
const note = (line0, where, shade = true) => {
  const line = line0.replace(/<br>/g, ' ');
  return words(WIDE && where === 'side'
  ? `<div class="f" style="display:flex;flex-direction:column;justify-content:center;padding-left:96px;background:linear-gradient(to right,rgba(0,0,0,.85) 0,rgba(0,0,0,.6) 30%,rgba(0,0,0,0) 42%)"><h1 class="n" style="font-size:34px">${line}</h1></div>`
  : WIDE
  ? `<div class="f" style="${shade ? 'background:linear-gradient(to bottom,#000000 0,#000000 15.5%,rgba(0,0,0,0) 21%);' : ''}padding:${where === 'low' ? 54 : 44}px 0 0 96px"><h1 class="n" style="font-size:34px">${line}</h1></div>`
  : `<div class="f" style="${shade ? 'background:linear-gradient(to bottom,#000000 0,#000000 14.5%,rgba(0,0,0,0) 19%);' : ''}padding:${where === 'low' ? 44 : 38}px 0 0 22px"><h1 class="n" style="font-size:29px">${line}</h1></div>`);
};
// The scroll down the collection's looks, the way down to Print my pattern, and projector mode, as recorded
// (record-tour-shots.mjs: the phone's scrolls are longer).
const COLLECTION = WIDE ? { from: 0.8, dur: 8.5, speed: 1.45 } : { from: 0.8, dur: 8.5, speed: 1.75, drop: 0.05 };
// A computer has no Review page to scroll (Print my pattern sits beside the drawing), so its projector runs longer.
// Print opens straight on the pattern pieces' sideways scroll, no Review page first (Cat, 2026-11-06), so on a phone
// too there is nothing here; REVIEW=1 brings the scroll down the Review page back.
const REVIEW = WIDE || process.env.REVIEW !== '1' ? undefined : { from: 0.4, dur: 4.4, speed: 1.15 };
// Straight from the pages to a piece on black in projector mode, drawn in close so it fills the screen (Cat,
// 2026-10-29: skip the second scroll down the print page; less blank space). On a phone it sits low and large, its
// foot level with the pattern sheet's (Cat, 2026-10-30: it was cut off under the words).
const PROJECTOR = WIDE ? { from: 8.6, dur: 4.2, zoom: [1.3, 1.34], at: [0.5, 0.47] } : { from: 10.1, dur: 4, zoom: [1.5, 1.53], at: [0.5, 0.3], drop: 0.07 };
// Phone: drawn in a little less and set lower, so the piece sits whole under its two lines of words (Cat, 2026-11-06:
// cut off by the words at the top).
// P2 Or Start From a Photo (Cat, 2026-10-24): after the garments, a photo of a dress (made for the film, no person in
// it), briefly, its words the same size and place as the Style steps'. No drafted dress after it (Cat: skip that).
const PHOTO = readFileSync(new URL('./tour/photo-dress.jpg', import.meta.url)).toString('base64');
async function photoMoment() {
  // P2 Champagne Polaroid (Cat picked, 2026-10-30): the photo in a straight champagne frame, 'That dress' on its strip.
  const k = WIDE ? 1.25 : 1;
  const pic = await words(`<div class="f" style="display:flex;align-items:center;justify-content:center;padding-top:${WIDE ? 70 : 60}px"><div style="background:#efe4cc;padding:${18 * k}px ${18 * k}px ${76 * k}px;box-shadow:0 12px 28px rgba(0,0,0,.6);position:relative"><img src="data:image/jpeg;base64,${PHOTO}" style="display:block;width:${304 * k}px;height:${360 * k}px;object-fit:cover;filter:saturate(.92) contrast(1.04)"><div style="position:absolute;left:0;right:0;bottom:${28 * k}px;text-align:center;font:400 ${12 * k}px/1 'Chakra Petch',monospace;letter-spacing:.3em;text-transform:uppercase;color:#6b5a3a">That dress</div></div></div>`, { solid: true });
  // Held long enough to read (Cat, 2026-10-25).
  return piece({ still: pic, dur: 3.2, zoom: [1, 1.03], fadeIn: 0.5, fadeOut: 0.5, notes: [[await note('Or upload a photo.', 'low'), 0.2, 3.2]] });
}
// S2 Slow Strip (Cat, 2026-11-02, replacing N3b's six tags landing one by one): one row of seven tall swatch cards, real
// Mood listings Cat picked (photos cropped from her screenshots of the shop, no draped stock swirls), each with its
// name, cloth, the shop and its price, gliding slowly sideways. Prices are the listings' regular prices per yard (CA$),
// not the sale price, so the film doesn't date.
const SHOP = [
  ...(process.env.SHOP_PYTHON === '0' ? [] : [['python', 'Aqua & Chili python', 'Silk charmeuse', '$141.94/yd']]),
  ['ribbon', 'Black Bean & White', 'Italian silk print', '$141.89/yd'],
  ['lime', 'Lime & Purple python', 'Italian silk print', '$141.94/yd'],
  ['organza', 'Classic Blue floral', 'Silk organza', '$212.90/yd'],
  ['pink', 'Pink & Turquoise', 'Italian silk print', '$141.94/yd'],
  ['poppy', 'Golden Poppy border', 'Silk charmeuse', '$141.93/yd'],
  ['lily', 'Creme Brulee lily', 'Milly silk chiffon', '$42.57/yd'],
].filter(([img]) => existsSync(new URL(`./tour/shop/${img}.jpg`, import.meta.url)));
async function shopMoment() {
  const dur = 8;
  // Big enough to fill the frame, not a thin row with black above and below (Cat, 2026-11-06).
  const [w, tex, band, gap] = WIDE ? [300, 420, 116, 32] : [210, 360, 100, 18];
  const rowW = SHOP.length * w + (SHOP.length - 1) * gap;
  const cardsHtml = SHOP.map(([img, name, cloth, price], i) => {
    const photo = readFileSync(new URL(`./tour/shop/${img}.jpg`, import.meta.url)).toString('base64');
    const small = WIDE ? 12.5 : 10.5;
    return `<div style="position:absolute;left:${i * (w + gap)}px;top:0;width:${w}px;box-shadow:0 10px 24px rgba(0,0,0,.55)"><img src="data:image/jpeg;base64,${photo}" style="display:block;width:100%;height:${tex}px;object-fit:cover"><div style="height:${band}px;box-sizing:border-box;padding:${WIDE ? 18 : 14}px ${WIDE ? 18 : 13}px 0;background:linear-gradient(90deg,#ece2cb 0%,#ece2cb 78%,#d3c7ab 100%);font-family:'Chakra Petch',monospace;text-transform:uppercase;white-space:nowrap;overflow:hidden"><div style="font-weight:600;font-size:${WIDE ? 15 : 12.5}px;letter-spacing:.12em;color:#151311">${name}</div><div style="font-size:${small}px;letter-spacing:.12em;color:#6c6250;margin-top:8px">${cloth}</div><div style="font-size:${small}px;letter-spacing:.12em;color:#6c6250;margin-top:4px">Mood Fabrics${price ? ` · ${price}` : ''}</div></div></div>`;
  }).join('');
  // The row is wider than the screen: draw it on a wide page, then slide it under the frame.
  const file = join(work, `w${n++}.png`);
  const h = tex + band + 40;
  await page.setViewportSize({ width: rowW + 40, height: Math.max(VH, h) });
  await page.evaluate(([css, html]) => {
    document.head.querySelectorAll('style[data-edit]').forEach((x) => x.remove());
    const st = document.createElement('style'); st.dataset.edit = '1'; st.textContent = css; document.head.appendChild(st);
    document.body.innerHTML = html;
  }, [CSS, `<div style="position:absolute;left:20px;top:10px;width:${rowW}px;height:${tex + band}px">${cardsHtml}</div>`]);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: rowW + 40, height: h } });
  await page.setViewportSize({ width: VW, height: VH });
  const k = W / VW;
  // From the first card (the cloth on the dress) whole on screen to the last card a little in from the right.
  const x0 = Math.round((WIDE ? VW * 0.12 : VW * 0.12) * k - 20 * k);
  const x1 = Math.round((VW * 0.88 - rowW - 20) * k);
  const y = Math.round((WIDE ? 200 : 190) * k);
  return piece({ still: await words('', { solid: true }), dur, fadeIn: 0.5, fadeOut: 0.5, strip: { file, x0, x1, y, on: 0.3 }, notes: [[await note('Shop the fabric.', 'low'), 0.2, dur]] });
}
// The opening (Cat, 2026-10-22: the old one repeated the loading screen and welcome the viewer had just seen).
const INTRO = process.env.TOUR_INTRO ?? 'W'; // Cat's pick, 2026-10-30: W Welcome Push (was C2 Pull Back)
const TITLE = `<h1 class="t" style="font-size:${HEAD}px;white-space:nowrap">How it works</h1>`;
const title = async (where = 'centre') => words(where === 'centre'
  ? `<div class="f mid" style="display:flex;background:radial-gradient(ellipse at center,rgba(0,0,0,.55) 0,rgba(0,0,0,0) 60%)">${TITLE}</div>`
  : WIDE
    ? `<div class="f" style="display:flex;flex-direction:column;justify-content:center;padding-left:96px;background:linear-gradient(to right,rgba(0,0,0,.75) 0,rgba(0,0,0,.45) 30%,rgba(0,0,0,0) 42%)">${TITLE}</div>`
    : `<div class="f" style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:84px;background:linear-gradient(to top,rgba(0,0,0,.8) 0,rgba(0,0,0,.5) 22%,rgba(0,0,0,0) 34%)">${TITLE}</div>`);
const INTROS = {
  // W Welcome Push (Cat, 2026-10-30: "this smooth zoom in version"): the welcome page as the viewer has just seen it,
  // its words fading as the camera pushes in on the form and it starts to turn, slowly, the title arriving over the
  // body. Recorded by record-tour-shots.mjs with TOUR_WELCOME=1 (welcome.mp4).
  W: async () => [await piece({ shot: 'welcome', from: 0, dur: 7, fadeOut: 0.6, over: await title(), overAt: 4, overIn: 0.8 })],
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
  // OPENER=<round.mp4> cuts the opening shot from another take: the original dress stays in the opening while Style
  // dresses the form in the one being styled (Cat, 2026-10-24: "it doesn't have to show the dress we are styling yet").
  C5: async () => [await piece({ shot: 'round', src: process.env.OPENER ? resolve(process.env.OPENER) : undefined, from: 0.4, dur: 4.6, speed: 1.8, fadeIn: 0.8, fadeOut: 0.5, over: await title(), overAt: 2.4, overIn: 0.6 })],
  // D Fabric First: the dress flicking through fabrics, the title over it.
  D: async () => [await piece({ shot: 'style', from: 24.4, dur: 3.6, speed: 3, ...(WIDE ? { zoom: [2.1, 2.15], at: [0.41, 0.6], frame: [-0.1, 1.05, -0.1, 0.92] } : { zoom: [1.7, 1.75], at: [0.48, 0.49], frame: [0.23, 0.76] }), fadeIn: 0.8, fadeOut: 0.5, over: await title(), overAt: 0.6 })],
};
const CUTS = {
  // V1 Chapter Words (Cat's pick, 2026-10-22): slow and cinematic, a word or two on a page between the moments;
  // Style is about the clothes: a dress styled with the tools and filled with fabric (Cat, 2026-10-23), then all
  // round on you, drawing closer as it turns (the recorder fills the screen with it; Cat, 2026-10-22).
  words: async () => {
    const f = 0.5;
    // On a phone the page is drawn in just enough that the header is off the top, and a touch left of centre so the
    // tape's brass tip stays on screen the whole way (Cat, 2026-10-24: the end of the tape must stay the same).
    const TAPE_VIEW = WIDE ? { frame: [0.1, 1.05] } : { zoom: [1.08, 1.08], at: [0.49, 0.545] };
    // In the take the tape is all the way across by about 1.8 s; the pull is made from that frame (below).
    const [TAPE_OUT, PULL] = [1.8, 1.1];
    // OPENER_FILM=<walkthrough.mp4> keeps a released film's opening shot and Measure card frame for frame (Cat,
    // 2026-10-24: "go back to that other version exactly"): its first 5.6 s, fades and title already in them.
    const released = process.env.OPENER_FILM ? resolve(process.env.OPENER_FILM) : undefined;
    const opening = [
      ...(released
        ? [await piece({ shot: 'round', src: released, from: 0, dur: 5.6 })]
        : [...(await INTROS[INTRO]()), await piece({ still: await card('01', 'Measure', 'Just a few, once.'), dur: 2.2, fadeIn: f, fadeOut: f })]),
      // One unbroken move to the waist (Cat, 2026-10-22: starting mid-pull, it appeared from nowhere, small): from
      // black, the tape pulling in across the top of the first page, the welcome skipped (Cat, 2026-10-23). On a phone
      // it fills the screen, drawn in just enough that the header is off the top (Cat, 2026-10-23: no black band). It
      // joins with the tape already on its way in, past the black second it took to reach the screen (Cat, 2026-10-24).
      // The tape is the opening curtain (Cat, 2026-10-24: "a steady smooth pull from one side to the other"): the
      // tape, as it lies across the top once pulled, travels in from the right in one smooth move, then the page
      // goes on at its own pace from that same frame.
      await piece({ still: tapeAcross(TAPE_OUT), dur: PULL, slide: PULL, ...TAPE_VIEW }),
      await piece({ shot: 'tape', from: TAPE_OUT, dur: 7.8 - (TAPE_OUT - 1), ...TAPE_VIEW, fadeOut: f }),
    ];
    // TOUR_PREVIEW=1 stops after the opening and the tape, to try an opening without cutting the whole film.
    if (process.env.TOUR_PREVIEW) return opening;
    return [
      ...opening,
      await piece({ still: await card('02', 'Choose', 'Then what to make.'), dur: 3, fadeIn: f, fadeOut: f }),
      // Three ways in, each its own line: a garment, or a look, or a photo (Cat, 2026-10-30: the garment had to read
      // as a way to start too, not a filter on the looks).
      await piece({ shot: 'choose', from: 0.3, dur: 3.2, fadeIn: f, fadeOut: f, notes: [[await note('Pick a garment.', 'low'), 0.2, 3.0]] }),
      // Start from a look, then from a photo (Cat, 2026-10-29: the scroll through the collection back in, before the photo).
      await piece({ shot: 'collection', ...COLLECTION, fadeIn: f, fadeOut: f, notes: [[await note(WIDE ? 'Or start from a look.' : 'Or start<br>from a look.', 'low'), 0, COLLECTION.dur - 0.3]] }),
      await photoMoment(),
      await piece({ still: await card('03', 'Style', 'Make it yours.'), dur: 3, fadeIn: f, fadeOut: f }),
      // Done lands on the pattern sheet, so the pattern follows straight on, then the dress all round (Cat,
      // 2026-10-24: no flash back to the dress between them), each dissolving into the next.
      await dissolve(
        // Shop the fabric sits with Style, straight after the dress is styled (Cat, 2026-11-02: not after the
        // pattern and All round, next to Print).
        await dissolve(await dissolve(await styleJourney(), await shopMoment(), 0.6), await piece({ shot: 'pattern', dur: 3.6, ...PATTERN, notes: [[await note(WIDE ? 'Your pattern, in seconds.' : 'Your pattern,<br>in seconds.', 'low', false), 0.5, 3.4]] }), 0.8),
        await piece({ shot: 'round', from: 0.3, dur: 8.6, fadeOut: f, overs: (await threeChecks()).map((p, i) => [p, 0.9 + i * 1.8]) }),
        1,
      ),
      await piece({ still: await card('04', 'Print', 'At home, or full size.'), dur: 3, fadeIn: f, fadeOut: f }),
      // Down to Print my pattern, the pages, then projector mode (Cat, 2026-10-29: the scroll to print and the
      // projector back in).
      ...(REVIEW ? [await piece({ shot: 'review', ...REVIEW, fadeIn: f })] : []),
      await pages(4.4, { fadeIn: f, fadeOut: f }),
      await piece({ shot: 'projector', ...PROJECTOR, fadeIn: f, fadeOut: f, notes: [[await note(WIDE ? 'Or project it, true size.' : 'Or project it,<br>true size.', 'low'), 0.3, PROJECTOR.dur - 0.3]] }),
      await piece({ still: await card('', 'Drafted<br>to your body'), dur: 4.5, fadeIn: 0.8, fadeOut: 1.2 }),
      await piece({ still: await endCard(), dur: 3, fadeIn: 0.8, fadeOut: 0.8 }),
    ];
  },
};

// ONLY=shop cuts just the Shop the fabric moment, for checking it on its own.
const pieces = process.env.ONLY === 'shop' ? [await shopMoment()] : await CUTS.words();
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
