# Release state

_Update this page whenever a release ships or a PR is queued._

## Live

**Release 52** (Nov 2, 2026, #255 + #258): the T-shirt's Fabric step gets eight knit swatches
(Jersey, Slub, Modal, Rib, Interlock, Waffle, French terry, Ponte); picking one sets fibre, weight and
drape, and a warning shows when the knit stretches less than the stretch picked. The e2e CI job is
pinned to ubuntu-24.04 (Playwright can't install Chromium on 26.04). Handbook: in-app Claude guide parked.
Earlier: #257 (How it works films re-cut: sewn All round, shorter Style page, champagne words), #256
(All round sewn from the pattern pieces), Release 49 (#254, Style journey J1 to J8), Release 48
(#252, Style back arrow), Release 47 (#251, points follow the finger).

Live site: https://maisontrace.co (the cloud proxy blocks it; check
https://whimsical-mooncake-2cf9a9.netlify.app, the same site). Strangers see the waitlist; testers
get in with their tester link.

## Queued for "ship" (as of Nov 2, 03:30 UTC)

Nothing green is queued. Open: #260 (Collection recolour to the Paris SS27 palette; colours still
being settled, held back from Release 52 on purpose), drafts #249 (SS27 cuts, In testing) and #259
(bias slip mini lengths, stacked on #249). This handbook update rides the next release.

## Waiting on Cat's "apply" (not built)

- Accessibility review A1 to A7, and the small-caps size (A 11px / B 12.5px / C 13.5px; Claude: C).
- Draw-in-All-round "B Pull the lines" handles (later, when Cat asks).

## How a release is done

1. Cat writes "ship" in the working thread.
2. Merge **every** green PR, not just the asking thread's: merge them into one release branch, one CI
   run, one merge to main. Close stacked PRs with a "shipped in #NN" comment.
3. Check the live build, send Cat the link (open in Safari), list any In testing items, tell the
   Demo videos thread if a visible change needs a re-record.
4. Log it in project memory's release log and update this page.

Releases are bundled to save Netlify credits (3,000/month plan, about 15 credits a production
deploy; previews are nearly free). Never turn on credit recharge. A PR that conflicts with main gets
no Tests run on GitHub, so merge main in first.

## Dates

- Feature freeze and fit gate: Mon Jan 18, 2027. Launch: Thu Feb 11, 2027.
- Sign-in switch-on: fix week, Dec 7 to 11, 2026.
- Paid developer code review: post the job ~Nov 23, report by Dec 11.
- Re-record the How it works film and tool demos once more when the app is declared final.
