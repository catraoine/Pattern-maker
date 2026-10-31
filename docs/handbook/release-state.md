# Release state

_Update this page whenever a release ships or a PR is queued._

## Live

**Release 46** (Oct 31, 2026, #245): iPhone page no longer bounces on Style (#244), AI-look photo
strip removed from Start from a look (#246), welcome headline H2 "Drafted to you" and Make this look
opens in the look's fabric (#247), All round goes quiet in calico with one check line (#248).
Release 45 (Oct 31, #242) brought the Boxy dress fit and Self band, re-recorded films, projector
upgrades, phone-sideways layouts and the Silhouette / Fullness step names.

Live site: https://maisontrace.co (the cloud proxy blocks it; check
https://whimsical-mooncake-2cf9a9.netlify.app, the same site). Strangers see the waitlist; testers
get in with their tester link.

## Queued for "ship" (as of Oct 31, 06:00 UTC)

Nothing green is queued. #249 (Oversized fit and Long length for tops, In testing) is a draft.

Re-record note: the How it works film needs re-recording after #248 (All round now turns in calico).

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
