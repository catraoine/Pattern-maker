// Drawing-likeness eval: for every case in evals/drawings/cases.json, seeds the app with that garment,
// its style choices and its fabric, then screenshots what the Style page draws (Form, Drawing, All round
// and the draw tool) at phone and computer size. When the case has a photo, a side-by-side of the photo
// and the app's views is written too, for scoring by eye (see evals/drawings/README.md).
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/eval-drawings.mjs [caseFilter]
//
// Screenshots land in evals/drawings/shots (not committed). BASE overrides the app's address.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const DIR = 'evals/drawings';
const OUT = `${DIR}/shots`;
const filter = process.argv[2];
mkdirSync(`${OUT}/side-by-side`, { recursive: true });

// Some sandboxes ship a Chromium here and can't download one; elsewhere Playwright's own browser is used.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const launch = existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {};

/** The example body the form drawings are sized from (slim, 176 cm). */
const BODY = {
  height: 176, waist: 62, full_hip: 90, waist_to_hip: 21.5, waist_to_knee: 62, waist_to_floor: 111, crotch_depth: 26, crotch_length: 65,
  full_bust: 82, high_bust: 79, neck: 33, shoulder_width: 38, shoulder_length: 12.5, across_back: 34, across_front: 31, nape_to_waist: 43,
  front_hps_to_waist: 44.5, bust_depth: 25, apex_separation: 17.5, underbust: 70, torso_loop: 150, armscye: 38, arm_length: 61, upper_arm: 25, wrist: 15,
};
const DEFAULT_SKIRT = { fit: 'regular', silhouette: 'a_line', length: 'knee' };
const DEFAULT_BODICE = { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist', sleeve: 'none', sleeveShape: 'straight', closure: 'back_zip' };
const KEY = { skirt: 'choices', dress: 'dress', bodice: 'bodice', tee: 'tee', trousers: 'trousers', jacket: 'jacket', coat: 'coat' };
const NOUN = { skirt: 'skirt', dress: 'dress', bodice: 'bodice', tee: 'T-shirt', trousers: 'trousers', jacket: 'jacket', coat: 'coat' };
const SIZES = { phone: { width: 390, height: 844, dsf: 2, mobile: true }, wide: { width: 1440, height: 900, dsf: 1, mobile: false } };

/** What the app keeps for a sewist who has measured and styled this garment. */
function savedFor(c) {
  const s = { unit: 'cm', values: BODY, choices: DEFAULT_SKIRT, garment: c.garment, bodice: DEFAULT_BODICE };
  s[KEY[c.garment]] = c.choices;
  if (c.fabric) s.finish = { fabric: c.fabric };
  return s;
}

async function sideBySide(page, c, sizeName) {
  const photo = `${DIR}/photos/${c.photo}`;
  if (!c.photo || !existsSync(photo)) return;
  const views = ['form', 'flat', 'round'].map((v) => `${OUT}/${c.id}-${sizeName}-${v}.png`).filter(existsSync);
  const img = (p) => `<img src="data:image/${p.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(p).toString('base64')}">`;
  const html = `<body style="margin:0;background:#141414;color:#eee;font:14px system-ui"><p style="margin:6px">${c.id}: photo, then the app's Form, Drawing and All round views</p><div style="display:flex;gap:10px;align-items:flex-start;height:700px">${[photo, ...views].map(img).join('')}</div><style>img{height:700px}</style></body>`;
  await page.setContent(html);
  await page.locator('body').screenshot({ path: `${OUT}/side-by-side/${c.id}-${sizeName}.png` });
}

async function run() {
  const { cases } = JSON.parse(readFileSync(`${DIR}/cases.json`, 'utf8'));
  const browser = await chromium.launch(launch);
  for (const [sizeName, sz] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: sz.dsf, isMobile: sz.mobile, hasTouch: sz.mobile, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const c of cases) {
      if (filter && !c.id.includes(filter)) continue;
      await page.addInitScript((s) => {
        localStorage.setItem('maison-trace-access', 'tester');
        localStorage.setItem('maison-trace-steady', '1');
        localStorage.setItem('pattern-maker:skirt', JSON.stringify(s));
        localStorage.setItem('pattern-maker:account', JSON.stringify({ onboarded: true, name: '', patterns: [], mode: 'all' }));
      }, savedFor(c));
      await page.goto(BASE + '/');
      await page.waitForTimeout(1500);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(800);
      const main = page.getByRole('main');
      try {
        const carry = main.getByRole('button', { name: /^Carry on with your/ });
        await carry.waitFor({ timeout: 15000 });
        await carry.click();
        await main.getByRole('heading', { level: 1, name: new RegExp(`^Style your ${NOUN[c.garment]}`) }).waitFor({ timeout: 15000 });
      } catch (e) {
        console.log(c.id, sizeName, 'could not reach the Style page:', e.message.split('\n')[0]);
        continue;
      }
      await page.waitForTimeout(400);
      const preview = page.locator('section[aria-label="Preview"]').first();
      const views = page.getByRole('group', { name: 'Garment view' });
      const shot = async (name) => {
        await page.waitForTimeout(350);
        const target = (await preview.isVisible().catch(() => false)) ? preview : main;
        await target.screenshot({ path: `${OUT}/${c.id}-${sizeName}-${name}.png` }).catch(() => page.screenshot({ path: `${OUT}/${c.id}-${sizeName}-${name}.png` }));
      };
      await shot('form');
      for (const [label, name] of [['Drawing', 'flat'], ['All round', 'round']]) {
        const b = views.getByRole('button', { name: label });
        if (await b.count()) {
          await b.first().click();
          if (name === 'round') await page.waitForTimeout(900);
          await shot(name);
        }
      }
      const formBtn = views.getByRole('button', { name: 'Form' });
      if (await formBtn.count()) await formBtn.first().click();
      const tool = main.getByRole('button', { name: 'Draw on your form', exact: true });
      if (!(await tool.isVisible().catch(() => false))) {
        const summary = main.locator('.drawmenu > summary');
        if (await summary.count()) await summary.first().click();
      }
      if (await tool.isVisible().catch(() => false)) {
        await tool.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${c.id}-${sizeName}-draw.png` });
      }
      await sideBySide(page, c, sizeName);
      console.log('done', c.id, sizeName);
    }
    await ctx.close();
  }
  await browser.close();
}
run();
