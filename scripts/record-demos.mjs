// Records the tools' Watch demo clips from the running app (npx vite --port 5173 first), with a caption under
// each step, into public/demos/<name>.mp4 and .webm. Prints where each part starts: copy those into DEMOS in
// src/ui/DemoButton.tsx. Usage: node scripts/record-demos.mjs public/demos [style|draw]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = process.argv[2] ?? 'public/demos';
const ONLY = process.argv[3];
const APP = 'http://127.0.0.1:5173';

const PAGE = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&family=Chakra+Petch&display=swap"><style>
html,body{margin:0;background:#000;overflow:hidden}
#app{position:fixed;left:0;top:0;width:432px;height:672px;border:0;border-bottom:1px solid rgba(239,228,204,.3)}
#cap{position:fixed;left:0;right:0;bottom:0;height:96px;box-sizing:border-box;padding:16px 20px;background:#000;color:#efe4cc;font:500 16px/1.35 'Space Grotesk',sans-serif;transition:opacity .35s;opacity:0}
#cap small{display:block;font:400 10px/1 'Chakra Petch',monospace;letter-spacing:.22em;text-transform:uppercase;opacity:.7;margin-bottom:6px}
#tap,#pen{position:fixed;z-index:9;border-radius:50%;pointer-events:none;opacity:0}
#tap{width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid #efe4cc;background:rgba(239,228,204,.25)}
#pen{width:18px;height:18px;margin:-9px 0 0 -9px;background:rgba(239,228,204,.55);transition:opacity .3s}
#card{position:fixed;inset:0;z-index:10;background:#000;color:#efe4cc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;transition:opacity .6s;font-family:'Space Grotesk',sans-serif}
#card .k{font:400 11px/1 'Chakra Petch',monospace;letter-spacing:.3em;text-transform:uppercase;opacity:.75}
#card h2{font-weight:400;font-size:28px;margin:0 32px}#card .r{width:120px;height:1px;background:#efe4cc;opacity:.6}
</style></head><body><iframe id="app" src="${APP}/?fresh"></iframe><div id="cap"><small></small><span></span></div><div id="tap"></div><div id="pen"></div><div id="card" style="display:none"></div></body></html>`;

async function record(name, script, before) {
  const work = `${OUT}/work-${name}`;
  rmSync(work, { recursive: true, force: true });
  mkdirSync(`${work}/frames`, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
  // The waitlist front page only lets testers in; the recording browser is one.
  await ctx.addInitScript(() => { try { localStorage.setItem('maison-trace-access', 'tester'); } catch {} });
  const p = await ctx.newPage();
  const wait = (ms) => p.waitForTimeout(ms);
  const frames = [];
  const marks = [];
  if (before) await before(ctx);
  // From the app's own address, so the iframe shares its storage (and the tester pass above).
  await p.goto(`${APP}/manifest.webmanifest`).catch(() => {});
  await p.setContent(PAGE);
  const f = p.frameLocator('#app');
  const main = f.getByRole('main');
  // The example skirt, before recording starts.
  await wait(1200);
  await main.getByRole('button', { name: 'Begin' }).click();
  await main.getByRole('button', { name: 'Measure later' }).click();
  await main.getByRole('heading', { level: 1, name: 'Style your skirt' }).waitFor();
  await wait(1500);
  const cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', (e) => {
    frames.push({ data: e.data, t: e.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920 });
  const started = Date.now();

  const card = async (k, t, ms, stay) => {
    await p.evaluate(([k, t]) => {
      const c = document.getElementById('card');
      c.innerHTML = `<div class="k">${k}</div><div class="r"></div><h2>${t}</h2>`;
      c.style.display = 'flex';
      c.style.opacity = 1;
    }, [k, t]);
    // A still card sends no screencast frames, so take one.
    await wait(700);
    frames.push({ data: (await p.screenshot({ type: 'jpeg', quality: 92 })).toString('base64'), t: Date.now() / 1000 });
    await wait(ms - 700);
    if (stay) return;
    await p.evaluate(() => {
      const c = document.getElementById('card');
      c.style.opacity = 0;
      setTimeout(() => (c.style.display = 'none'), 600);
    });
    await wait(600);
  };
  const cap = async (ch, t) => {
    if (ch && !marks.some((m) => m.ch === ch)) marks.push({ ch, at: (Date.now() - started) / 1000 });
    await p.evaluate(([c, t]) => {
      const el = document.getElementById('cap');
      el.style.opacity = 0;
      setTimeout(() => {
        el.querySelector('small').textContent = c;
        el.querySelector('span').textContent = t;
        el.style.opacity = t ? 1 : 0;
      }, 300);
    }, [ch, t]);
    await wait(400);
  };
  /** The tap ring over a control, without pressing it (for downloads and new tabs). */
  const point = async (loc, pause = 900) => {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    await p.evaluate(() => window.scrollTo(0, 0));
    await wait(250);
    const bx = await loc.boundingBox();
    await ring(bx.x + bx.width / 2, bx.y + bx.height / 2);
    await wait(pause);
  };
  const ring = (x, y) =>
    p.evaluate(([x, y]) => {
      const t = document.getElementById('tap');
      t.style.transition = 'none';
      t.style.left = x + 'px';
      t.style.top = y + 'px';
      t.style.opacity = 1;
      t.style.transform = 'scale(.4)';
      requestAnimationFrame(() => {
        t.style.transition = 'opacity .5s .25s, transform .4s';
        t.style.transform = 'scale(1)';
        t.style.opacity = 0;
      });
    }, [x, y]);
  /** Taps a point given as fractions of a box, as a finger would (pointer down and up there). */
  const tapAt = async (loc, [fx, fy], pause = 900) => {
    const bx = await loc.boundingBox();
    const x = bx.x + fx * bx.width;
    const y = bx.y + fy * bx.height;
    await ring(x, y);
    await wait(300);
    await p.mouse.click(x, y);
    await wait(pause);
  };
  /** Scrolls the app so an element sits in the middle of the screen. */
  const show = async (loc, pause = 1200) => {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await p.evaluate(() => window.scrollTo(0, 0));
    await wait(pause);
  };
  const tap = async (loc, pause = 900) => {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    await p.evaluate(() => window.scrollTo(0, 0));
    await wait(250);
    const bx = await loc.boundingBox();
    await ring(bx.x + bx.width / 2, bx.y + bx.height / 2);
    await wait(350);
    await loc.click({ timeout: 2000 }).catch(() => loc.dispatchEvent('click'));
    await wait(pause);
  };
  /** Draws a line through points given as fractions of the box, with a finger dot following it. */
  const draw = async (loc, pts, pause = 1600) => {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await p.evaluate(() => window.scrollTo(0, 0));
    await wait(300);
    const bx = await loc.boundingBox();
    const at = ([x, y]) => [bx.x + x * bx.width, bx.y + y * bx.height];
    const path = [];
    for (let i = 0; i + 1 < pts.length; i++)
      for (let s = 0; s < 14; s++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        path.push(at([x0 + ((x1 - x0) * s) / 14, y0 + ((y1 - y0) * s) / 14]));
      }
    path.push(at(pts[pts.length - 1]));
    const pen = (x, y, o) => p.evaluate(([x, y, o]) => Object.assign(document.getElementById('pen').style, { left: x + 'px', top: y + 'px', opacity: o }), [x, y, o]);
    await pen(path[0][0], path[0][1], 1);
    await p.mouse.move(path[0][0], path[0][1]);
    await p.mouse.down();
    for (const [x, y] of path.slice(1)) {
      await p.mouse.move(x, y);
      await pen(x, y, 1);
      await wait(28);
    }
    await p.mouse.up();
    await pen(path[path.length - 1][0], path[path.length - 1][1], 0);
    await wait(pause);
  };

  await script({ main, wait, card, cap, tap, draw, point, tapAt, show, ctx, f });
  await cdp.send('Page.stopScreencast');
  frames.sort((a, c) => a.t - c.t);
  const endT = Date.now() / 1000;
  let list = 'ffconcat version 1.0\n';
  frames.forEach((fr, i) => {
    const n = `frames/${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(`${work}/${n}`, Buffer.from(fr.data, 'base64'));
    list += `file '${n}'\nduration ${Math.max((i + 1 < frames.length ? frames[i + 1].t : endT) - fr.t, 0.001).toFixed(4)}\n`;
  });
  writeFileSync(`${work}/list.txt`, list);
  await b.close();
  const vf = 'fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p';
  const input = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', vf];
  execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-movflags', '+faststart', `../${name}.mp4`], { cwd: work, stdio: 'inherit' });
  execFileSync('ffmpeg', [...input, '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', `../${name}.webm`], { cwd: work, stdio: 'inherit' });
  rmSync(work, { recursive: true, force: true });
  const lead = started / 1000 - frames[0].t;
  console.log(`${name}: length ${(endT - frames[0].t).toFixed(1)}s`);
  for (const m of marks) console.log(`  ${m.ch} from ${(m.at + lead).toFixed(1)}`);
}

