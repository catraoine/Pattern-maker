# Drawing-likeness eval

Does what the app draws (the Form view, the Drawing view, All round) look like the garment in a photo?
The photo-to-pattern eval in `evals/photo` scores what the reader *says* about a photo; this one scores
what the sewist *sees* once those choices are in the Style page.

- `cases.json`: 38 photos (Cat's wardrobe, shop product shots, the ten CC skirt photos), each with the
  style choices and fabric the app would need to match it, and a hand score per part.
- `node scripts/eval-drawings.mjs`: seeds the built app with each case and screenshots every view at phone
  and computer size into `shots/`, with a photo-vs-app side-by-side when the photo is present (see
  `photos/README.md` for where the photos live).
- `npm run eval:likeness`: turns the hand scores into `results/likeness.md`.

## Scoring

Nine parts, each 1 (the drawing shows it), 0.5 (roughly), 0 (missing or wrong) or null (the photo has
nothing to show, e.g. sleeves on a skirt): silhouette, neckline, sleeves, length, waist (seam position,
belt, elastic), details (pockets, collar, buttons, pleats, ruffles, drape), print, colour, fabric (does it
read as denim, leather, sheer, fleece...). A case's likeness is the mean of its scored parts.

## How to re-run after a drawing change

1. `npm run build && npx vite preview --port 4173`
2. `node scripts/eval-drawings.mjs` (or one case: `node scripts/eval-drawings.mjs b03`)
3. Look at `shots/side-by-side/*.png`, update the scores in `cases.json`, set `scored` to the release.
4. `npm run eval:likeness` and compare the averages with the last run in `results/likeness.md`.

## First run: 2026-10-24 (Release 23 with PR #158 and #162 applied)

65% overall. Length 100%, waist 82%, sleeves 71%, silhouette 70%, neckline 69%, colour 68%,
fabric 42%, details 29%, print 27%. See the findings doc "Do the drawings match the garment? Fable review".
