// Cuts the How it works film from the shots scripts/record-tour-shots.mjs records, with its words set in the app's
// own type and the lofi track (scripts/tour-music.m4a) under it. Needs the app running (npx vite --port 5173) for
// the fonts, and ffmpeg. Usage: node scripts/edit-tour.mjs <shots dir> [out.mp4] [--wide]
// --wide cuts the computer's film from the shots record-tour-shots.mjs --wide records (Cat, 2026-10-22).
import { execFileSync, spawnSync } from 'node:child_process';
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
  .f{position:fixed;inset:0;color:#efe4cc;font-family:'Instrument Sans',sans-serif}
  .k{font:400 10px/1 'Chakra Petch',monospace;letter-spacing:.34em;text-transform:uppercase;color:#d9c49b}
  .r{width:96px;height:1px;background:#d9c49b;margin:18px 0}
  /* The film's words are champagne, its own voice apart from the app's cream (Cat, 2026-10-31: the gold looked bad). */
  .t{color:#d9c49b;font-family:'Archivo Variable',sans-serif;font-stretch:87%;font-weight:600;text-transform:uppercase;line-height:.9;letter-spacing:.005em;margin:0}
  /* The captions over the app (Cat's V5, 2026-11-06): sentence case, one line, big enough to be read at once, so the
     viewer knows where to look. Blush and bolder in the app's own font (Cat, Nov 18: more prominent; the film still
     asked for Space Grotesk, which the app no longer loads, so the words had fallen back to a plain font). */
  .n{color:#f2c2b8;font-family:'Instrument Sans',sans-serif;font-weight:600;text-transform:none;font-stretch:100%;line-height:1.1;letter-spacing:-0.005em;white-space:nowrap;margin:0}
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
// A chapter's number and line are blush, the narration's colour, its title champagne (Cat, Nov 18).
const card = (kicker, title, line = '', size = HEAD) => words(`<div class="f mid">${kicker ? `<div class="k" style="color:#f2c2b8">${kicker}</div><div class="r" style="background:#f2c2b8"></div>` : ''}<h1 class="t" style="font-size:${size}px">${title}</h1>${line ? `<p class="l" style="margin-top:18px">${line}</p>` : ''}</div>`, { solid: true });

// A film file's length, in seconds.
const length = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
// Two pieces as one, the first dissolving into the second over d seconds, for a move with no dip to black.
async function dissolve(a, b2, d) {
  const out = join(work, `p${String(k++).padStart(3, '0')}.mp4`);
  const len = length(a);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', a, '-i', b2, '-filter_complex', `[0:v][1:v]xfade=transition=fade:duration=${d}:offset=${(len - d).toFixed(3)},format=yuv420p[v]`, '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', String(FPS), out]);
  return out;
}
// A black frame round a drawing, so a zoomed-in moment shows the drawing alone, not cut-off words around it.
// top and bottom (and left and right, if given): where the picture shows, as fractions of the frame; it fades in
// over the 3% outside them, or over soft at the top (a crisp top reads as the paper's own edge, not a blur) and
// softEnd at the bottom (a long fade both ways makes a cut-off slice of the form read as a close-up of it).
const masks = {};
async function mask([top, bottom, left = -1, right = 2, soft = 0.03, softEnd = 0.03]) {
  const key = `${top}-${bottom}-${left}-${right}-${soft}-${softEnd}`;
  const band = (dir, a, b, sa = 0.03, sb = 0.03) => `linear-gradient(${dir},#000000 0,#000000 ${(a - sa) * 100}%,rgba(0,0,0,0) ${a * 100}%,rgba(0,0,0,0) ${b * 100}%,#000000 ${(b + sb) * 100}%,#000000 100%)`;
  masks[key] ??= await words(`<div class="f" style="background:${band('to bottom', top, bottom, soft, softEnd)},${band('to right', left, right)}"></div>`);
  return masks[key];
}

// A piece of the film: part of a shot (or a still picture), eased in by a zoom, faded or cut, words laid over it.
// zoom: [from, to] scale; at: [x, y] the point zoomed into, as fractions of the frame.
let k = 0;
// Where the music moves: the pieces the sound follows, found by their place in the cut (the critic's review, Nov 17:
// the track sat level from start to end, through the turn and the last line).
const beats = {};
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
async function piece({ shot, src, slide = 0, still, from = 0, dur, speed = 1, zoom = [1, 1], at = [0.5, 0.5], cam, frame, tint, fadeIn = 0, fadeOut = 0, over, overIn = 0.4, overAt = 0, overs = [], notes = [], cards = [], strip, reverse = false, lift, drop, pan, darken, bold }) {
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
  // bold: thin dark lines on light paper thickened, so a pattern sheet's lines read at film size (dark-on-light only:
  // on black it would thin light lines).
  if (bold) v = v.replace(`scale=${2 * W}:${2 * H},`, `scale=${2 * W}:${2 * H},erosion,`);
  // slide: the picture travels in from the right edge to its place over that many seconds, starting gently and
  // gathering speed as it goes, like a camera move (Cat, 2026-10-24: "starts slower and ramps up slightly").
  // lift: [how far, of the frame height, the picture moves up; when it starts to; over how long], so the pattern
  // sheet sits just under its words, not far below them (Cat, 2026-10-25: "such a big gap").
  if (lift) {
    // An optional fourth value is the colour the room left under it is filled with (black unless given).
    const [l, a = -1, d = 0.001, fill = '0x000000'] = lift;
    const px = Math.round(l * H);
    v += `,pad=iw:ih+${px}:0:0:${fill},crop=${W}:${H}:0:'${px}*clip((t-${a})/${d},0,1)'`;
  }
  // drop: how far, of the frame height, the picture sits lower, to leave room for two lines of words above it.
  // pan: how far, of the frame width, the picture moves left, black coming in on the right (a piece that sits at the
  // screen's right edge brought to the middle).
  if (pan) v += `,pad=iw+${Math.round(pan * W)}:ih:0:0:0x000000,crop=${W}:${H}:${Math.round(pan * W)}:0`;
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
    // A line that comes in before the piece starts (on below 0) is up from its first frame.
    v += `[n${i}];[${firstNote + i}:v]format=rgba${on < 0 ? '' : `,fade=t=in:st=${on}:d=0.45:alpha=1`},fade=t=out:st=${off - 0.45}:d=0.45:alpha=1[c${i}];[n${i}][c${i}]overlay=0:0:shortest=1`;
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
  // darken: [when it is black, over how long], in piece time: eases a hard cut to black in the take into a fade.
  if (darken) v += `,eq=eval=frame:brightness='-clip((t-${(darken[0] - darken[1]).toFixed(3)})/${darken[1]},0,1)*lt(t,${(darken[0] + 0.05).toFixed(3)})'`;
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
// From the "style X" marks record-tour-shots.mjs prints (release W, the calico build, 2026-11-08).
// The moments' times in the style take: from the take's marks.json when the recorder wrote one, else these.
const MARKS = existsSync(join(SHOTS, 'marks.json')) ? JSON.parse(readFileSync(join(SHOTS, 'marks.json'), 'utf8')) : WIDE
  ? { calico: 1.6, questions: 14.4, cloth: 16.0, enlarge: 18.9, draw: 20.9, hem: 23.3, side: 28.9, done: 28.9 }
  : { calico: 1.6, questions: 11.5, cloth: 12.5, enlarge: 15.4, draw: 15.4, hem: 17.9, side: 23.4, done: 23.4 };
// Played at 1.4 times its speed, however long the take (Cat, 2026-11-01: less time on the dress page, no enlarge).
// Ends as Done is tapped, on the drawing: Shop the fabric follows, not the pattern sheet (Cat, 2026-11-02).
// On a phone the take opens on the Fit step, already answered, which only flashed past before Cut (Fable's review,
// Nov 15), so the phone's journey starts on Cut.
const JOURNEY_FROM = WIDE ? Number(process.env.JOURNEY_FROM ?? 2.4) /* opens as the Cut row opens, not on the Shape summary (Fable, Nov 15) */ : Number(process.env.JOURNEY_FROM ?? 2.1);
const JOURNEY = { from: JOURNEY_FROM, to: MARKS.done - 0.2, dur: Math.round(((MARKS.done + 0.9 - JOURNEY_FROM) / 1.9) * 10) / 10 }; // quicker through the steps (Cat, Nov 18)
const atOut = (t) => ((t - JOURNEY.from) * JOURNEY.dur) / (JOURNEY.to - JOURNEY.from);
// [shot time, zoom, x, y]: on a computer, the whole page, then in on the enlarged form to draw, and back as the
// pattern comes up. A phone shows the whole screen throughout. Both end framed as the pattern shot opens, so the
// sheet doesn't jump as one dissolves into the other (Cat, 2026-10-25).
// With the drawing shown as just the form (Cat, 2026-11-07), the computer's film stays on the whole frame too.
const STYLE_CAM = (WIDE
  ? [[0.6, 1, 0.5, 0.5], [JOURNEY.to, 1.03, 0.5, 0.5]] // a slow drift in, so the panels don't sit still (Fable, Nov 15)
  : [[0.6, 1, 0.5, 0.5], [JOURNEY.to, 1.02, 0.5, 0.51]]).map(([t, ...r]) => [atOut(t), ...r]);
// No step words over the Style journey: what each move does is left to show itself (Cat, 2026-10-24: "take out
// these headings, just leave it implied"), nor over the pattern: after the photo's own line, the next words are
// "Drafted to your body".
// Except over just the form as it is drawn on (Cat's W3, 2026-11-07): "Draw on your form." from the draw, and "The
// pattern follows." fading in under it as the hem is drawn. Each [lines, from, to] in shot time.
// The calico build (Cat, 2026-11-08): "One question at a time." as the questions are answered, then "Then the cloth."
// as the python drops in. Each [line, from, to, where] in shot time.
// On a phone the take goes to black after the last question, sometimes with its dip's fade lost in the cut: the
// film eases into the black itself (DIP_AT: shot time the take is black). Found in the take itself, the first black
// after the questions begin: a fixed time went stale with a new take and made a second blink (Fable's review, Nov 15).
let blacks;
/** The style take's dips to black, each [start, end] in shot time. */
function blackRuns() {
  if (blacks) return blacks;
  const run = spawnSync('ffmpeg', ['-v', 'info', '-i', join(SHOTS, 'style.mp4'), '-vf', 'blackdetect=d=0.05:pix_th=0.08', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
  if (run.error) throw run.error;
  blacks = [...(run.stderr ?? '').matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return blacks;
}
const blackAfter = (after) => blackRuns().find(([b]) => b > after);
function firstBlack(after) {
  const run = blackAfter(after);
  return run ? run[0] + 0.05 : 0;
}
const DIP_AT = WIDE ? 0 : Number(process.env.DIP_AT ?? firstBlack(MARKS.calico + 1));
// And the dip into the drawing, where the lines' band ends, so the header doesn't show as it fades.
const DRAW_DIP = WIDE ? 0 : firstBlack(DIP_AT ? DIP_AT + 0.5 : MARKS.cloth) || MARKS.draw + 0.5;
// On a computer there is no dip between them, so one dark band lies under both lines the whole way (an entry with no
// words) and the lines themselves hand over: the app's own header never shows through between.
// One line over the whole journey now (Cat, Nov 18: "Select style details to make it your own" as it clicks through
// neckline, fabric and the rest), on its dark band, so the app's own header never shows through.
const STYLE_LINE = 'Select your style details,'; // shorter (Cat, Nov 18)
const STYLE_NOTES = WIDE
  ? [[STYLE_LINE, JOURNEY.from, MARKS.done + 2, 'low', true]]
  // On a phone too, one dark band lies under the line the whole way (Fable's review, Nov 15).
  : [[STYLE_LINE, JOURNEY.from, MARKS.done + 2, 'low', true]];
// On a phone the words go a beat sooner: as the dress lengthens the view lifts, and the form's head rose into them
// (Fable's review, Nov 15). On a computer they sit to the left of the form.
const DRAW_OFF = WIDE ? 0 : 1.4;
// One line held through the hem, now the pattern says its own words (the second line was 'The pattern follows.').
// Says what the pen is doing, so the drawing reads (Cat, Nov 17: it wasn't clear what it showed).
// No drawing on the form now (Cat, Nov 18), so no line for it unless the take has one (TOUR_DRAW=1).
const DRAW_NOTES = MARKS.draw < MARKS.done - 1 ? [[['Draw a longer hem', 'on your form.'], MARKS.draw + 0.9, MARKS.done - 1.2 - DRAW_OFF]] : [];
const note2 = (lines) => words(WIDE
  ? `<div class="f" style="padding:44px 0 0 96px"><h1 class="n" style="font-size:37px">${lines.join('<br>')}</h1></div>`
  : `<div class="f" style="padding:38px 0 0 22px"><h1 class="n" style="font-size:32px">${lines.join('<br>')}</h1></div>`);
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
// Where the take is cut and the two sides dissolved into each other instead (Fable's review, Nov 15: no blink to
// black inside the chapter, no snap into the enlarged view). Each [last shot time before, first shot time after]. On a
// phone, the dip after the last question; on a computer, from just before the enlarged view to after the dip that
// brings the drawing up on black.
function styleGaps() {
  if (process.env.STYLE_GAPS === '0') return [];
  if (WIDE) {
    const run = blackAfter(MARKS.enlarge - 0.5);
    return run ? [[MARKS.enlarge - 0.15, run[1] + 0.3, true]] : [];
  }
  // Both dips: the one before the cloth, and the one into just the form, which the take fades too quickly
  // (Fable's review, Nov 15).
  // The second goes through black, as the computer's does: from the whole screen to just the form a dissolve would
  // show two dresses.
  return [[DIP_AT && blackAfter(DIP_AT - 0.2), false], [DRAW_DIP && blackAfter(DRAW_DIP - 0.2), true]].filter(([run]) => run).map(([run, black]) => [run[0] - 0.35, run[1] + 0.3, black]);
}
const styleJourney = async () => {
  // One at a time: the words are all drawn on the one page.
  const notes = [];
  // Held up across the take's cuts like the band under it, so the one line stays put the whole way (Cat, Nov 18).
  for (const [line, on, off, where, shade = true] of STYLE_NOTES) notes.push([await note(line, where, shade), on, off, true]);
  if (process.env.TOUR_DRAW_FOCUS !== '0') for (const [lines, on, off] of DRAW_NOTES) notes.push([await note2(lines), on, off]);
  // The app now draws its own palette card beside the form (Release 53), so the film's card is off unless CARD=1.
  const cards = process.env.CARD !== '1' ? [] : [[await clothCard(), CARD.at, CARD_OFF]];
  const speed = (JOURNEY.to - JOURNEY.from) / JOURNEY.dur;
  // The journey in parts, split at the gaps, each part its own piece with the words and camera that fall in it.
  const cuts = styleGaps();
  const parts = [];
  let s0 = JOURNEY.from;
  for (const [end, next] of cuts) { parts.push([s0, end]); s0 = next; }
  // Each gap's way across: through black (true) or a dissolve.
  const black = cuts.map(([, , b]) => !!b);
  parts.push([s0, JOURNEY.to]);
  const camAt = (t) => { const u = (t - JOURNEY.from) / (JOURNEY.to - JOURNEY.from); return STYLE_CAM.length > 1 ? [STYLE_CAM[0][1] + (STYLE_CAM[1][1] - STYLE_CAM[0][1]) * u, 0.5, STYLE_CAM[0][3] + (STYLE_CAM[1][3] - STYLE_CAM[0][3]) * u] : [1, 0.5, 0.5]; };
  const liftAt = JOURNEY.from + (JOURNEY.dur - 2.4) * speed;
  const pieces = [];
  for (const [i, [a, b]] of parts.entries()) {
    const dur = Math.round(((b - a) / speed) * 100) / 100;
    const inPart = (t) => (t - a) / speed;
    // A line that runs on past the part's end stays fully up to it, so the dissolve hands it over unbroken; a band
    // that starts the journey is already up as the page fades in, so the app's header never shows (Fable, Nov 15).
    // A line (not the band under it) that runs across a dissolve goes out before it and the next comes in after it,
    // so the two never print over each other.
    const last = i === parts.length - 1;
    const ns = notes.filter(([, on, off]) => off > a && on < b).map(([pic, on, off, band]) => [pic, on <= a ? (band || i === 0 ? -0.45 : 0.5) : inPart(on), off >= b ? (band || last ? dur + 0.45 : dur - 0.35) : inPart(off)]).filter(([, on, off]) => off - Math.max(on, 0) >= 0.5); // a line that only grazes the part is left out
    const cs = cards.filter(([, on, off]) => off > a && on < b).map(([pic, on, off]) => [pic, inPart(on), inPart(off)]);
    const darkAt = !cuts.length && DIP_AT && DIP_AT > a && DIP_AT < b ? { darken: [inPart(DIP_AT), 0.3] } : {};
    const lifting = LIFT && liftAt < b ? { lift: [LIFT, inPart(liftAt), 1.6] } : {};
    // On a computer the drawing comes up centred on black, away from where the dress stood beside the steps, so a
    // dissolve would show two dresses: it goes through a short fade to black instead.
    pieces.push(await piece({ shot: 'style', from: a, dur, speed, cam: [[0, ...camAt(a)], [dur, ...camAt(b)]], fadeIn: i === 0 ? 0.5 : black[i - 1] ? 0.4 : 0, fadeOut: last ? 0 : black[i] ? 0.4 : 0, notes: ns, cards: cs, ...darkAt, ...lifting }));
  }
  let out = pieces[0];
  for (const [i, p] of pieces.slice(1).entries()) out = await dissolve(out, p, black[i] ? 0.04 : 0.6);
  return out;
};
// Cat (2026-10-22): the cream pattern paper was too bright after the black pages; a deeper champagne here.
// Wide: from the moment the pattern is up, slowed a touch to fill its time (Cat, 2026-10-22: the drawing flashed before it).
// On a phone the sheet rises the last part of the journey, to sit just under 'Your pattern, in seconds.'
const LIFT = 0; // no lift on a phone either now the pattern sheet dissolves in: it cut the Fabric step's swatches and Review button in half (Nov 18 walk)
const PATTERN = WIDE
  ? { from: 1.1, dur: 3.0, speed: 0.8, zoom: [1.6, 1.64], at: [0.36, 0.555], frame: [0.14, 1.1, -0.1, 1.1, 0.002] }
  // Drawn in close so the pieces fill the screen, the steps under the sheet masked off (Cat, 2026-10-29), right up to
  // the sheet's foot, so no view switch or step bar shows under it (Cat, 2026-11-08: cut-off app text).
  // The sheet is chalk now (Nov 14), so it is shown as the app draws it, not toned down, and masked just above the
  // view switches, which sit closer under it.
  : { from: 1.1, dur: 3.2, speed: 0.75, zoom: [2.5, 2.56], at: [0.5, 0.425], frame: [0.12, 0.98, -1, 2, 0.002] };
// On a phone the whole sheet of pages shows, opened under See the pages, the words round it in black (Cat, 2026-10-24:
// 1.6 was too close).
// On a phone the sheet of pages is thin champagne lines on black; lifted so they read (walkthrough, 2026-10-24).
// On a computer the pattern pages sit at the top of Print, beside the summary (Nov 14): the take's first second,
// before it scrolls, drawn in slowly.
const PAGES = { shot: 'print', from: 5.2, speed: 0.75, ...(WIDE ? { from: 0, speed: 0.25, zoom: [1, 1.05], at: [0.5, 0.4], bold: true } : { zoom: [1.08, 1.12], at: [0.5, 0.36], frame: [0.155, 0.62], tint: [1.4, 1.4, 1.4] }) };
// Cat picked P2 (2026-10-25): on a phone the sheet fills the height of the screen, and the camera drifts slowly from
// the left pieces to the right ones, eased at each end. Drawn from the sharp picture of the sheet the recorder takes.
const SHEET = join(SHOTS, 'print-sheet.png');
// On a computer the sheet is wider than tall against a wide frame, so it fills the width and drifts from its top
// pieces down to its foot instead (Fable's review, Nov 15: a still shot of the whole Print page read as clutter).
function sheetPan(dur) {
  const out = join(work, 'sheet-pan.mp4');
  const u = `(0.5-0.5*cos(PI*min(1,t/${dur})))`;
  // On a phone the sheet sits under the line over it (Cat, Nov 18: "Print your pattern," above the pages).
  // On a phone drawn in closer, the sheet taller than the space under the line, its foot running off the screen as it
  // drifts across (Cat, Nov 21: zoom in more and move across the page).
  const th = Math.round(H * (WIDE ? 0.92 : 1.02) / 2) * 2;
  const m = Math.round(W * 0.04);
  const tw = Math.round(W * 0.84 / 2) * 2;
  const [fit, x, y] = WIDE
    ? [`scale=${tw}:-2:flags=lanczos`, String((W - tw) / 2), `if(gt(overlay_h+${2 * m},${H}),${m}-(overlay_h+${2 * m}-${H})*${u},(${H}-overlay_h)/2)`]
    : [`scale=-2:${th}:flags=lanczos`, `${m}-(overlay_w+${2 * m}-${W})*${u}`, String(Math.round(H * 0.17))];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=black:s=${W}x${H}:d=${dur + 0.5}:r=${FPS}`, '-loop', '1', '-framerate', String(FPS), '-t', String(dur + 0.5), '-i', SHEET,
    '-filter_complex', `[1:v]erosion,${fit}[s];[0:v][s]overlay=x='${x}':y='${y}':shortest=1,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', out]);
  return out;
}
// The sheet is shown in the app's own chalk, not lifted to white, and its lines thickened so they read at film size
// (Cat, Nov 15: a little darker, like the All round's chalk, and clearer lines).
// On a computer the sheet drifts up under a black band, so it never runs under the line over it (Nov 18).
const pages = (dur, fades) => (existsSync(SHEET) ? piece({ src: sheetPan(dur), dur, ...(WIDE && fades.notes ? { frame: [0.17, 1.1, -1, 2, 0.02] } : {}), ...fades }) : piece({ ...PAGES, dur, ...fades }));
// The Print climax (the critic's review, Nov 16: show the pattern being drafted from her body): her numbers come
// up, then the pattern's own pieces, as the app drew them for her (draft.svg, kept by record-tour-shots.mjs), are drawn
// line by line in the film's champagne on black, outlines first, then the inner lines, the piece names last.
// Rendered frame by frame, so every line is sharp and the timing exact.
const DRAFT = join(SHOTS, 'draft.svg');
const NUMBERS = [['Waist', 62], ['Bust', 82], ['Hips', 90], ['Length', 112], ['Height', 176]];
async function draftFilm(dur) {
  const svg = readFileSync(DRAFT, 'utf8');
  const frames = Math.round(dur * FPS);
  const dir = mkdtempSync(join(work, 'draft-'));
  const nums = NUMBERS.map(([l, v], i) => `<div class="dn" data-i="${i}"><span class="k">${l}</span><b>${v}</b></div>`).join('');
  await page.evaluate(([css, h]) => {
    document.head.querySelectorAll('style[data-edit]').forEach((x) => x.remove());
    const st = document.createElement('style'); st.dataset.edit = '1'; st.textContent = css; document.head.appendChild(st);
    document.body.innerHTML = h;
  }, [CSS + `html,body{background:#000!important}
    .dr{position:fixed;inset:0;display:flex;${WIDE ? 'flex-direction:row;align-items:center;justify-content:center;gap:56px' : 'flex-direction:column;align-items:center;justify-content:center;gap:20px;padding-top:40px'}}
    .dr svg{${WIDE ? 'height:700px;width:auto' : 'width:410px;height:auto'};--paper:transparent;--ink:#d9c49b;overflow:visible}
    .dr svg polygon{stroke-width:${WIDE ? 0.32 : 0.42}px}.dr svg polyline{stroke-width:${WIDE ? 0.2 : 0.26}px}
    .dr svg text{fill:#d9c49b!important;stroke:none!important;opacity:0}
    .dns{display:flex;${WIDE ? 'flex-direction:column;gap:22px;width:200px' : 'flex-direction:row;gap:16px'}}
    .dn{display:flex;flex-direction:column;gap:6px;opacity:0;${WIDE ? '' : 'align-items:center'}}
    .dn b{font:500 ${WIDE ? 40 : 22}px/1 'Instrument Sans',sans-serif;color:#efe4cc}
    .dn .k{font-size:${WIDE ? 11 : 8}px}`, `<div class="dr"><div class="dns">${nums}</div>${svg}</div>`]);
  await page.evaluate(() => document.fonts.ready);
  // Each line's length, so it can be drawn from its start; the outlines (polygons) first, then the inner lines.
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('.dr svg polygon'), ...document.querySelectorAll('.dr svg polyline')];
    els.forEach((el, i) => { const len = el.getTotalLength(); el.dataset.len = String(len); el.dataset.i = String(i); el.style.strokeDasharray = `${len} ${len}`; el.style.strokeDashoffset = String(len); el.style.fillOpacity = '0'; });
    window.__draftCount = els.length;
  });
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    await page.evaluate(([t, dur]) => {
      const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      // The numbers come up one by one over the first second.
      document.querySelectorAll('.dn').forEach((d) => { d.style.opacity = String(ease((t - 0.15 - Number(d.dataset.i) * 0.18) / 0.35)); });
      // The lines draw from 1.1 s to 1.4 s before the end, each starting a little after the one before.
      const a = 1.1, z = dur - 1.4, n = window.__draftCount;
      document.querySelectorAll('.dr svg polygon, .dr svg polyline').forEach((el) => {
        const i = Number(el.dataset.i), len = Number(el.dataset.len);
        const start = a + ((z - a) * 0.55 * i) / n, p = ease((t - start) / ((z - a) * 0.45));
        el.style.strokeDashoffset = String(len * (1 - p));
      });
      document.querySelectorAll('.dr svg text').forEach((el) => { el.style.opacity = String(ease((t - z + 0.2) / 0.6)); });
    }, [t, dur]);
    await page.screenshot({ path: join(dir, `f${String(f).padStart(4, '0')}.png`) });
  }
  const out = join(work, `draft-${k}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-vf', `scale=${W}:${H},format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-r', String(FPS), out]);
  rmSync(dir, { recursive: true, force: true });
  return out;
}
const DRAFT_DUR = 5.4;
const draftMoment = async () => piece({ src: await draftFilm(DRAFT_DUR + 0.5), dur: DRAFT_DUR, fadeIn: 0.4, fadeOut: 0.5, notes: [[await note(WIDE ? 'Your numbers become your pattern.' : 'Your numbers,<br>your pattern.', 'low', false), 0.3, DRAFT_DUR - 0.2]] });
// Cat's B Three Checks (2026-10-22): what All round is for, a line at a time over the turning form. On a phone under
// the hem; on a computer to the left of the form. All round is filmed on black (Cat, Nov 15), so the words are the
// film's own gold. Each line is its own picture, all laid out together so they stack in place.
async function threeChecks() {
  const lines = ['Seams meet.', 'Hem sits level.', 'Before you cut.'];
  const size = WIDE ? 54 : 36;
  const pics = [];
  for (let i = 0; i < lines.length; i++) {
    // The first line in the narration's blush, the others champagne (Cat's B2, first line, Nov 22).
    const h = lines.map((l, j) => `<h1 class="t" style="font-size:${size}px;margin:0 0 10px;opacity:${j === i ? 1 : 0}${j === 0 ? ';color:#f2c2b8' : ''}">${l}</h1>`).join('');
    pics.push(await words(WIDE
      ? `<div class="f" style="display:flex;flex-direction:column;justify-content:center;padding-left:96px"><div>${h}</div></div>`
      : `<div class="f" style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;padding:0 28px 86px${i === 0 ? ';background:linear-gradient(to top,rgba(0,0,0,.85) 0,rgba(0,0,0,.7) 22%,rgba(0,0,0,0) 40%)' : ''}"><div>${h}</div></div>`)); // a little closer under the dress (Cat, Nov 18); a shade under them, now the dress comes in close behind (R1, Nov 22)
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
// V5 (Cat, 2026-11-06), blush and bolder since Nov 18: 32px here on a phone (80px on the 1080-wide film), 37px on the
// computer's; the two-line phone captions are joined into one.
// A phone line too long for one line keeps its break, rather than run off the screen (Nov 18: Cat's longer lines).
const note = (line0, where, shade = true) => {
  const one = line0.replace(/<br>/g, ' ');
  const line = WIDE || one.length <= 28 ? one : line0;
  return words(WIDE && where === 'side'
  ? `<div class="f" style="display:flex;flex-direction:column;justify-content:center;padding-left:96px;background:linear-gradient(to right,rgba(0,0,0,.85) 0,rgba(0,0,0,.6) 30%,rgba(0,0,0,0) 42%)"><h1 class="n" style="font-size:37px">${line}</h1></div>`
  : WIDE
  ? `<div class="f" style="${shade ? 'background:linear-gradient(to bottom,#000000 0,#000000 15.5%,rgba(0,0,0,0) 21%);' : ''}padding:${where === 'low' ? 54 : 44}px 0 0 96px"><h1 class="n" style="font-size:37px">${line}</h1></div>`
  : `<div class="f" style="${shade ? 'background:linear-gradient(to bottom,#000000 0,#000000 14.5%,rgba(0,0,0,0) 19%);' : ''}padding:${where === 'low' ? 44 : 38}px 0 0 22px"><h1 class="n" style="font-size:32px">${line}</h1></div>`);
};
// The scroll down the collection's looks, the way down to Print my pattern, and projector mode, as recorded
// (record-tour-shots.mjs: the phone's scrolls are longer).
const COLLECTION = WIDE ? { from: 4.7, dur: 3.2, speed: 0.65, zoom: [1, 1.03], at: [0.5, 0.5] } : { from: 4.6, dur: 4.4, speed: 0.85, drop: 0.05, frame: [0.21, 1.1] }; // shorter at the same slow speed (Cat, Nov 18) // slower again (Cat, Nov 18: the scroll through the collection went too fast) // from the first look, past the page's own title and words (Cat, Nov 17: the line and the app's headings competed) // drawn in on a computer (the critics' reviews, Nov 16: 8 s was long, half the frame empty); slower, so two or three looks can be seen (critic, Nov 17) // on a phone the band above the look is kept black, so Make this look never shows behind the words as the page scrolls (Fable, Nov 15)
// The garment grid drawn in a little and sitting right under its line, the page's question left out in the take
// (Cat, Nov 18: bigger, less empty black); then the Style page's drawing window alone, for the dress the pick opens.
const CHOOSE_IN = WIDE ? { zoom: [1.12, 1.12], at: [0.5, 0.462], frame: [0.18, 1.1, -1, 2, 0.02, 0.03] } : { zoom: [1.08, 1.08], at: [0.5, 0.463], frame: [0.17, 1.1, -1, 2, 0.02, 0.03] };
const DRESS_WINDOW = WIDE ? [0.22, 0.9, 0.05, 0.665, 0.02, 0.02] : [0.205, 0.655, -1, 2, 0.02, 0.02];
// A computer has no Review page to scroll (Print my pattern sits beside the drawing), so its projector runs longer.
// Print opens straight on the pattern pieces' sideways scroll, no Review page first (Cat, 2026-11-06), so on a phone
// too there is nothing here; REVIEW=1 brings the scroll down the Review page back.
const REVIEW = WIDE || process.env.REVIEW !== '1' ? undefined : { from: 0.4, dur: 4.4, speed: 1.15 };
// Straight from the pages to a piece on black in projector mode, drawn in close so it fills the screen (Cat,
// 2026-10-29: skip the second scroll down the print page; less blank space). On a phone it sits low and large, its
// foot level with the pattern sheet's (Cat, 2026-10-30: it was cut off under the words).
// On a computer the piece is projected at the right of the screen: drawn in on it, the dart in view (Nov 14).
// On a phone the piece is moved down off camera so its top shows, then framed on the whole piece, with just the line's
// room above it (Cat, Nov 15: no empty black over it, no foot cut off), and the app's ring at the top right left out.
// On a computer, the whole piece too, beside the line (Fable, Nov 15: it was cut off at the foot).
// The computer's piece sits at the right of the screen: drawn in on it, past the toolbar and the corner ring; the
// phone's ring at the right edge is masked (Fable's review, Nov 15).
const PROJECTOR = WIDE ? { from: Number(process.env.PJ_FROM ?? 10.0), dur: 4.2, zoom: [1, 1.02], at: [0.5, 0.35], pan: 0.33, frame: [-0.1, 0.86, -1, 2, 0.03, 0.08] } /* the piece brought to the middle, the bottom fading out above the tools (Nov 18 walk: it sat at the right edge, cut off) */ : { from: Number(process.env.PJ_FROM ?? 11.1), dur: 4.8, zoom: [1.06, 1.08], at: [0.45, 0.4], frame: [-0.1, 0.8, -0.1, 0.95, 0.03, 0.04] }; // smaller again and held longer, its top clear (Cat, Nov 21: still too big, cut off at the top) // smaller on a phone, its top clear of the words (Cat, Nov 18: it got covered by the narration)
// Phone: drawn in a little less and set lower, so the piece sits whole under its two lines of words (Cat, 2026-11-06:
// cut off by the words at the top).
async function photoMoment(line = 'Start from a photo.', lineEnd = 4.1) {
  // Her own dress's photo in the champagne Polaroid, 'That dress' on its strip (Cat's P2, 2026-10-30, back on Nov 17).
  // Nothing blurred over it, no scanning line and no words under it (Cat, Nov 17); centred in the screen (Cat, Nov 18:
  // set lower to clear the line, it sat too low).
  const photo = readFileSync(resolve('scripts/tour/photo-python-dress.jpg')).toString('base64');
  const k = WIDE ? 1.15 : 1;
  const pic = await words(`<div class="f" style="display:flex;align-items:center;justify-content:center"><div style="background:#efe4cc;padding:${16 * k}px ${16 * k}px ${64 * k}px;box-shadow:0 12px 28px rgba(0,0,0,.6);position:relative"><img src="data:image/jpeg;base64,${photo}" style="display:block;width:${300 * k}px;height:${400 * k}px;object-fit:cover"><div style="position:absolute;left:0;right:0;bottom:${24 * k}px;text-align:center;font:400 ${12 * k}px/1 'Chakra Petch',monospace;letter-spacing:.3em;text-transform:uppercase;color:#6b5a3a">That dress</div></div></div>`, { solid: true });
  return piece({ still: pic, dur: 4.4, zoom: [1, 1.03], fadeIn: 0.5, fadeOut: 0.5, notes: [[await note(line, 'low'), 0.2, lineEnd]] }); // 4.4 s, long enough to read the line (Cat, Nov 21)
}
async function shopMoment() {
  // The Fabric step's own partner-shop list for the silk picked, gliding down through the swatches (Cat, Nov 14: all
  // literal matches, in place of the strip of cards the film drew). Recorded by record-tour-shots.mjs (shop.mp4).
  // On a computer the list is the narrow column beside the drawing, and the drawing is scrolled away under it: drawn
  // in on the list (a close-up, Cat Nov 14).
  return piece({ shot: 'shop', from: 0.3, dur: 4, ...(WIDE && { zoom: [2.1, 2.1], at: [0.82, 0.5] }), fadeIn: 0.5, fadeOut: 0.5, notes: [[await note('Shop the fabric.', 'low'), 0.2, 4.45]] }); // the line goes with the picture, not before it (Fable, Nov 15); 4 s, not 7 (the critic's review, Nov 16)
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
  // O1 Gentle Glide (Cat, 2026-11-08): the take moves from its first frame, and so does the film; the app draws the
  // same frames itself from the tap until the film is ready (TourPlayer, filmOpening.ts). Before: the film started
  // once the page's words had gone (1.9 s into the take), the form still at rest: the app laid it
  // over its own page's form and dissolves in (TourPlayer), so the opening carries on from whichever page the play
  // button was on, and the one push in starts from there (Cat, 2026-11-07).
  // tint: the film's thin lines come out paler and whiter than the page draws them (the video's colour is kept at half
  // size, so a hairline loses its champagne), which showed as the film took over from the page (Cat, 2026-11-07: "too
  // white"). Measured on an iPhone: the page's lines against the film's, channel by channel. A computer's browser
  // shows the film a little darker than an iPhone does, so the computer film is taken down only half as far.
  W: async () => [await piece({ shot: 'welcome', from: 0, dur: 3.9, fadeOut: 0.6, tint: WIDE ? [0.94, 0.9, 0.8] : [0.87, 0.835, 0.75], over: await title(), overAt: 0.9, overIn: 0.8 })], // the title sooner and the whole opening quicker (Cat, Nov 18)
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
    // Chapter 1 shows the measuring itself (Cat, Nov 16: "There is no chapter 1"). The times come from the take's
    // tape-marks.json (record-tour-shots.mjs).
    // OPENER_FILM=<walkthrough.mp4> keeps a released film's opening shot and Measure card frame for frame (Cat,
    // 2026-10-24: "go back to that other version exactly"): its first 5.6 s, fades and title already in them.
    const released = process.env.OPENER_FILM ? resolve(process.env.OPENER_FILM) : undefined;
    const marksFile = join(SHOTS, 'tape-marks.json');
    if (!existsSync(marksFile)) throw new Error(`${marksFile} is missing: record the tape shot again (record-tour-shots.mjs writes it)`);
    const T = JSON.parse(readFileSync(marksFile, 'utf8'));
    // Only the marks the cut uses: the waist and the Next past the hips page.
    const lost = ['waist', 'next-2'].filter((m) => typeof T[m] !== 'number');
    if (lost.length) throw new Error(`the tape take stopped early: no ${lost.join(', ')} in ${marksFile}`);
    const span = (from, to, speed) => ({ from, dur: Math.round(((to - from) / speed) * 10) / 10, speed });
    // Each part ends as its last Next is pressed and the page turns, so a line never sits over the next page (the
    // critic's review, Nov 16); the optional weight page is left out.
    const turn = (n) => T[`next-${n}`] + 0.45;
    // Just the form taking the body's shape, the tape round the waist, bust and hips in one run, with the app's own
    // words, numbers and buttons masked off, and one line over it (Cat, Nov 17: "we don't need to show all the
    // measurements going in"; the narration competed with the app text). The length, height and check pages are left out.
    // The waist close-up Cat liked (Nov 18), its number typed in under the tape (the recorder leaves the page's other
    // words out), with a line over it; then the app's own Do these look right? page, every number together, its
    // heading and Weight row masked, under the second line (Cat, Nov 18: "Measure section does need narration").
    const WAIST_IN = WIDE ? { zoom: [1, 1.03], at: [0.5, 0.5], frame: [0.18, 1.1, -0.1, 1.1, 0.04, 0.03] } : { zoom: [1.2, 1.23], at: [0.46, 0.45], frame: [0.16, 0.9, -1, 0.94, 0.04, 0.04] }; // the cm/in switch cut at the right edge masked; on a phone drawn in closer, nearer the size of the opening's form, as far as the typed number allows (Cat, Nov 18: no jarring jump)
    // From the tape round the waist to the number in, ending just before Next is pressed: the recorder holds the
    // number in the take itself, so there is no slowed hold to cut to (Cat, Nov 18: a jarring skip as it went in).
    const WAIST = span(T.waist + 0.5, T['next-0'] - 0.15, 1);
    const said = await note(WIDE ? 'Enter your measurements, just once.' : 'Enter your measurements,<br>just once.', 'low');
    const shaping = await piece({ shot: 'tape', ...WAIST, ...WAIST_IN, fadeIn: 0.5, notes: [[said, 0.3, WAIST.dur + 1]] });
    const CHECK_IN = WIDE ? { zoom: [1.6, 1.63], at: [0.5, 0.5], frame: [0.17, 0.7, 0.18, 0.82, 0.03, 0.02] } : { zoom: [1.12, 1.14], at: [0.5, 0.5], frame: [0.3, 0.705, -1, 2, 0.03, 0.02] };
    const CHECK = { from: (T.check ?? T.end - 2.6) + 0.9, dur: 3.4, speed: 0.6 };
    const drafted = await note(WIDE ? 'Every pattern is drafted from your numbers.' : 'Every pattern is drafted<br>from your numbers.', 'low');
    // Every measurement the dress is drafted from, the app's Your measurements page gliding down (Cat, Nov 18: show
    // more than the first five); the Do these look right? page when the take has no list.
    const LIST = join(SHOTS, 'list.mp4');
    // The whole list fits a screen, so the take is a short still: slowed to be read, drawn in under the line, and the
    // row offering more measurements masked (no count of measurements anywhere, Cat, Nov 17).
    const LIST_IN = WIDE ? { zoom: [1.2, 1.22], at: [0.5, 0.425], frame: [0.18, 0.915, -1, 2, 0.02, 0.02] } : { zoom: [1, 1.02], at: [0.5, 0.45], drop: 0.05, frame: [0.18, 0.84, -1, 2, 0.02, 0.015] };
    // Drawn in close and moving slowly down the list, held 5.5 s so the line can be read (Cat, Nov 21: closer, and
    // scrolling for interest).
    const listDur = existsSync(LIST) ? 5.5 : 0;
    const LIST_CAM = WIDE ? undefined : [[0, 1.12, 0.5, 0.38], [listDur, 1.12, 0.5, 0.54]]; // stops above the row offering more measurements (no count shown)
    const checked = listDur
      ? await piece({ shot: 'list', from: 0.5, dur: listDur, speed: Math.min(1, (length(LIST) - 0.6) / listDur), ...LIST_IN, ...(LIST_CAM && { cam: LIST_CAM }), fadeOut: f, notes: [[drafted, 0.3, listDur - 0.3]] })
      : await piece({ shot: 'tape', ...CHECK, ...CHECK_IN, fadeOut: f, notes: [[drafted, 0.3, CHECK.dur - 0.3]] });
    const measuring = [
      // A released opening (OPENER_FILM) already ends on its own Measure card. No count of measurements: it can be
      // many more than five (Cat, Nov 17).
      released ? shaping : await dissolve(await dissolve(await piece({ still: await card('01', 'Measure'), dur: 2.2, fadeIn: f, fadeOut: 0.5 }), shaping, 0.04), checked, 0.5),
    ];
    // No title card before chapter 1 (Cat, Nov 17: take out this screen): How it works goes straight to Measure.
    const opening = [
      ...(released ? [await piece({ shot: 'round', src: released, from: 0, dur: 5.6 })] : await INTROS[INTRO]()),
      ...measuring,
    ];
    // TOUR_PREVIEW=1 stops after the opening and the tape, to try an opening without cutting the whole film.
    if (process.env.TOUR_PREVIEW) return opening;
    return [
      ...opening,
      await piece({ still: await card('02', 'Choose'), dur: 2.4, fadeIn: f, fadeOut: f }),
      // Three ways in, in the order Cat set (Nov 18): design your own, a collection, then a photo, the way the film's
      // own journey goes, so the photo leads straight into Style. One sentence across the three lines, each word
      // after the first in lower case. No close-up of the dress on the form after the photo (Cat, Nov 18: take it out).
      // The garment screen up to the pen's tap on Dress, then the moment Dress fills champagne held a beat: the app
      // moves on in a fifth of a second, too quick to see the pick (Cat, Nov 17: show the selection intentionally).
      // CHOOSE_PICK: shot time Dress fills (found in the take).
      // Design your own garment, as the app does it (Cat picked Something else, Nov 22): the grid, Something else
      // tapped, the idea typed in a little quicker than life, then the app's answer, We can make that, held 5 s to be
      // read. Times from the take's choose-marks.json; a take without them (TOUR_GRID=1) cuts the old grid and Dress.
      ...await (async () => {
        const said = await note(WIDE ? 'Design your own garment,' : 'Design your own<br>garment,', 'low');
        const look = CHOOSE_IN;
        const CM = join(SHOTS, 'choose-marks.json');
        if (existsSync(CM)) {
          const C = JSON.parse(readFileSync(CM, 'utf8'));
          const grid = span(0.3, C.type, 1);
          const typing = span(C.type, C.answer - 0.1, 1.7);
          const answer = { from: C.answer - 0.1, dur: 5, speed: 1 };
          return [
            await piece({ shot: 'choose', ...grid, ...look, fadeIn: f, notes: [[said, 0.2, grid.dur + 1]] }),
            await piece({ shot: 'choose', ...typing, ...look, notes: [[said, -1, typing.dur + 1]] }),
            await piece({ shot: 'choose', ...answer, ...look, fadeOut: f, notes: [[said, -1, answer.dur - 0.3]] }),
          ];
        }
        const pick = Number(process.env.CHOOSE_PICK ?? (WIDE ? 1.36 : 1.34));
        const run = span(0.3, pick, 0.6);
        const hold = await piece({ shot: 'choose', from: pick + 0.02, dur: 2.6, speed: 0.05, ...look, notes: [[said, -1, 2.6]] });
        const drawing = await piece({ shot: 'style', from: 0.2, dur: 3.0, speed: 0.4, frame: DRESS_WINDOW, fadeOut: 0.7, notes: [[said, -1, 2.3]] });
        return [
          await piece({ shot: 'choose', ...run, ...look, fadeIn: f, notes: [[said, 0.2, run.dur + 1]] }),
          await dissolve(hold, drawing, 1.8),
        ];
      })(),
      await piece({ shot: 'collection', ...COLLECTION, fadeIn: f, fadeOut: f, notes: [[await note(WIDE ? 'choose from a collection,' : 'choose from<br>a collection,', 'low'), 0, COLLECTION.dur - 0.3]] }),
      await photoMoment('or start with a photo.'),
      await piece({ still: await card('03', 'Style'), dur: 2.4, fadeIn: f, fadeOut: f }),
      // Done lands on the pattern sheet, so the pattern follows straight on, then the dress all round (Cat,
      // 2026-10-24: no flash back to the dress between them), each dissolving into the next.
      // Shop the fabric sits with Style, straight after the dress is styled (Cat, 2026-11-02: not after the
      // pattern and All round, next to Print).
      // No pattern sheet after the shop (Cat, Nov 15: cut it, the print pages show the pattern).
      // The drawn hem, then the pattern it redrew (the critic's review, Nov 16: "the pattern follows" was said, not shown).
      // Shop the fabric is left out (Cat, Nov 17: cut it; the cloth is chosen by then and it broke the build to the
      // dress all round), the pattern going straight on to the dress turning. TOUR_SHOP=1 puts it back.
      // No fade in on the pattern (nor out, when the shop follows): a fade inside a dissolve dips it to black.
      existsSync(PIECES_MARKS) ? await dissolve(await styleJourney(), await piecesMoment(), 0.6) : process.env.TOUR_SHOP !== '1' ? await dissolve(await styleJourney(), await patternMoment({ dur: 2.6, fadeIn: 0, line: 'The pattern follows.' }), 0.4) : await dissolve(await dissolve(await styleJourney(), await patternMoment({ dur: 2.4, fadeIn: 0, fadeOut: 0, line: 'The pattern follows.' }), 0.4), await shopMoment(), 0.6),
      // The All round comes up from black after the pattern, so the turning dress never shows through the sheet.
      // On black (Cat, Nov 15: keep All round on a black background); on a phone lifted in the cut, so its legs clear
      // the three lines under it.
      // Drawn in closer on her dress so the print and cut fill the screen (Nov 17: the teal python follows a dress of Cat's own; the critic saw it small).
      // The whole turn, at the speed it was recorded (Cat, Nov 18: slow down the spin), so it ends facing front as the
      // real dress does; held whole in frame, hem and
      // all, with the words beside it on a computer and under its hem on a phone (the critic's review, Nov 17).
      beats.turn = await piece({ shot: 'round', from: 0.3, dur: 8.8, speed: 1, fadeIn: 0.6, fadeOut: f, ...(WIDE ? { zoom: [1.12, 1.12], at: [0.38, 0.5] /* set right of the words: Before you cut. touched the sleeve (Nov 18) */ } : { zoom: [1, 1.03], at: [0.5, 0.45], lift: [0.12, -1, 0.001] }), overs: (await threeChecks()).map((p, i) => [p, 1 + i * 2.2]) }),
      // Print and the ending as in the Nov 15 film Cat liked (Cat, Nov 17: start from it, change only what she asked).
      await piece({ still: await card('04', 'Print'), dur: 2.4, fadeIn: f, fadeOut: f }),
      ...(REVIEW ? [await piece({ shot: 'review', ...REVIEW, fadeIn: f })] : []),
      await pages(5.4, { fadeIn: f, fadeOut: f, notes: [[await note('Print your pattern,', 'low'), 0.3, 5.1]] }),
      await piece({ shot: 'projector', ...PROJECTOR, fadeIn: f, fadeOut: f, notes: [[await note(WIDE ? 'or project it, true size.' : 'or project it,<br>true size.', 'low', !WIDE), 0.3, PROJECTOR.dur - 0.3]] /* on a computer no dark band, which hid the piece's shoulder */ }),
      // REAL_END=1 closes on her real dress instead (the dress turning dissolving into it), once the shoot's clip is in.
      ...(process.env.REAL_END === '1'
        ? [beats.end = await dissolve(await piece({ shot: 'round', from: 9.6, dur: 3.4, speed: 0.6, fadeIn: 0.8, ...(WIDE ? { zoom: [1.05, 1.08], at: [0.62, 0.5] } : { zoom: [1.12, 1.16], at: [0.5, 0.38] }) }), await realDress(), 1.4)]
        // E3 (Cat, Nov 22): the title over the dress still turning, faded back, so the last thing seen is the garment;
        // its first word in blush, as on the three lines (B2). No line under it.
        : [beats.end = await piece({ shot: 'round', from: 8.6, dur: 4.5, speed: 0.6, tint: [0.36, 0.36, 0.36], ...(WIDE ? { zoom: [1.05, 1.08], at: [0.62, 0.5] } : { zoom: [1.12, 1.16], at: [0.5, 0.38] }), fadeIn: 0.8, fadeOut: 1.2, over: await words(`<div class="f mid"><h1 class="t" style="font-size:${HEAD}px"><span style="color:#f2c2b8">Drafted</span><br>to your body</h1></div>`), overAt: 0.6, overIn: 0.8 })]),
      await piece({ still: await endCard(), dur: 4, fadeIn: 0.8, fadeOut: 0.8 }), // a second longer, so the ending lands (Fable's review, Nov 15)
    ];
  },
};

// The real dress: Cat's own clip (scripts/tour/dress-real.mp4) if there is one, else her photo
// (scripts/tour/photo-python-dress.jpg) drifting slowly closer, framed on its own wall softened and darkened, with the
// last words beside it on a computer and under it on a phone.
const REAL_CLIP = resolve('scripts/tour/dress-real.mp4');
const REAL_PHOTO = resolve('scripts/tour/photo-python-dress.jpg');
async function realDress(dur = 5.2) {
  const framed = join(work, 'real-dress.png');
  // On a computer the dress sits left of centre, the words to its right; on a phone it fills the width above them.
  const fit = WIDE ? `scale=-2:${H}` : `scale=${W}:-2`;
  const place = WIDE ? `overlay=x=${Math.round(W * 0.34)}-w/2:y=0` : 'overlay=x=0:y=(H-h)/2-140';
  // The clip is framed the same way as the photo: piece() stretches whatever it is given to the film's shape, so a
  // phone clip on the wide film (or a wide one on the tall film) would be squashed.
  const clip = existsSync(REAL_CLIP);
  const framedClip = join(work, 'real-dress.mp4');
  const frameIt = `[0:v]split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.32:saturation=0.6[bg];[b]${fit}[fg];[bg][fg]${place}`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', clip ? REAL_CLIP : REAL_PHOTO, '-filter_complex', frameIt, ...(clip ? ['-an', '-t', String(dur + 0.5), framedClip] : ['-frames:v', '1', framed])]);
  const words2 = await words(`<div class="f mid" style="display:flex;${WIDE ? 'padding-left:48%;background:linear-gradient(to right,rgba(0,0,0,0) 30%,rgba(0,0,0,.6) 60%)' : 'justify-content:flex-end;padding-bottom:70px;background:linear-gradient(to top,rgba(0,0,0,.92) 0,rgba(0,0,0,.85) 24%,rgba(0,0,0,0) 42%)'}"><h1 class="t" style="font-size:${HEAD}px">Drafted<br>to your body</h1><p class="l" style="margin-top:18px">Begin with your measurements.</p></div>`);
  return clip
    ? piece({ src: framedClip, dur, fadeOut: 1.2, over: words2, overAt: 0.9, overIn: 0.8 })
    : piece({ still: framed, dur, zoom: [1, 1.05], at: WIDE ? [0.34, 0.45] : [0.5, 0.4], fadeOut: 1.2, over: words2, overAt: 0.9, overIn: 0.8 });
}

// ONLY=shop cuts just the Shop the fabric moment, for checking it on its own; ONLY=pattern, the pattern moment.
// The take is 3.6 s; each PATTERN dur ends just inside it, so the fade out is seen.
// The pattern tools on her pieces (Cat, Nov 18: "or design straight from your pattern"): the bust dart moved to the
// shoulder, then a yoke cut off the back, from the recorder's pattern-marks.json.
const PIECES_MARKS = join(SHOTS, 'pattern-marks.json');
const piecesMoment = async () => {
  const M = JSON.parse(readFileSync(PIECES_MARKS, 'utf8'));
  // The finished pieces are held a little less than the take's end (Cat, Nov 18: hold here slightly less).
  // Quicker through the moves (Cat, Nov 21: the dart scene was too long), still long enough to read the line.
  const speed = 1.4;
  const run = { from: 0.4, dur: Math.max(5, Math.round(((M.end - 1.5 - 0.4) / speed) * 10) / 10), speed };
  // No shade under this line: the pieces sit below it on black, and a shade dulled the top of the paper.
  return piece({ shot: 'pattern', ...run, fadeIn: 0.5, fadeOut: f0, notes: [[await note(WIDE ? 'or design straight from your pattern.' : 'or design straight<br>from your pattern.', 'low', false), 0.3, run.dur - 0.3]] });
};
const f0 = 0.5;
const patternMoment = async ({ line = WIDE ? 'Your pattern, in seconds.' : 'Your pattern,<br>in seconds.', ...more } = {}) => piece({ shot: 'pattern', ...PATTERN, fadeIn: 0.4, fadeOut: 0.4, ...more, notes: [[await note(line, 'low', false), 0.3, (more.dur ?? PATTERN.dur) - 0.2]] });
const pieces = process.env.ONLY === 'real' ? [await realDress()] : process.env.ONLY === 'shop' ? [await shopMoment()] : process.env.ONLY === 'pattern' ? [await patternMoment()] : process.env.ONLY === 'draft' ? [await draftMoment()] : await CUTS.words();
await b.close();
writeFileSync(join(work, 'list.txt'), pieces.map((p) => `file '${p}'`).join('\n'));
const film = join(work, 'film.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-c', 'copy', film]);
const secs = length(film);
// Each piece's start in the film: the pieces before it, end to end (each measured once).
const lengths = pieces.map(length);
const startOf = (f) => { const i = pieces.indexOf(f); return i < 0 ? undefined : lengths.slice(0, i).reduce((a, n) => a + n, 0); };
const [turnAt, endAt] = [startOf(beats.turn), startOf(beats.end)];
// The music lifts a little into the dress turning all round, settles after it, and drops back under the last line,
// then fades right out to silence with the name (the critic's review, Nov 17).
const lift = turnAt === undefined ? '0' : `0.3*clip((t-${turnAt.toFixed(2)})/1.5,0,1)*(1-clip((t-${(turnAt + lengths[pieces.indexOf(beats.turn)] - 1).toFixed(2)})/1.5,0,1))`;
const hush = endAt === undefined ? '0' : `0.35*clip((t-${(endAt + 2.5).toFixed(2)})/2,0,1)`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', film, '-i', MUSIC, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-af', `volume='1+${lift}-${hush}':eval=frame,afade=t=in:d=0.4,afade=t=out:st=${(secs - 3.6).toFixed(2)}:d=3.4`, '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', OUT]);
// A WebM copy beside it, for browsers without H.264.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', OUT, '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-c:a', 'libopus', '-b:a', '96k', OUT.replace(/\.mp4$/, '.webm')]);
rmSync(work, { recursive: true, force: true });
console.log(`${OUT}: ${secs.toFixed(1)} s`);
