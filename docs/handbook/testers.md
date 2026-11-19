# Testers (Product Dev: Sewist Fit Testing)

Full plan: "Sewist fit test plan" Claude Doc, linked from the business plan (Appendix A).
Tester names, emails and codes live there and in Cat's Gmail, never in this repo.
- **Tester codes must never match anything in this repo** (Nov 3, 2026). The example codes in the code and
  tests (TOILE-ONE, toile-two) were once also the real ones; anyone reading the public code had them. Real codes
  are made up fresh, live only in Netlify's TESTER_CODES and in tester emails, and are rotated if they ever
  appear in a commit, screenshot or post.

## Dates (moved Oct 22)

| When | What |
| --- | --- |
| Oct 22 to Sun Nov 8 | Early round: a handful of skilled sewists (Evan's seamstresses, Cat's friends and family), each sews a skirt or bodice toile |
| Nov 4 (opens) to Nov 8 | Tester call for the full round; sign-up asks "Have you sewn a jacket or coat?" |
| Nov 9 to 13 | Fixes from the early round |
| Nov 13 | Full-round invites |
| Nov 16 to Dec 6 | Full round: accept 24 so 20 finish, spread over six hip bands; each tester sews a dress, skirt or top of their choice; the call shows two example SS27 looks, a dress and a skirt with a top, and testers can change the length or style (Cat, Nov 1); plus one tester sews a boxy dress (Cat, Oct 30: Boxy launches untagged) |
| Dec 7 to 11 | Fix week (sign-in switches on) |
| Jan 4 to 17 | Round 2 |
| **Mon Jan 18, 2027** | **Fit gate**: 20 sewists averaging 4 of 5 on a skirt or bodice toile |
| Thu Feb 11, 2027 | Launch |

## Recruiting (Nov 1)

The Oct 31 carousel got no applicants: brand-new accounts, no garment shown, email-to-apply. The plan is the
"Fit testers: why nobody applied, and the plan" Claude Doc: the call leads with the looks turning in All round,
applications go through a 2-minute Google Form (script in the shared fit-test folder), and most testers come from
direct asks (early testers bring a friend, Facebook pattern-tester groups, DMs, Vancouver fashion schools), with
paid sewists as the backstop if fewer than 16 good applicants by Nov 8.

## How it runs

- Testers use their tester link (the site otherwise shows the waitlist). Measurements stay on the
  device they were typed on; "Send to another device" moves them to a computer to print.
- Reports come through the branded Google Form; photos by email. Anything else in the app (stuck, broken, confusing) goes
  through Help & feedback at the foot of Your account; notes appear in the report read-out beside the crash reports. Social-share consent is asked:
  face fine / hands only / no. With testers Cat hasn't met, keep the photo ask soft and optional.
- **Thank-you:** home sewists a $20 voucher (+ Premium for a year + credit); pros $80 flat (plus
  copy-shop print cost); jacket/coat testers in the full round a $30 voucher.
- **Wed + Sun** a scheduled reader checks the form sheet and tester mail, updates the tracker,
  drafts replies (drafts only) and posts a ~5-line summary in the Sewist Fit Testing thread.
- Replies often come by text, not email: ask Cat before calling someone unconfirmed.
- Show Cat every draft before sending. Any email with a link stays a draft for Cat, who pastes the
  clean link herself (see [Working with Cat](working-with-cat.md), "Links in emails").
- A paid pattern-cutter review (a Vancouver studio) checks the drafting itself; due first week of
  November, balance paid after.

## Fewer, better tester emails (Nov 18)

Cat: "We want to minimize the emails to testers", then "use sensible reasoning, not extreme swings". Before emailing
testers, ask whether it can be avoided: a quick app fix (make the app match an email already sent), or waiting for an
email that is already planned. If testers really need to know, or an email would genuinely help them, send it, only to
the testers it affects, short and warm. First use: the pattern PDF was changed to match the "You're in" email
(pattern code at the top of page 1, test square on page 2) instead of emailing every tester a correction.

## Tester emails with links (Nov 19)

The Gmail connector turns every link it is given into a google.com/url redirect, and testers saw those links as
blank (two invites, Nov 19). Cat: "figure out how to just put the links in properly yourself". So tester emails with
links go out through the app's own email service instead (`netlify/functions/tester-mail.mts`), from
hello@maisontrace.co, with the links exactly as written. Each email goes to one tester only, links may point only to
maisontrace.co and our Google forms, every email is copied to Cat's inbox and replies go to her, and a reply carries the
tester's Message-ID so it stays in her conversation. Up to 25 a day. It needs a key that lives only in Netlify and with
the Community Lead thread, never in the repo. Tester emails link to the fit form as maisontrace.co/fit-form: emails
carrying the Google Form's own address never reached Gmail (Nov 19 tests), while maisontrace.co links arrived. Emails without links can still go from Gmail. The send word rules don't
change: nothing goes to a tester without Cat's OK on the exact text.



Wrong print scale (measure the 10 cm square), Letter vs A4, phone-only testers (use Send link and a
copy shop), opening the site without their link, switching devices, self-measuring errors, the
bodice's estimated upper-body measurements, stretchy toile fabric, forgetting the form or photos.

## Readiness checks

- **Nov 2 (before the full round):** the stranger path walked on the live site for four bodies across the hip
  grid on phone and computer, with 48 PDFs read page by page. Patterns true to scale, every seam walked,
  pages line up. Three fixes on #265 (inches height boxes, named warnings, near-empty pages). The walk
  scripts and PDF checker live in the project folder under readiness-check/spec so the run can be repeated
  after each fix week. A large body's dress is 34 Letter pages: point big-size testers at the free A0 file and a copy shop.
