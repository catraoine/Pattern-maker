import { GarmentName, expect, startWithExample, switchGarment, test } from './fixtures';

// The all-round check (Cat, 2026-10-26: "an automatic check that turns every garment around and checks for anything
// strange"). Every garment, and the dress and tee in each kind of neckline, in the jade python, turned all the way
// round. For the check the view paints the backdrop red and the hollow it lays behind the garment magenta (the form
// itself stays black with its gold lines), and at each angle the picture is read pixel by pixel. Four things fail it:
//  - a dark hole: the backdrop or the hollow showing through the garment, walled in by cloth (through the neck, an
//    armhole or a gap at a seam you should see the form, never black behind it);
//  - seen through from behind: more than a sliver of the form showing inside the garment from the back (a neckline
//    reaching too far, say);
//  - one side unlike the other: a symmetric garment seen from the left must be the mirror image of it seen from the
//    right, so a notch, a gap or a stray patch on one side only shows up as a patch that doesn't match;
//  - a jump: turning a few degrees must only move the edges a little, so a patch that appears, vanishes or flickers
//    between two close angles shows up as a patch that changed.
// Wherever it fails, the pictures are saved in test-results for a look.

/** Each look: the garment, the tab and choices that make it, and whether it is the same on both sides. */
const LOOKS: { g: GarmentName; tab: string; picks: string[]; mirror: boolean }[] = [
  { g: 'Skirt', tab: 'Shape', picks: [], mirror: true },
  { g: 'Dress', tab: 'Neck & sleeves', picks: ['Crew', 'Short'], mirror: true },
  { g: 'Dress', tab: 'Neck & sleeves', picks: ['Scoop', 'Short'], mirror: true },
  { g: 'Dress', tab: 'Neck & sleeves', picks: ['V-neck', 'Short'], mirror: true },
  { g: 'Dress', tab: 'Neck & sleeves', picks: ['Square', 'Short'], mirror: true },
  { g: 'Dress', tab: 'Neck & sleeves', picks: ['Boat', 'Short'], mirror: true },
  { g: 'Dress', tab: 'Neck & sleeves', picks: ['Sweetheart'], mirror: true },
  { g: 'Bodice', tab: 'Neck & sleeves', picks: [], mirror: true },
  { g: 'Tee', tab: 'Neck & sleeves', picks: ['Crew'], mirror: true },
  { g: 'Tee', tab: 'Neck & sleeves', picks: ['Scoop'], mirror: true },
  { g: 'Tee', tab: 'Neck & sleeves', picks: ['V-neck'], mirror: true },
  // A jacket and a coat lap one front over the other and button on one side: not the same both sides.
  { g: 'Jacket', tab: 'Shape', picks: [], mirror: false },
  { g: 'Coat', tab: 'Shape', picks: [], mirror: false },
  { g: 'Trousers', tab: 'Shape', picks: [], mirror: true },
];
/** Angles all the way round, and the small turn between two close views. */
const VIEWS = 12;
const NUDGE = (3 * Math.PI) / 180;
/** The biggest patch, in pixels of the half-size picture (each 2 x 2 of the canvas), that may differ before it counts. */
const MIRROR_PATCH = 35;
const JUMP_PATCH = 35;
const HOLE_PATCH = 6;
// The real body's back is flat and its shoulders slope: over a low back neckline a little more of the form shows from
// behind than over the old round form's, and a back zip's rungs face the viewer more squarely, so a touch more is let by.
const BEHIND_PATCH = 18;

type Found = { kind: 'dark hole' | 'seen through' | 'mirror' | 'jump'; at: number; size: number; x: number; y: number };

/**
 * In the page: turns the form through every view and reads each picture. The canvas is read at half size (a pixel
 * here is 2 x 2 of the canvas), into 0 the backdrop (red), 1 cloth (the jade python's greens and blues), 2 the hollow
 * inside the garment (magenta), 3 anything else (the form, its lines, the edges) or 4 the window between a sleeve and
 * the waist (yellow), which is neither a hole nor the form.
 */
