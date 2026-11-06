// Records the tools' Watch demo clips from the running app (npx vite --port 5173 first) into public/demos/<name>.mp4
// and .webm, in the Draw clip's look (A, Just the form): only the thing in use, big, under one caption at the top.
// Prints where each part starts: copy those into DEMOS in src/ui/DemoButton.tsx. STILLS=1 also saves a still of
// each part's last moment (into <out>/stills) for Cat's OK first. Usage: node scripts/record-demos.mjs public/demos [name]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = process.argv[2] ?? 'public/demos';
const ONLY = process.argv[3];
const APP = process.env.APP ?? 'http://127.0.0.1:5173';

const PAGE = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&family=Chakra+Petch&display=swap"><style>
html,body{margin:0;background:#120805;overflow:hidden}
#app{position:fixed;left:0;top:0;width:432px;height:672px;border:0;border-bottom:1px solid rgba(243,223,183,.3)}
#cap{position:fixed;left:0;right:0;bottom:0;height:96px;box-sizing:border-box;padding:16px 20px;background:#120805;color:#f3dfb7;font:500 16px/1.35 'Space Grotesk',sans-serif;transition:opacity .35s;opacity:0}
#cap small{display:block;font:400 10px/1 'Chakra Petch',monospace;letter-spacing:.22em;text-transform:uppercase;opacity:.7;margin-bottom:6px}
#tap,#pen{position:fixed;z-index:9;border-radius:50%;pointer-events:none;opacity:0}
#tap{width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid #f3dfb7;background:rgba(243,223,183,.25)}
#pen{width:18px;height:18px;margin:-9px 0 0 -9px;background:rgba(243,223,183,.55);transition:opacity .3s}
#card{position:fixed;inset:0;z-index:10;background:#120805;color:#f3dfb7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;transition:opacity .6s;font-family:'Space Grotesk',sans-serif}
#card .k{font:400 11px/1 'Chakra Petch',monospace;letter-spacing:.3em;text-transform:uppercase;opacity:.75}
body.focus #app{height:768px;border:0;transform-origin:0 0;transition:opacity .35s}
body.focus #cap{top:56px;bottom:auto;height:auto;background:none;text-align:center;padding:0 28px;z-index:8}
body.focus #cap small{color:#c9b48a;opacity:1;margin-bottom:12px;font-size:12px}
body.focus #cap span{font-size:22px;line-height:1.3}
#top{display:none;position:fixed;left:0;right:0;top:0;height:222px;z-index:7;background:linear-gradient(#120805 88%,rgba(18,8,5,0))}
body.focus #top{display:block}
#card h2{font-weight:400;font-size:28px;margin:0 32px}#card .r{width:120px;height:1px;background:#f3dfb7;opacity:.6}
</style></head><body><iframe id="app" src="${APP}/?fresh"></iframe><div id="top"></div><div id="cap"><small></small><span></span></div><div id="tap"></div><div id="pen"></div><div id="card" style="display:none"></div></body></html>`;

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
  // STILLS=1: a still of each part's last moment, for Cat's OK before the clips are cut.
  let shot = 0;
  const still = async () => {
    if (!process.env.STILLS) return;
    mkdirSync(`${OUT}/stills`, { recursive: true });
    await p.screenshot({ path: `${OUT}/stills/${name}-${String(++shot).padStart(2, '0')}.png` });
  };
  // One reading pace (Cat, 2026-11-05: After your toile went too fast): each caption stays up at least 5 s, and
  // longer ones longer, before the next one replaces it.
  let shown = null;
  const cap = async (ch, t) => {
    if (shown) {
      const need = Math.max(5000, 2400 + shown.words * 300);
      const left = need - (Date.now() - shown.at);
      if (left > 0) await wait(left);
    }
    shown = t ? { at: Date.now(), words: t.split(/\s+/).length } : null;
    if (await p.evaluate(() => document.querySelector('#cap span').textContent)) await still();
    if (ch && !marks.some((m) => m.ch === ch)) marks.push({ ch, at: (Date.now() - started) / 1000 });
    await p.evaluate(([c, t]) => {
      const el = document.getElementById('cap');
      el.style.opacity = 0;
      setTimeout(() => {
        el.querySelector('small').textContent = c;
        // Two sentences come in one at a time (Cat, 2026-11-05): the second fades in once the first is read.
        const [one, ...rest] = t.split(/(?<=[.?!])\s+(?=[A-Z])/);
        const span = el.querySelector('span');
        span.textContent = one ?? '';
        if (rest.length) {
          const two = document.createElement('span');
          // On its own line (Cat, 2026-11-05).
          two.textContent = rest.join(' ');
          two.style.cssText = 'display:block;opacity:0;transition:opacity .5s';
          span.appendChild(two);
          setTimeout(() => (two.style.opacity = 1), 1400 + 260 * one.split(/\s+/).length);
        }
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

  // Look A, Just the form (Cat, 2026-11-04): only the thing in use shows, big, under one caption at the top. The
  // rest of the app is hidden (so its controls are pressed with dispatchEvent, found with includeHidden) and the
  // app frame is scaled onto the subject's box.
  const fit = async (sels, { top = 176, h = 520, w = 392, s: fixed, align } = {}) => {
    const list = [].concat(sels);
    const r = await f.locator('body').evaluate((b, list) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const sel of list)
        for (const el of b.ownerDocument.querySelectorAll(sel)) {
          const q = el.getBoundingClientRect();
          if (!q.width || !q.height) continue;
          x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom);
        }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }, list);
    const s = fixed ?? Math.min(h / r.h, w / r.w);
    await p.evaluate(([s, tx, ty]) => {
      document.getElementById('app').style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    }, [s, 216 - s * (r.x + r.w / 2), top + (align === 'top' ? 0 : (h - s * r.h) / 2) - s * r.y]);
  };
  /** Shows only these parts of the app, scrolled to the middle of its screen and scaled to fill the frame. */
  const focus = async (sels, opts = {}) => {
    const list = [].concat(sels);
    await f.locator('body').evaluate((b, [list, hide]) => {
      const d = b.ownerDocument;
      let st = d.getElementById('demo-focus');
      if (!st) {
        st = d.createElement('style');
        st.id = 'demo-focus';
        b.appendChild(st);
      }
      st.textContent =
        'body *{visibility:hidden!important} .testing-tag{display:none!important} ' +
        // Fills and textures drawn from elsewhere in the app (the fabric on the drawing) stay drawn.
        [...list, 'defs', 'pattern', 'mask', 'clipPath'].map((x) => `${x},${x} *`).join(',') + '{visibility:visible!important} ' +
        // With an id's weight, so a part hidden inside the subject stays hidden.
        [hide, '.demo-play'].filter(Boolean).flatMap((x) => x.split(',')).map((x) => `${x}:not(#_),${x}:not(#_) *`).join(',') + '{visibility:hidden!important}';
    }, [list, opts.hide ?? '']);
    await p.evaluate(() => document.body.classList.add('focus'));
    await f.locator(list[0]).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await wait(400);
    await fit(list, opts);
  };
  /** Fades the app out, does what's given (pressing hidden controls, a new focus), and fades it back in. */
  const veil = async (fn) => {
    await p.evaluate(() => (document.getElementById('app').style.opacity = 0));
    await wait(400);
    await fn();
    await wait(300);
    await p.evaluate(() => (document.getElementById('app').style.opacity = 1));
    await wait(500);
  };
  /** Lifts the title card left standing. */
  const uncard = async () => {
    await p.evaluate(() => {
      const c = document.getElementById('card');
      c.style.opacity = 0;
      setTimeout(() => (c.style.display = 'none'), 600);
    });
    await wait(900);
  };
  // The whole app, not just main: projector mode is a dialog on the body.
  const M = f.locator('body');
  /** A control in the app, found even while hidden. */
  const R = (role, name, o = {}) => M.getByRole(role, { name, exact: typeof name === 'string', includeHidden: true, ...o }).first();
  /** Presses a hidden control (no tap ring: only the subject is on screen). */
  const press = async (loc, pause = 900) => {
    await loc.dispatchEvent('click');
    await wait(pause);
  };
  /** The small line over the caption, for what was just picked. */
  const label = (t) =>
    p.evaluate((t) => {
      const el = document.querySelector('#cap small');
      el.style.transition = 'opacity .25s';
      el.style.opacity = 0;
      setTimeout(() => {
        el.textContent = t;
        el.style.opacity = 1;
      }, 250);
    }, t);
  /** Drags from one element's middle to another's (or to a point given as [dx, dy] from it), with the finger dot. */
  const drag = async (from, to, pause = 1400) => {
    const a = await from.boundingBox();
    const b2 = Array.isArray(to) ? null : await to.boundingBox();
    const x0 = a.x + a.width / 2, y0 = a.y + a.height / 2;
    const x1 = b2 ? b2.x + b2.width / 2 : x0 + to[0], y1 = b2 ? b2.y + b2.height / 2 : y0 + to[1];
    const box = { x: Math.min(x0, x1) - 1, y: Math.min(y0, y1) - 1, width: Math.abs(x1 - x0) + 2, height: Math.abs(y1 - y0) + 2 };
    const fr = (x, y) => [(x - box.x) / box.width, (y - box.y) / box.height];
    await draw({ boundingBox: async () => box, evaluate: async () => {} }, [fr(x0, y0), fr((x0 + x1) / 2, (y0 + y1) / 2), fr(x1, y1)], pause);
  };

  await script({ main, wait, card, cap, tap, draw, point, tapAt, show, ctx, f, p, fit, focus, veil, uncard, R, press, label, drag, M });
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

