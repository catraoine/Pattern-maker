# Maison Tracé

Sewing patterns drafted from your own measurements. Installable web app (PWA), hosted on Netlify.

## Crash reports, visit counts and sign-ups

The app sends one small request per visit (when the tab is hidden or closed) to `/.netlify/functions/report`, with
anonymous daily counts (visits; measured, styled, printed, photo, per garment) and any crash reports (at most five per
visit, each error once). No cookies, ids or IP addresses are stored. The "Be a fit tester" and "News" forms (linked
from Your account) post to `/.netlify/functions/signup`. Everything is kept in Netlify Blobs (stores `reports` and `signups`).

To read it all, set a read-out key:

1. In Netlify, open the site, then **Site configuration > Environment variables > Add a variable**.
2. Key `STATS_KEY`, value a long random string (for example from `openssl rand -hex 24`). Keep it private.
3. Redeploy (**Deploys > Trigger deploy**) so the function picks it up.
4. Open `https://<your-site>/.netlify/functions/report?key=<STATS_KEY>` (add `&days=90` for up to 90 days).

It returns JSON: `funnel` (the four numbers the business plan watches weekly, added up over the period: sign-ups by
source, patterns printed, fits reported, payments), `days` (daily totals), `crashes` (the latest 100 crash reports)
and `signups` (`testers`, `news`, `interest`). Without `STATS_KEY` set, the read-out is refused.

A link with `?src=pinterest` (plain lower-case words and hyphens) tags where a visitor came from. The tag stays on
their device, so a sign-up weeks later counts as `signup:pinterest`. No email or id goes with the count.

Which garments are launched and which carry the "In testing" tag is one list in `src/launch.ts`; the ship list to
the fit gate is `docs/SHIP-LIST.md`, and `docs/HOW-IT-FITS-TOGETHER.md` is the map for a developer new to the code.

## Fit tester codes

Photo readings are capped at 5 a day per visitor and 100 a day for the whole site (`src/photo/limit.ts`). Fit testers
type a code in Your account > Fit testing, which gives them 20 a day in a separate pool (600 a day for all testers),
so testing doesn't use up the site's 100. Set the codes in Netlify as `TESTER_CODES` (comma separated, at least 4
characters each, case doesn't matter), then redeploy. With no codes set, the tester box says every code is wrong.
Remove a code from the list to switch it off.

## Tests

- `npm test`: unit tests (vitest, files in `src/**/*.test.ts`).
- `npm run test:e2e`: end-to-end click-throughs (Playwright, in `e2e/`), each run at phone size (390×844) and desktop size (1280×800). The config starts `npx vite` on port 5199 itself. They cover a first visit from the welcome through measuring, styling each garment and downloading the A4 PDF; a returning visit after a reload; saving, renaming, deleting, backing up and restoring a pattern on the account screen; the Privacy and Terms pages from the welcome's fine print and from Your account, and back again by the header's back and the browser's; and the "Be a fit tester" sign-up form. Any console error fails the test.
  - First time on a new machine: `npx playwright install chromium`. Where a Chromium already sits at `/opt/pw-browsers/chromium`, that one is used.
  - Selectors go by role and the words on screen. When a screen's wording changes, the shared steps and the measurement values to type are in `e2e/fixtures.ts`.
  - `npx playwright test -c e2e --project phone` runs one size; `--headed` or `--ui` to watch.

Both run on every pull request (`.github/workflows/e2e.yml`).

## The tour video

The play button on the welcome's dress form plays `public/tour/walkthrough.mp4`, a captioned walkthrough recorded from the app itself. It was last re-recorded on 2026-10-20 at Cat's request; **re-record it once more at the very end, when the app is finalized** (Cat's rule, 2026-10-18). Until then it can lag behind the app. To re-record: start `npx vite --port 5173`, run `npm run record:tour` (needs ffmpeg), then copy the part start times and length it prints into `PARTS`, `TOUR_LENGTH` and `TOUR_LABEL` in `src/ui/TourPlayer.tsx`. The steps and captions it records are in `scripts/record-demo.mjs`.