const DEMOS = {
  style: async ({ main, wait, card, cap, tap }) => {
    const tab = (n) => tap(main.getByRole('tablist', { name: 'Style choices' }).getByRole('tab', { name: n, exact: true }), 700);
    // A choice folded under its name opens first (the choices fold away, one open at a time).
    const chip = async (g, c) => {
      const group = main.getByRole('group', { name: g, exact: true });
      const pick = group.getByRole('button', { name: c, exact: true });
      if (!(await pick.isVisible())) await tap(group.getByRole('button', { name: g, exact: true }), 600);
      await tap(pick, 1400);
    };
    await card('Maison Tracé', 'Styling, in thirty seconds', 2400);
    await cap('Tabs', 'Choices sit on tabs under the sketch. Open one at a time.');
    await wait(1600);
    await tab('Shape');
    await cap('Shape', 'Tap a shape. The pattern redraws to your body.');
    await chip('Silhouette', 'Half circle');
    await chip('Silhouette', 'Pencil');
    await chip('Silhouette', 'A-line');
    await tab('Length & hem');
    // The length is dragged on the sketch now; the tab holds the hem's shape.
    await cap('Length & hem', 'Drag the hem on the sketch for length. Pick its shape here.');
    await chip('Hem', 'High-low');
    await tab('Details');
    await cap('Details', 'Pockets, waistband or elastic.');
    await chip('Pockets', 'In-seam');
    await cap('Undo', 'Changed your mind? Undo is always at the bottom.');
    await tap(main.getByRole('button', { name: /^Undo/ }).first(), 1400);
    await cap('Pattern', 'Pattern shows the pieces you will cut.');
    await tap(main.getByRole('button', { name: /Pattern/ }).first(), 2200);
    await tap(main.getByRole('button', { name: /Garment/ }).first(), 1200);
    await cap('Review', 'Happy with it? Review, then print.');
    await tap(main.getByRole('button', { name: 'Review', exact: true }), 2600);
    await cap('', '');
    await card('Maison Tracé', 'Style it your way.', 2200, true);
  },
  draw: async ({ main, wait, card, cap, tap, draw }) => {
    const form = main.getByRole('img', { name: /Your dress form from the/ });
    await card('Maison Tracé', 'Draw on your form', 2400);
    await cap('Open it', 'Tap Draw above the sketch, then Draw on your form.');
    await wait(800);
    await tap(main.locator('.drawmenu > summary'), 1000);
    await tap(main.getByRole('button', { name: 'Draw on your form' }), 1800);
    await cap('', 'This is a dress form built from your measurements.');
    await wait(2200);
    await cap('Draw', 'Pick Hem, then draw where you want it with your finger.');
    await tap(main.getByRole('group', { name: 'What you are drawing' }).getByRole('button', { name: 'Hem', exact: true }), 900);
    await draw(form, [[0.18, 0.62], [0.5, 0.66], [0.82, 0.74]]);
    await cap('Draw', 'The pattern follows your line. Try the back too.');
    await tap(main.getByRole('group', { name: 'Side of the form' }).getByRole('button', { name: 'back', exact: true }), 1000);
    await draw(form, [[0.18, 0.78], [0.5, 0.82], [0.82, 0.78]]);
    await cap('Undo', 'Undo takes the last line back. Redo puts it back.');
    await tap(main.getByRole('button', { name: 'Undo the last line' }), 1400);
    await tap(main.getByRole('button', { name: 'Redo the line you undid' }), 1400);
    await cap('Done', 'Done keeps your lines and shows the pattern.');
    await tap(main.getByRole('button', { name: 'Done', exact: true }), 2800);
    await cap('', '');
    await card('Maison Tracé', 'Draw it your way.', 2200, true);
  },
};


