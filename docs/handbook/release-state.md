# Release state

_Update this page whenever a release ships or a PR is queued._

## Live

**Release 45** (Oct 31, 2026, #242, main `efaa6c1`): Boxy dress fit + Self band belt as full launch
options (#241), How it works films re-recorded with the boxy mini, gold titles and Shop the fabric
(#239), projector upgrades: paper line-up, whole-table grid, Lines panel, loupe (#238, projector
still In testing), phone held sideways layouts (#237), Style step names Silhouette / Fullness with
Waist first (#243), handbook fonts + collection preview rename (#240). Release 44 (Oct 30, #235)
brought the accessibility fixes, re-recorded films and iPad layouts.

Live site: https://maisontrace.co (the cloud proxy blocks it; check
https://whimsical-mooncake-2cf9a9.netlify.app, the same site). Strangers see the waitlist; testers
get in with their tester link.

## Queued for "ship" (as of Oct 31, 01:15 UTC)

| PR | What | Owner thread |
| --- | --- | --- |
| #244 | Stop the page bounce on iPhone (Style) | UX/UI |
| #246 | Remove the AI-look photo strip from the Style page | UX/UI |

Re-record note: the films in #239 were cut before #243 renamed the dress questions; the recorder
now picks Silhouette / Fullness, so the next re-record works as is.

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