function check(o: { views: number; nudge: number; mirror: boolean; patch: { mirror: number; jump: number; hole: number; behind: number } }) {
  const cv = document.querySelector<HTMLCanvasElement>('canvas.all-round-canvas')!;
  const g = cv.getContext('2d')!;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const read = async (a: number) => {
    cv.dispatchEvent(new CustomEvent('allround-turn', { detail: { at: a, probe: true } }));
    await frame();
    const W = cv.width;
    const H = cv.height;
    const d = g.getImageData(0, 0, W, H).data;
    const w = W >> 1;
    const h = H >> 1;
    const cls = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (2 * y * W + 2 * x) * 4;
        const r = d[i];
        const gg = d[i + 1];
        const b = d[i + 2];
        cls[y * w + x] = r > 200 && gg < 60 ? (b < 60 ? 0 : b > 200 ? 2 : 3) : r > 200 && gg > 200 && b < 60 ? 4 : gg - r > 12 || b - r > 12 ? 1 : 3;
      }
    }
    return { w, h, cls };
  };
  // Patches of a mask after shaving `shave` pixels off every edge, so a ragged edge, or a narrow strip of black between
  // two of the form's lines, doesn't count.
  const patches = (mask: Uint8Array, w: number, h: number, limit: number, shave = 1) => {
    let core = mask;
    for (let n = 0; n < shave; n++) {
      const next = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (core[i] && core[i - 1] && core[i + 1] && core[i - w] && core[i + w]) next[i] = 1;
        }
      }
      core = next;
    }
    const seen = new Uint8Array(w * h);
    const out: { size: number; x: number; y: number }[] = [];
    for (let i = 0; i < w * h; i++) {
      if (!core[i] || seen[i]) continue;
      let size = 0;
      let sx = 0;
      let sy = 0;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const j = stack.pop()!;
        size++;
        sx += j % w;
        sy += Math.floor(j / w);
        for (const k of [j - 1, j + 1, j - w, j + w]) {
          if (k >= 0 && k < w * h && core[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
      if (size > limit) out.push({ size, x: 2 * Math.round(sx / size), y: 2 * Math.round(sy / size) });
    }
    return out;
  };
  // Cloth in one picture and not the other, the other seen in a mirror or not.
  const differ = (a: Uint8Array, b: Uint8Array, w: number, h: number, mirrored: boolean) => {
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        m[i] = (a[i] === 1) !== (b[y * w + (mirrored ? w - 1 - x : x)] === 1) ? 1 : 0;
      }
    }
    return m;
  };
  // What is walled in by cloth (can't reach the picture's edge without crossing cloth), of the kinds asked for.
  const walled = (cls: Uint8Array, w: number, h: number, kinds: number[]) => {
    const reached = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const j = stack.pop()!;
      if (reached[j] || cls[j] === 1) continue;
      reached[j] = 1;
      const x = j % w;
      if (x > 0) stack.push(j - 1);
      if (x < w - 1) stack.push(j + 1);
      if (j >= w) stack.push(j - w);
      if (j < w * (h - 1)) stack.push(j + w);
    }
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (kinds.includes(cls[i]) && !reached[i]) out[i] = 1;
    return out;
  };
  return (async () => {
    const found: Found[] = [];
    for (let k = 0; k < o.views; k++) {
      const at = (2 * Math.PI * k) / o.views;
      const here = await read(at);
      const { w, h } = here;
      for (const p of patches(walled(here.cls, w, h, [0, 2]), w, h, o.patch.hole)) found.push({ kind: 'dark hole', at, ...p });
      // From behind, the back of the garment hides the form: only a sliver of it shows over a back neckline or through
      // an armhole.
      if (Math.cos(at) < -0.45) {
        for (const p of patches(walled(here.cls, w, h, [3]), w, h, o.patch.behind)) found.push({ kind: 'seen through', at, ...p });
      }
      const near = await read(at + o.nudge);
      // Shaved twice: a sleeve hanging out from the form's axis sweeps a couple of pixels sideways over the nudge, a
      // long thin strip down its edge that is movement, not a jump; a patch that comes or goes is broad and survives.
      for (const p of patches(differ(here.cls, near.cls, w, h, false), w, h, o.patch.jump, 2)) found.push({ kind: 'jump', at, ...p });
      if (o.mirror && k > 0 && k < o.views / 2) {
        const other = await read(-at);
        for (const p of patches(differ(here.cls, other.cls, w, h, true), w, h, o.patch.mirror)) found.push({ kind: 'mirror', at, ...p });
      }
    }
    cv.dispatchEvent(new CustomEvent('allround-turn', { detail: { at: 0.6, probe: false } }));
    return found;
  })();
}

for (const look of LOOKS) {
  const name = [look.g, ...look.picks.slice(0, 1)].join(' ');
  test(`all round looks right from every side: ${name}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startWithExample(page);
    const main = page.getByRole('main');
    if (look.g !== 'Skirt') await switchGarment(page, look.g);
    for (const pick of look.picks) {
      await main.getByRole('tab', { name: look.tab, exact: true }).click();
      const b = main.locator('button[aria-pressed]').filter({ hasText: new RegExp(`^\\s*${pick}\\b`) }).first();
      if (await b.count()) await b.evaluate((el) => (el as HTMLElement).click());
    }
    await main.getByRole('tab', { name: 'Fabric', exact: true }).click();
    const more = main.locator('.fabric-more');
    if (!(await more.evaluate((el) => (el as HTMLDetailsElement).open))) await main.locator('.fabric-more > summary').click();
    const print = main.getByRole('radiogroup', { name: "What's printed on your fabric" }).getByRole('radio', { name: 'One-way' });
    if ((await print.getAttribute('aria-checked')) !== 'true') await print.click();
    await main.getByRole('group', { name: 'Garment view' }).getByRole('button', { name: 'All round', exact: true }).click();
    const cv = main.locator('canvas.all-round-canvas');
    await expect(cv).toBeVisible();
    await page.waitForTimeout(1200);

    const found: Found[] = await page.evaluate(check, { views: VIEWS, nudge: NUDGE, mirror: look.mirror, patch: { mirror: MIRROR_PATCH, jump: JUMP_PATCH, hole: HOLE_PATCH, behind: BEHIND_PATCH } });
    // Each failing view twice: as a maker sees it, and in the check's own colours.
    for (const f of found.slice(0, 6)) {
      for (const probe of [false, true]) {
        await cv.evaluate((el, d) => el.dispatchEvent(new CustomEvent('allround-turn', { detail: d })), { at: f.at, probe });
        await page.waitForTimeout(100);
        const file = `${f.kind.replace(' ', '-')}-${Math.round((f.at * 180) / Math.PI)}deg${probe ? '-check' : ''}.png`;
        await cv.screenshot({ path: info.outputPath(file) });
      }
    }
    const said = found.map((f) => `${f.kind} of ${f.size} px at ${Math.round((f.at * 180) / Math.PI)}° near (${f.x}, ${f.y})`);
    expect(said, `${name}: something strange as it turns`).toEqual([]);
  });
}
