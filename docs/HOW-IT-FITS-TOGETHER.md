# How the app fits together

A plain-language map for a developer who has never seen this code, so a bug can be fixed by someone
other than the person who wrote it. Everything was written with an AI coding assistant; the tests are
the engine's specification, so read them before the code.

## The shape of it

- **One web app, installable on a phone (PWA).** Vite + React + TypeScript, in `src/`. `src/main.tsx`
  mounts `src/App.tsx`, which holds the screens and the saved state. `vite-plugin-pwa` adds the service
  worker; `src/swUpdate.ts` handles updates.
- **Hosted on Netlify.** `netlify.toml` builds with `npm run build` and serves `dist/`. Every merge to
  `main` deploys. Server code is in `netlify/functions/*.mts` (one file per endpoint).
- **No database yet.** Everything a person makes stays on their device in `localStorage`
  (`src/store.ts`, `src/account.ts`); toile photos sit in IndexedDB (`src/photoStore.ts`). A backup
  file or a send-to-device link (`src/moveLink.ts`) moves it between devices. Real sign-in is a stage 2 item.

## The drafting engine (`src/engine/`)

Pure TypeScript, no React, one file per garment: `skirt.ts`, `bodice.ts`, `dress.ts`, `trousers.ts`,
`tee.ts`, `outerwear.ts`, `slip.ts`, `corset.ts`, with `sleeve.ts`, `collar.ts`, `pockets.ts`, `seams.ts`,
`drape.ts`, `hem.ts` as the shared parts. Each takes measurements (cm) and style choices and returns
`Piece[]` (`piece.ts`): closed outlines in cm with seam allowances, notches, grain lines and labels.

Around it: `fitting.ts` (toile corrections applied the way a pattern cutter would), `grading.ts`,
`qc.ts` and `checkFile.ts` (seam-length and curve checks), `layplan.ts` (cutting layout and metres),
`allRound.ts` and `body3d.ts` (the 3D previews), `instructions.ts` and the `*Guide.ts` files (sewing steps).

## Style choices and screens

`src/garments.ts` defines the choices saved for each garment and what is allowed with what.
`src/screens/*StyleScreen.tsx` show them inside `src/ui/StyleLayout.tsx`. `src/measurements.ts` and
`src/measureFlow.ts` define the measurements and which garment needs which. `src/launch.ts` says which
garments are launched and which carry the "In testing" tag.

## Output

`src/engine/export.ts` lays pieces onto pages; `pdf.ts` writes the PDF (pdf-lib, tiled A4/Letter, A0,
projector); `dxf.ts` and `importDxf.ts` exchange with CLO, Seamly2D and factories; `techpack.ts` and
`marker.ts` make the maker pack. `src/screens/ExportScreen.tsx` is the print screen.

## Server functions (`netlify/functions/`)

| File | Does |
| --- | --- |
| `analyze-photo.mts`, `describe-idea.mts` | Call the Claude API (key in Netlify env `ANTHROPIC_API_KEY`); daily caps in `src/photo/limit.ts` |
| `report.mts` | Anonymous daily counts and crash reports; GET with `?key=STATS_KEY` returns the read-out, including the four weekly numbers under `funnel` |
| `signup.mts` | Waitlist, tester and interest sign-ups |
| `fit-feedback.mts` | Fit notes a sewist chose to send (no names) |
| `tester.mts` | Checks a tester code (`TESTER_CODES` env) |

All storage is Netlify Blobs. Validation shared with the client lives in `src/server/`.
If the Claude API or Blobs is down, drafting and printing still work; only photos and counts pause.

## Tests are the specification

- `npm test`: unit tests (vitest, `src/**/*.test.ts`). The engine tests check seam lengths match,
  curves are smooth, and pieces come out right for random bodies (`randomBodies.ts`). A drafting change
  that breaks one is wrong until a sewist says otherwise.
- `npm run test:e2e`: Playwright click-throughs in `e2e/`, at phone and desktop size. `e2e/fixtures.ts`
  holds the shared steps and the words on screen the tests look for.
- Both run on every pull request (`.github/workflows/e2e.yml`).

## Fixing a bug, step by step

1. Reproduce it in the app (`npm run dev`) or write the failing unit test first.
2. Find the file: a wrong shape is in `src/engine/<garment>.ts`; a wrong word or layout is in
   `src/screens/` or `src/ui/`; a wrong count or sign-up is in `netlify/functions/` and `src/server/`.
3. Change as little as possible, run `npx tsc -b && npm test`, then the e2e suite.
4. Open a pull request. CI runs both suites; Netlify builds a deploy preview to click through on a phone.
5. Merge to `main`; Netlify deploys. Releases are bundled a few times a week to save build credits.

## Things to know

- Measurements are always cm inside; inches are converted at the edges (`src/measurements.ts`).
- Nothing personal leaves the device unless the person taps send: sign-ups, fit notes and photo readings
  are the only outbound data, and photos are never stored on the server.
- Billing is not wired yet (`BILLING_ON` in `src/plans.ts`); the `paid` count is defined but nothing sends it.
