# Release state

_Update this page whenever a release ships or a PR is queued._

## Live

**Release 42** (Oct 30, 2026, #228, main `5506136`): the phone tag of picks shows a slider-set sleeve
or waist-seam length. Release 41 (Oct 29, #227) brought the balanced phone Style page, the SS27
collection, projector kit and sideways mode, All round seat fix and longer films.

Live site: https://maisontrace.co (the cloud proxy blocks it; check
https://whimsical-mooncake-2cf9a9.netlify.app, the same site). Strangers see the waitlist; testers
get in with their tester link.

## Queued for "ship" (as of Oct 30, 07:40 UTC)

| PR | What | Owner thread |
| --- | --- | --- |
| #229 | How it works films and Watch demo clips on Release 41, projector demo, welcome opening, Parma Shirt, "Your pattern, in seconds." | Media: Demo videos |
| #230 | First Measure page: C Tape Lines, string tied at the waist, CM / IN once | UX/UI: Measure |
| #231 | Matte charcoal form and crisp plain cloth on Style drawings | UX/UI: Fabric rendering |
| #232 | Photo shown as a champagne Polaroid on the photo screens | UX/UI: Style & Photo |
| #244 | No rubber-band page bounce on iPhone (Next bar no longer jumps while turning All round) | UX/UI: Stop the page bounce |

Order note: #229's Measure chapter is re-recorded after #230 ships, and films need re-recording after
#231. Ship them together, then let Demo videos re-record.

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