// The photo clip reads a photo from the eval set (a dressed mannequin, no face) with its real reading, stubbed so
// nothing is sent anywhere.
const PHOTO = 'evals/photo/photos/09-maxi.jpg';
const READING = {
  garment: 'skirt',
  worn: true,
  pieces: [{ garment: 'skirt', x: 0.5, y: 0.65 }],
  silhouette: { value: 'a_line', confidence: 'medium' },
  length: { value: 'maxi', confidence: 'high' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.95, hemFullness: 1.8, flareAt: null, confidence: 'medium' },
  extras: { volume: 'none', asymHem: 'none', pockets: false, elasticWaist: false },
  details: 'This 1970s-style floral maxi looks like a gored A-line with soft folds at the hem.',
};
const BEFORE = {
  photo: (ctx) =>
    ctx.route('**/.netlify/functions/analyze-photo', async (route) => {
      await new Promise((r) => setTimeout(r, 2600));
      await route.fulfill({ json: { ok: true, reading: READING } });
    }),
};

/** Opens a drop-down (the paper, the fabric width) and picks from it. */
async function pickFrom({ main, tap }, group, item, ms = 1800) {
  const g = main.getByRole('group', { name: group, exact: true });
  await tap(g.getByRole('button').first(), 700);
  await tap(g.getByRole('menuitemradio', { name: item, exact: true }), ms);
}