// The sketch on Style, larger than its box allows: the length marks and drag handles (cut off at that size) hidden.
const LENGTH = '.preview-svg .handle:has([aria-label="Skirt length"])';
const SKETCH = { h: 470, top: 196, w: 1e9, hide: '.preview-svg .handle,.preview-svg .hem-marks' };

const DEMOS = {
  // Every clip is in the Draw clip's look (A, Just the form; Cat said yes for all seven on 2026-11-05): the drawing,
  // the pattern or the tool's own picture, big, under one caption; what is picked shows in the line over it.
  style: async (h) => {
    const { wait, card, cap, focus, veil, uncard, R, press, label, drag, f, p } = h;
    const pick = async (c, ms = 1700) => {
      await press(R('button', c), 0);
      await label(c);
      await wait(ms);
    };
    await card('Maison Tracé', 'Styling, in thirty seconds', 1200, true);
    await focus('svg.preview-svg', SKETCH);
    await uncard();
    await cap('Shape', 'Pick a shape. The pattern redraws to your body.');
    await wait(1200);
    await pick('Half circle');
    await pick('Pencil');
    await pick('A-line');
    await cap('Length', 'Drag the hem to the length you want.');
    await f.locator('body').evaluate((b, L) => (b.ownerDocument.getElementById('demo-focus').textContent += ` ${L}:not(#_),${L}:not(#_) *{visibility:visible!important}`), LENGTH);
    await wait(900);
    const svg = f.locator('svg.preview-svg');
    // Straight down, to the height of the (hidden) Midi mark.
    const handle = svg.locator('circle.hit[aria-label="Skirt length"]');
    // The named lengths are no longer drawn (the hem glides and catches on each): step the slider down to Midi to
    // learn where it sits, step back up, then drag there for the camera.
    const hb = await handle.boundingBox();
    await handle.focus();
    let steps = 0;
    while ((await handle.getAttribute('aria-valuetext')) !== 'Midi' && steps < 8) { await p.keyboard.press('ArrowDown'); steps++; await wait(150); }
    if ((await handle.getAttribute('aria-valuetext')) !== 'Midi') throw new Error('Style clip: no Midi length on the hem slider');
    const mb = await handle.boundingBox();
    for (let i = 0; i < steps; i++) { await p.keyboard.press('ArrowUp'); await wait(80); }
    await wait(400);
    await drag(handle, [0, mb.y + mb.height / 2 - (hb.y + hb.height / 2)], 1800);
    await cap('Hem', 'Pick the shape of the hem. Here, high-low.');
    await wait(1000);
    await pick('High-low', 2000);
    await cap('Details', 'Add details. Here, pleats and a tie sash.');
    await wait(900);
    await pick('Knife pleats');
    await pick('Tie sash', 2000);
    await cap('Undo', 'Changed your mind? Undo takes off the last change.');
    await wait(900);
    await press(R('button', 'Undo the last change'), 0);
    await label('Undo');
    await wait(1900);
    await cap('Pattern', 'Switch to Pattern to see the pieces you will cut.');
    await veil(async () => {
      await press(R('button', /^Pattern/), 900);
      await focus('.paper-sheet');
    });
    await wait(2800);
    await cap('', '');
    await card('Maison Tracé', 'Style it your way.', 2200, true);
  },
  // Just the form (Cat's A, 2026-11-04): only the calico garment on the form, big, with one caption at the top.
  // The screen is opened under the title card; the rest of the app is hidden and the form fills the frame.
  draw: async ({ main, wait, card, cap, draw, f, p }) => {
    // By class: with the rest hidden, the app is out of the accessibility tree.
    const form = f.locator('.form-draw svg.form-svg');
    await card('Maison Tracé', 'Draw on your form', 1200, true);
    // Under the card, so pressed without the pointer.
    await main.locator('.drawmenu > summary').dispatchEvent('click');
    await main.getByRole('button', { name: 'Draw on your form' }).dispatchEvent('click');
    await main.getByRole('group', { name: 'What you are drawing' }).getByRole('button', { name: 'Hem', exact: true }).dispatchEvent('click');
    await f.locator('body').evaluate((b) => {
      const st = b.ownerDocument.createElement('style');
      st.textContent =
        'body *{visibility:hidden!important} .form-draw svg.form-svg,.form-draw svg.form-svg *{visibility:visible!important}' +
        ' .form-draw svg .hem-ghost text,.form-draw svg text.hint{visibility:hidden!important}';
      b.appendChild(st);
    });
    // The full-height frame first, so the scroll the drawing does later doesn't move the form.
    await p.evaluate(() => document.body.classList.add('focus'));
    await form.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await wait(600);
    // The form's box, inside the app, scaled so it fills the frame under the caption.
    const r = await form.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const top = 176;
    const s = 520 / r.h;
    await p.evaluate(([s, tx, ty]) => {
      document.getElementById('app').style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    }, [s, 216 - s * (r.x + r.w / 2), top - s * r.y]);
    await wait(1000);
    await p.evaluate(() => {
      const c = document.getElementById('card');
      c.style.opacity = 0;
      setTimeout(() => (c.style.display = 'none'), 600);
    });
    await wait(900);
    const side = (n) => f.locator('.form-sides .seg button').filter({ hasText: new RegExp(`^${n}$`, 'i') }).dispatchEvent('click');
    await cap('Draw', 'Draw where you want the hem.');
    await wait(1600);
    await draw(form, [[0.36, 0.55], [0.5, 0.552], [0.64, 0.55]], 1200);
    await cap('Draw', 'The skirt follows your line.');
    await wait(2200);
    await cap('Back', 'Turn to the back. Draw it lower for a high-low hem.');
    await side('back');
    await wait(1600);
    await draw(form, [[0.33, 0.67], [0.41, 0.705], [0.5, 0.715], [0.59, 0.705], [0.67, 0.67]], 1200);
    await cap('Back', 'Longer at the back.');
    await wait(1400);
    await side('front');
    await wait(2200);
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

/** Picks from a drop-down (the paper, the fabric width) while it is hidden. */
async function pickFrom({ R, press }, group, item, ms = 1800) {
  await press(R('group', group).getByRole('button', { includeHidden: true }).first(), 400);
  await press(R('menuitemradio', item), ms);
}

/** From the style screen to Print, under the title card. */
async function toPrint({ R, press }, allTools, quick) {
  // On a phone the bar says "See the choices" until the step's questions have been scrolled into view (Nov 6);
  // only then does Review appear, as a link under the step or as the bar's own button.
  const see = R('button', /^See the choices/);
  if (await see.count()) {
    // It scrolls the questions up in a few tries (with nothing to scroll in the clip's frame, up to ~3 s).
    await press(see, 300);
    await R('button', /^Review/).waitFor({ state: 'attached', timeout: 8000 });
  }
  await press(R('button', /^Review/), quick ? 200 : 600);
  await press(R('button', 'Print my pattern'), quick ? 400 : 900);
  if (allTools) await press(R('button', 'Show all tools'), 800);
}

Object.assign(DEMOS, {
  photo: async (h) => {
    const { wait, card, cap, focus, veil, uncard, R, press, label, f } = h;
    await card('Maison Tracé', 'From a photo', 1200, true);
    // Start from a look sits in the garment drop-down (Release 40); the photo goes in under the card.
    await press(R('group', 'Garment').locator('.drop-button'), 500);
    await press(R('menuitemradio', /Start from a look/), 500);
    await press(R('button', 'Start from a photo'), 900);
    await f.locator('main input[type=file]').setInputFiles(PHOTO);
    await f.locator('.photohead h1').waitFor({ timeout: 15000 });
    await focus('img.photothumb', { h: 450, top: 200 });
    await uncard();
    await cap('Photo', 'Seen something you love? Take a photo, or choose one.');
    await wait(2400);
    await cap('Read', 'We read the shape, the length and the fit.');
    // The reading, in the line over the caption.
    const reading = () => f.locator('.photosum').evaluate((el) => el.firstChild?.textContent?.trim() ?? el.textContent.replace(/Change|Done/g, '').trim());
    await label(await reading());
    await wait(2600);
    await cap('Check', 'Did we read anything wrong? Change it. Here, midi instead of maxi.');
    await wait(1200);
    await press(f.locator('.photosum button'), 400);
    await press(f.locator('.photorow').filter({ hasText: 'Length' }).getByRole('button', { name: 'Midi', exact: true, includeHidden: true }), 300);
    await label(await reading());
    await wait(2200);
    await cap('Draft', 'Your pattern is drafted to your measurements. Style it from here.');
    await veil(async () => {
      await press(R('button', /^Draft my/), 400);
      await f.locator('svg.preview-svg').first().waitFor({ state: 'attached', timeout: 10000 });
      await wait(900);
      await focus('svg.preview-svg', SKETCH);
    });
    await wait(3000);
    await cap('', '');
    await card('Maison Tracé', 'Snap it. Make it yours.', 2200, true);
  },
  fabric: async (h) => {
    const { wait, card, cap, focus, veil, uncard, R, press, label, f } = h;
    await card('Maison Tracé', 'Fabric and the lay plan', 1200, true);
    await press(R('tab', 'Fabric'), 700);
    // A first fabric under the card, so its palette card stands beside the drawing from the start.
    await press(R('radio', 'Cotton'), 1200);
    await focus(['svg.preview-svg', '.palette-col'], { ...SKETCH, w: 400, h: 440, top: 200 });
    await uncard();
    await cap('Fabric', 'Pick the fabric you will sew it in. The drawing shows it.');
    await label('Cotton');
    await wait(1600);
    await press(R('radio', 'Linen'), 0);
    await label('Linen');
    await wait(1800);
    const colour = f.locator('[role=radiogroup][aria-label*="olour"] [role=radio]');
    if ((await colour.count()) > 2) {
      await press(colour.nth(2), 0);
      await wait(1800);
    }
    await cap('Print', 'Checks or stripes? Tell us, and the pieces are placed to match them.');
    await wait(900);
    await press(f.locator('.printtile').filter({ hasText: 'Checks' }).first(), 0);
    await label('Checks, stripes');
    await wait(2000);
    await cap('Lay plan', 'On Print, the lay plan shows where every piece goes on your fabric.');
    await veil(async () => {
      // Quick, as the screen is dark meanwhile.
      await toPrint(h, false, true);
      await focus('.lay-box');
    });
    // The width and the metres to buy, from the plan's own description.
    const metres = async () =>
      label(await f.locator('svg.layplan').evaluate((el) => (el.getAttribute('aria-label') ?? '').replace(/^Cutting layout on /, '').replace(/ fabric, /, ' · ').replace(/ metres?.*$/, ' m')));
    await metres();
    await wait(2600);
    await cap('Width', 'Set your fabric’s width. The plan rearranges to fit it.');
    await wait(900);
    for (const w of ['150 cm wide', '115 cm wide']) {
      await pickFrom(h, 'Fabric width', w, 300);
      await focus('.lay-box');
      await metres();
      await wait(1900);
    }
    await cap('', '');
    await card('Maison Tracé', 'Buy just what you need.', 2200, true);
  },
  print: async (h) => {
    const { wait, card, cap, focus, veil, uncard, R, press, label, f, p } = h;
    // The pages at the frame's width, from the top; the rest is shown by panning down.
    const TILES = { w: 400, h: 1e9, top: 236, align: 'top' };
    const pan = async (ms) => {
      const r = await f.locator('.preview.tiles').evaluate((el) => el.getBoundingClientRect().height);
      await p.evaluate(([ms, r]) => {
        const app = document.getElementById('app');
        const m = app.style.transform.match(/translate\(([-\d.]+)px, ?([-\d.]+)px\) scale\(([\d.]+)\)/);
        const [tx, ty, s] = m.slice(1).map(Number);
        app.style.transition = `transform ${ms}ms ease-in-out, opacity .35s`;
        app.style.transform = `translate(${tx}px,${ty - Math.max(0, s * r - (740 - 236))}px) scale(${s})`;
      }, [ms, r]);
      await wait(ms + 300);
    };
    await card('Maison Tracé', 'Printing your pattern', 1200, true);
    await toPrint(h, false);
    // On a phone the pages fold behind one line.
    await press(R('button', /^See the \d+ pages?/), 800);
    await focus('.preview.tiles', TILES);
    await uncard();
    await cap('Paper', 'Pick your paper size. The pattern is split into pages to fit it.');
    await wait(1400);
    for (const paper of ['A4', 'US Letter']) {
      await veil(async () => {
        await pickFrom(h, 'Paper', paper, 500);
        await focus('.preview.tiles', TILES);
      });
      await label(paper);
      await wait(1700);
    }
    await cap('Pages', 'Each page is numbered on the drawing, so you know where it goes.');
    await pan(5200);
    await cap('Tape', 'Once printed, trim each page, match the half diamonds and tape them together.');
    await wait(3000);
    await cap('Download', 'Download the PDF. Print it at 100%, not fit to page.');
    await wait(3000);
    await cap('', '');
    await card('Maison Tracé', 'Print it. Tape it. Cut it.', 2200, true);
  },
  // Projector mode (Cat, 2026-10-29: its own demo). Its In testing tag is left out, as in the How it works film.
  projector: async (h) => {
    // Only the projected picture: the tools and hints around it hidden.
    const PJ = { h: 560, top: 168, hide: '.projector-tools,.pj-top,.pj-hint,.projector-panel' };
    const { wait, card, cap, focus, veil, uncard, R, press, label, draw, drag, f } = h;
    await card('Maison Tracé', 'Projecting your pattern', 1200, true);
    await toPrint(h, false);
    await pickFrom(h, 'Paper', 'Projector', 800);
    // Full screen would leave the clip's frame; projector mode stays inside the app.
    await f.locator('body').evaluate((b) => (b.ownerDocument.defaultView.Element.prototype.requestFullscreen = () => Promise.resolve()));
    await press(R('button', 'Open projector mode'), 1200);
    await focus('.projector-stage', PJ);
    await uncard();
    await cap('Line up', 'Point your projector at your cutting mat. Drag each corner onto a corner of the mat’s grid.');
    await wait(1200);
    for (const [i, d] of [[0, [-22, -18]], [2, [22, 18]]]) await drag(f.locator('.pj-corner .pj-hit').nth(i), d, 900);
    await cap('Check', 'Lay a ruler across the square. Is each side 10 cm?');
    await press(R('button', /^Next: check/), 0);
    await wait(2800);
    await cap('Project', 'Each piece shows at true size. Drag it where you want it on your fabric.');
    await veil(async () => {
      await press(R('button', 'Yes: start projecting'), 900);
      await focus('.projector-stage', PJ);
    });
    const stage = f.locator('div.projector-stage');
    await draw(stage, [[0.5, 0.45], [0.47, 0.42], [0.44, 0.4]], 1200);
    await cap('Turn', 'Turn it or flip it to fit your fabric.');
    await wait(700);
    await press(R('button', /^Turn 90/), 0);
    await label('Turn');
    await wait(1600);
    await press(R('button', 'Flip'), 0);
    await label('Flip');
    await wait(1600);
    await cap('Pieces', 'Cut it, then go on to the next piece.');
    await wait(900);
    await press(R('button', 'Next piece'), 2200);
    await cap('', '');
    await card('Maison Tracé', 'Cut straight from the cloth.', 2200, true);
  },
  scale: async (h) => {
    const { wait, card, cap, focus, veil, uncard, R, press, label, tapAt, f } = h;
    await card('Maison Tracé', 'Checking the true size', 1200, true);
    await toPrint(h, true);
    await press(R('button', 'See a piece at true size'), 1200);
    // Room for the card shape to grow.
    await focus('.calcard', { s: 1.0, top: 230, h: 300 });
    await uncard();
    await cap('Card', 'Hold a bank card on the screen. Make the box the same size as the card.');
    await wait(1200);
    for (let i = 0; i < 6; i++) await press(R('button', 'Larger'), 300);
    await wait(1400);
    await cap('Measure', 'Now the piece is at its real size. Tap two points to measure.');
    await veil(async () => {
      await press(R('button', 'It matches the card'), 1200);
      await focus('.truescale-pan');
    });
    const pan = f.locator('.truescale-pan');
    // What the app reads out, in the line over the caption.
    const reading = async () => label(await f.locator('.truescale .reading').first().textContent().catch(() => ''));
    await wait(600);
    await tapAt(pan, [0.2, 0.25], 700);
    await tapAt(pan, [0.75, 0.7], 300);
    await reading();
    await wait(2000);
    await cap('Seam', 'Or tap along a seam to see its length.');
    await press(R('button', 'Walk a seam'), 900);
    await tapAt(pan, [0.02, 0.5], 300);
    await reading();
    await wait(2400);
    await cap('', '');
    await card('Maison Tracé', 'Check it before you cut.', 2200, true);
  },
  // The tick and the How much control first, then the corrected pattern (Cat, 2026-11-05: the tick was never shown).
  fitting: async (h) => {
    const { wait, card, cap, focus, veil, uncard, R, press, label, tapAt, f } = h;
    await card('Maison Tracé', 'After your toile', 1200, true);
    await toPrint(h, true);
    await press(R('button', 'I’ve tried on a toile'), 1200);
    // Pulls across the hips: the first issue of the first group (by place, as React rewrites its class on a tick).
    const ISSUE = 'main fieldset.group:first-of-type > .issue:first-of-type';
    // Top-aligned at a fixed size, so the How much control can open below without the row moving.
    await focus(ISSUE, { s: 1.05, align: 'top', top: 300 });
    await uncard();
    await cap('Tick', 'Tried on your toile? Tick what you see, like pulling across the hips.');
    await wait(1600);
    // The box is drawn by the label; a tap on its left end ticks it.
    await tapAt(f.locator(`${ISSUE} label.check`), [0.05, 0.2], 1600);
    await cap('Amount', 'Then set how much to fix it.');
    await wait(900);
    const more = f.locator(`${ISSUE} button[aria-label="More"]`);
    await tapAt(more, [0.5, 0.5], 900);
    await tapAt(more, [0.5, 0.5], 1600);
    await cap('Correction', 'The pattern is corrected the way a pattern cutter would. Dashed line: before. Solid line: after.');
    await veil(async () => {
      await focus('svg.fitprev', { w: 330, h: 480, top: 230 });
    });
    await wait(1200);
    await cap('Save', 'Save it as version 2, and print the corrected pattern.');
    await wait(1200);
    await cap('', '');
    await card('Maison Tracé', 'Fitted to you.', 2200, true);
  },

});

mkdirSync(OUT, { recursive: true });
for (const [name, script] of Object.entries(DEMOS)) if (!ONLY || ONLY === name) await record(name, script, BEFORE[name]);
