# Memory audit, Oct 30, 2026

Done while building this handbook, to answer "have we lost anything important already?"

## Short answer

Nothing is gone for good: every decision checked still exists somewhere, either in a memory file or
in a thread. But a lot of it had become **invisible to new threads**, which is the same risk in practice.

## Why things were going missing

1. **The memory index is over its size limit.** Only its first 141 of 166 lines load, so 25 lines
   were cut for every new thread. Those included standing rules: "better way first", "reviews stay",
   "don't resolve until Cat has seen it", Cat's date style, the accessibility review, the Measure page
   options and fabric rendering decisions.
2. **52 memory files were never listed in the index at all**, so no new thread knew to open them.
   They include the feature freeze rules, the team plan, real sign-in status ("do not tell Cat it
   hasn't started"), social accounts and handles, marketing, messaging, influencers, the domain,
   the release log (Releases 41 and 42), auto-merge, the AI-super-user path, Amber Grant, Anthropic
   spend, brand palette, collections naming, email check, film history and the drawing rules.
3. **Old index lines were never updated** when a later decision replaced them (see below).

## Recovered into this handbook

Standing rules (working-with-cat page), the brand palette and naming rules, the AI stance word list,
the freeze adjustment for UX/UI polish, the In testing registry, the drawing rules and pattern-true
rule, the release procedure, the current PR queue, the fit test dates, the affiliate state, the
community limits, the trademark choice, pricing, the Base/Target plan cases, the scheduled routines.

## Contradictions found (latest decision kept in the handbook)

| Topic | Older statement | Current |
| --- | --- | --- |
| Fit gate / freeze end | 21 Dec 2026 (index line, feature-freeze file, action plan) | Jan 18, 2027 |
| Launch | Jan 25, 2027 (drop schedule, social story) | Feb 11, 2027 |
| Sign-in | "not started" (feature-freeze file); "no database yet" (HOW-IT-FITS-TOGETHER.md) | Built, live behind `?signin=preview`, switch-on Dec 7 to 11 |
| Prices | Premium $5/mo or $39/yr, Maker $15 (revenue streams file) | Premium $49/yr, Maker $25/mo |
| Plan headline | $43.5k budget, $6.5k/mo profit (stress test, still in the index as "APPLIED") | Base case 12k actives; old numbers are the Target case |
| Drop price | $32 per drop | $28 |
| Drops vs collections | "Drop 01 The Dress", "drop schedule" | Collections for seasons; drop only for the numbered sewist piece |
| Measuring order | Height first (body checks, Oct 20) | Waist first, height last (Release 13) |
| Tape numbers | Numbers from 1 (tape width, Oct 27) | No numbers anywhere (Oct 28) |
| Fable aesthetic review | "HOLD until tape work ships" (index) | It ran Oct 21 and shipped as Release 14 |
| Evan's start | Hours and agreement from Nov 2 (team, tax reminders) | Available only after Nov 6 (Oct 27) |
| Release cadence | "Bundled, 2 to 3 a week" | In practice almost daily (Releases 37 to 42 in three days) |

## Confirmed by Cat (Oct 30)

- **Waitlist kill rule date:** Feb 11, 2027. Jan 25 stays only as the ~830 checkpoint.
- **Amazon Associates payout account:** the Maison Tracé chequing (update it in Associates if it still
  shows the personal account).
- **CJ account number:** CJ's own account emails (Oct 26) name one company ID; the other number in
  memory was a mistake. One account only.
- **Measuring film:** films at the Nov 8 shoot.

## Still open

- **To-do list:** two different links are in use for "Cat's to-do list". Check they're the same doc.
- **Evan's one-page note:** due "before Nov 2"; no record it's signed (Nov 1 reminder is set).
- **Netlify credits:** nobody has checked the monthly credit use since the Friday digest was paused,
  while releases went near-daily.

## Waiting and at risk of being forgotten

- **Mastering measuring film:** option C, films at Shoot 1 on Nov 8 (confirmed Oct 30). The Media:
  Measuring video thread still needs to prep the shot list for that day.
- **maisontrace.com offer:** ~US$400 sent Oct 20; no reply recorded.
- **Taste brief** questions Q2 to Q5 still open since Oct 19.
- **Drop schedule** open decisions (who wears Drop 02, Thursday drop day, stage 4 fabric line).
- **Lingerie:** bra pattern cutter still to book; garment sketch and lining option not built.
- **Repo is public** (by design, for the paid code review). Business docs stay out of it.
- **Thread state:** "Tape journey and measuring order" still shows as blocked though its work shipped
  Oct 21.

## Fix going forward

Every department reads its handbook page before starting and updates it when a decision changes.
Memory keeps one-line pointers; the handbook holds the current truth.
