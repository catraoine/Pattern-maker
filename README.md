# Maison Tracé

Sewing patterns drafted from your own measurements. Installable web app (PWA), hosted on Netlify.

## Tests

- `npm test`: unit tests (vitest, files in `src/**/*.test.ts`).
- `npm run test:e2e`: end-to-end click-throughs (Playwright, in `e2e/`), each run at phone size (390×844) and desktop size (1280×800). The config starts `npx vite` on port 5199 itself. They cover a first visit from the welcome through measuring, styling each garment and downloading the A4 PDF; a returning visit after a reload; saving, renaming, deleting, backing up and restoring a pattern on the account screen; and the Privacy and Terms pages from the footer. Any console error fails the test.
  - First time on a new machine: `npx playwright install chromium`. Where a Chromium already sits at `/opt/pw-browsers/chromium`, that one is used.
  - Selectors go by role and the words on screen. When a screen's wording changes, the shared steps and the measurement values to type are in `e2e/fixtures.ts`.
  - `npx playwright test -c e2e --project phone` runs one size; `--headed` or `--ui` to watch.

Both run on every pull request (`.github/workflows/e2e.yml`).
