# Release state

_Update this page whenever a release ships or a PR is queued._

## Live

**Release 54** (Nov 2, 2026): Style screen sweep (#266): views are Front, Flat and All round (no Back
view), quiet Undo, fabric shop as one list with a buy strip, "Your picks" drop-down, worded Enlarge,
Length/Width hem handles, named step backs, and the header back arrow gone from Measure, Style and
Print (chapter names move between chapters). All round scored before it's shown, nightly sweep and
SS27 drape fixes (#263). Readiness check fixes: inches height boxes, named warnings, no near-empty
PDF pages (#265). How it works films: palette card on the aqua snakeskin, Shop the fabric strip (#264).
Earlier: Release 53 (#262 palette card), Release 52 (#255 knit swatches).

Live site: https://maisontrace.co (the cloud proxy blocks it; check
https://whimsical-mooncake-2cf9a9.netlify.app, the same site). Strangers see the waitlist; testers
get in with their tester link.

## Queued for "ship" (as of Nov 2, 14:15 UTC)

Nothing green is queued. Open drafts: #249 (SS27 cuts, In testing) and #259 (SS27 design options,
stacked on #249), both waiting on Cat's "apply".

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