/** From the style screen to Print, with every tool showing. */
async function toPrint({ main, tap }, allTools) {
  await tap(main.getByRole('button', { name: 'Review', exact: true }), 1200);
  await tap(main.getByRole('button', { name: 'Print my pattern' }).first(), 1600);
  if (allTools) await tap(main.getByRole('button', { name: 'Show all tools' }), 1000);
}

Object.assign(DEMOS, {
  photo: async ({ main, wait, card, cap, tap, show }) => {
    await card('Maison Tracé', 'From a photo', 2400);
    await cap('Start', 'Seen something you love? Start from a look, then a photo.');
    await wait(600);
    await tap(main.getByRole('button', { name: 'Start from a look' }), 700);
    await tap(main.getByRole('button', { name: 'Start from a photo' }), 1400);
    await cap('Photo', 'Take one, or choose one. Worn or laid flat.');
    await tap(main.locator('label').filter({ hasText: 'Take or choose a photo' }), 200).catch(() => {});
    await main.locator('input[type=file]').setInputFiles(PHOTO);
    await cap('Photo', 'We read the shape, the length and the fit.');
    await main.getByRole('heading', { name: /A-line/ }).waitFor({ timeout: 15000 });
    await wait(1600);
    await cap('Check', 'Anything wrong? Change it. Here, a midi instead.');
    await tap(main.locator('.photorow').filter({ hasText: 'Length' }).getByRole('button', { name: 'Change' }), 900);
    await tap(main.locator('.photorow').filter({ hasText: 'Length' }).getByRole('button', { name: 'Midi', exact: true }), 1400);
    await cap('Draft', 'Then draft it, to your measurements.');
    await tap(main.getByRole('button', { name: /^Draft my|^Next/ }).first(), 1400);
    const next = main.getByRole('button', { name: /^Draft my/ });
    if (await next.isVisible().catch(() => false)) await tap(next, 1400);
    await main.getByRole('heading', { name: /Style your/ }).waitFor({ timeout: 10000 });
    await cap('Draft', 'Your pattern, matched to the photo. Style it from here.');
    await wait(2600);
    await cap('', '');
    await card('Maison Tracé', 'Snap it. Make it yours.', 2200, true);
  },
  fabric: async (h) => {
    const { main, wait, card, cap, tap, show } = h;
    await card('Maison Tracé', 'Fabric and the lay plan', 2400);
    await cap('Fabric', 'On Style, the Fabric tab: pick what you will sew it in.');
    await tap(main.getByRole('tab', { name: 'Fabric', exact: true }), 900);
    await tap(main.getByRole('radio', { name: 'Linen', exact: true }), 1200);
    await tap(main.getByRole('group', { name: 'Colour' }).or(main.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio').nth(2), 1400);
    await cap('Print', 'Tell us the print, so pieces line up on checks or motifs.');
    await tap(main.locator('summary').filter({ hasText: 'About your fabric' }), 900);
    await tap(main.getByText('Checks, stripes', { exact: true }), 1600);
    await cap('Lay plan', 'On Print, the lay plan shows every piece on your cloth.');
    await toPrint(h, false);
    await show(main.locator('.lay').first(), 1800);
    await cap('Width', 'Change the fabric width, and the metres to buy change too.');
    await pickFrom(h, 'Fabric width', '115 cm wide');
    await pickFrom(h, 'Fabric width', '150 cm wide');
    await cap('', '');
    await card('Maison Tracé', 'Buy just what you need.', 2200, true);
  },
  print: async (h) => {
    const { main, wait, card, cap, tap, point, show } = h;
    await card('Maison Tracé', 'Printing your pattern', 2400);
    await cap('Paper', 'Review, then Print my pattern. Pick your paper size.');
    await toPrint(h, false);
    await pickFrom(h, 'Paper', 'US Letter', 1400);
    await pickFrom(h, 'Paper', 'A4', 1400);
    await cap('Pages', 'Each page is numbered on the drawing, so you know where it goes.');
    // On a phone the pages fold behind one line.
    await tap(main.getByRole('button', { name: /^See the \d+ pages?$/ }), 900);
    await show(main.locator('.preview.tiles'), 2200);
    await cap('Tape', 'Trim, match the half diamonds, and tape the pages together.');
    await tap(main.locator('summary').filter({ hasText: 'How the pages fit together' }), 2600);
    await cap('Download', 'Download the PDF and print it at 100%, not fit to page.');
    await point(main.getByRole('button', { name: /^Download PDF/ }), 2200);
    await cap('', '');
    await card('Maison Tracé', 'Print it. Tape it. Cut it.', 2200, true);
  },
  scale: async (h) => {
    const { main, wait, card, cap, tap, tapAt, show } = h;
    await card('Maison Tracé', 'Checking the true size', 2400);
    await cap('Open it', 'On Print, under Fit it in a toile first: See a piece at true size.');
    await toPrint(h, true);
    await tap(main.getByRole('button', { name: 'See a piece at true size' }), 1400);
    await cap('Card', 'Hold a bank card on the screen and match the shape to it.');
    for (let i = 0; i < 6; i++) await tap(main.getByRole('button', { name: 'Larger' }), 250);
    await wait(800);
    await tap(main.getByRole('button', { name: 'It matches the card' }), 1600);
    await cap('Measure', 'Now the piece is at its real size. Tap two points to measure.');
    const pan = main.locator('.truescale-pan');
    await show(pan, 900);
    await tapAt(pan, [0.2, 0.25], 700);
    await tapAt(pan, [0.75, 0.7], 900);
    await show(main.locator('.truescale .reading'), 2200);
    await cap('Seam', 'Walk a seam: tap an edge to see its length.');
    await tap(main.getByRole('button', { name: 'Walk a seam', exact: true }), 900);
    await show(pan, 600);
    await tapAt(pan, [0.02, 0.5], 900);
    await show(main.locator('.truescale .reading'), 2400);
    await cap('', '');
    await card('Maison Tracé', 'Check it before you cut.', 2200, true);
  },
  fitting: async (h) => {
    const { main, wait, card, cap, tap, show } = h;
    await card('Maison Tracé', 'After your toile', 2400);
    await cap('Open it', 'Sewn a toile and tried it on? On Print: I’ve tried on a toile.');
    await toPrint(h, true);
    await tap(main.getByRole('button', { name: 'I’ve tried on a toile' }), 1400);
    await cap('Tick', 'Tick what you see, like pulling across the hips.');
    await tap(main.getByText('Pulls across the hips'), 1200);
    await cap('Amount', 'Set how much. The pattern is corrected the way a cutter would.');
    const more = main.getByRole('group', { name: 'How much: Pulls across the hips' }).getByRole('button', { name: 'More' });
    await tap(more, 500);
    await tap(more, 1200);
    await cap('Correction', 'Dashed line: the pattern now. Solid: corrected, in millimetres.');
    await show(main.locator('.fitside'), 2800);
    await cap('Save', 'Save it as version 2, and print the corrected pattern.');
    await tap(main.getByRole('button', { name: /^Save as version/ }), 2400);
    await cap('', '');
    await card('Maison Tracé', 'Fitted to you.', 2200, true);
  },
});

mkdirSync(OUT, { recursive: true });
for (const [name, script] of Object.entries(DEMOS)) if (!ONLY || ONLY === name) await record(name, script, BEFORE[name]);
