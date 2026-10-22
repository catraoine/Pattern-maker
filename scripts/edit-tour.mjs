// Cuts the How it works film from the shots scripts/record-tour-shots.mjs records, with its words set in the app's
// own type and the lofi track (scripts/tour-music.m4a) under it. Needs the app running (npx vite --port 5173) for
// the fonts, and ffmpeg. Usage: node scripts/edit-tour.mjs <shots dir> [out.mp4] [--wide]
// --wide cuts the computer's film from the shots record-tour-shots.mjs --wide records (Cat, 2026-10-22).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
const card = (kicker, title, line = '', size = WIDE ? 76 : 64) => words(`<div class="f mid"><div class="k">${kicker}</div><div class="r"></div><h1 class="t" style="font-size:${size}px">${title}</h1>${line ? `<p class="l" style="margin-top:18px">${line}</p>` : ''}</div>`, { solid: true });

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
async function piece({ shot, still, from = 0, dur, speed = 1, zoom = [1, 1], at = [0.5, 0.5], frame, tint, fadeIn = 0, fadeOut = 0, over, overIn = 0.4, overAt = 0 }) {
  const edge = frame ? await mask(frame) : undefined;
  const out = join(work, `p${String(k++).padStart(3, '0')}.mp4`);
  const frames = Math.round(dur * FPS);
  const args = ['-v', 'error', '-y'];
  if (still) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', still);
  else args.push('-ss', String(from), '-t', String(dur * speed + 0.5), '-i', join(SHOTS, `${shot}.mp4`));
  if (edge) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', edge);
  if (over) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', over);
  const oi = edge ? 2 : 1;
  const [z0, z1] = zoom;
  const z = `(${z0}+(${z1 - z0})*on/${frames})`;
  let v = `[0:v]setpts=(PTS-STARTPTS)/${speed},fps=${FPS},scale=${2 * W}:${2 * H},zoompan=z='${z}':x='max(0,min(iw-iw/zoom,${at[0]}*iw-iw/zoom/2))':y='max(0,min(ih-ih/zoom,${at[1]}*ih-ih/zoom/2))':d=1:s=${W}x${H}:fps=${FPS},trim=end_frame=${frames},setsar=1`;
  // tint: [r, g, b] multipliers, e.g. to take the cream pattern paper down to a deeper champagne.
  if (tint) v += `,colorchannelmixer=rr=${tint[0]}:gg=${tint[1]}:bb=${tint[2]}`;
  if (edge) v += `[raw];[raw][1:v]overlay=0:0:shortest=1`;
  if (over) v += `[base];[${oi}:v]format=rgba,fade=t=in:st=${overAt}:d=${overIn}:alpha=1[o];[base][o]overlay=0:0:shortest=1`;
  if (fadeIn) v += `,fade=t=in:st=0:d=${fadeIn}`;
  if (fadeOut) v += `,fade=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut}`;
  v += ',format=yuv420p[v]';
  execFileSync('ffmpeg', [...args, '-filter_complex', v, '-map', '[v]', '-frames:v', String(frames), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', String(FPS), out]);
  return out;
}

// Where to look in each shot: the drawing alone, framed in black (see mask).
// The dress filling with fabric: the drawing and the swatches tapped under it.
const FABRIC = WIDE ? { zoom: [1.05, 1.1], at: [0.45, 0.48], frame: [0.08, 1.05] } : { zoom: [1.12, 1.18], at: [0.5, 0.52], frame: [0.27, 0.8] };
// Cat (2026-10-22): the cream pattern paper was too bright after the black pages; a deeper champagne here.
const PATTERN = WIDE
  ? { from: 0.4, zoom: [1.6, 1.66], at: [0.42, 0.72], frame: [0.09, 1.05, 0.1, 0.92], tint: [0.84, 0.78, 0.66] }
  : { from: 1.1, zoom: [1.1, 1.14], at: [0.5, 0.56], frame: [0.305, 0.712], tint: [0.84, 0.78, 0.66] };
const PAGES = { shot: 'print', from: 5.2, speed: 0.75, frame: WIDE ? [0.08, 1.05] : [0.15, 0.87] };
const CUTS = {
  // V1 Chapter Words (Cat's pick, 2026-10-22): slow and cinematic, a word or two on a page between the moments;
  // Style is about the clothes: the collection, one of its pieces in fabric after fabric, then all round on you,
  // drawing closer as it turns (the recorder fills the screen with it; Cat, 2026-10-22).
  words: async () => {
    const f = 0.5;
    return [
      await piece({ still: await card('Maison Tracé', 'How it works'), dur: 3.6, fadeIn: 0.8, fadeOut: f }),
      await piece({ shot: 'form', from: 1.2, dur: 6.8, zoom: [1, 1.08], at: [0.5, 0.35], fadeIn: f, fadeOut: f }),
      await piece({ still: await card('01', 'Measure', 'Just a few, once.'), dur: 3, fadeIn: f, fadeOut: f }),
      await piece({ shot: 'tape', from: 0.3, dur: 8.7, fadeIn: f, fadeOut: f }),
      await piece({ still: await card('02', 'Choose', 'Then what to make.'), dur: 3, fadeIn: f, fadeOut: f }),
      await piece({ shot: 'choose', from: 0.3, dur: 3.2, fadeIn: f, fadeOut: f }),
      await piece({ still: await card('03', 'Style', 'Make it yours.'), dur: 3, fadeIn: f, fadeOut: f }),
      await piece({ shot: 'collection', from: 1, dur: 6, speed: 1.3, fadeIn: f, fadeOut: f }),
      await piece({ shot: 'fabric', from: 0.6, dur: 8.6, speed: 2.1, ...FABRIC, fadeIn: f, fadeOut: f }),
      await piece({ shot: 'round', from: 0.3, dur: 8.6, fadeIn: f, fadeOut: f }),
      await piece({ shot: 'pattern', dur: 3.6, ...PATTERN, fadeIn: f, fadeOut: f }),
      await piece({ still: await card('04', 'Print', 'At home, or full size.'), dur: 3, fadeIn: f, fadeOut: f }),
      await piece({ ...PAGES, dur: 4.4, fadeIn: f, fadeOut: f }),
      await piece({ still: await card('Maison Tracé', 'Drafted<br>to your body'), dur: 4.5, fadeIn: 0.8, fadeOut: 1.2 }),
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
