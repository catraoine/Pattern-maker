# What ships before 21 December 2026

**Adopted by Cat on 20 October 2026.** The app is frozen to this list until the stage 1 fit gate (20 sewists
averaging 4 of 5 on a skirt or bodice toile, decision on 21 December 2026). Everything else is either built
already, and labelled **In testing** in the app, or waits.

Why: every new feature adds support load, fit-test surface and things to explain, and none adds
sign-ups. One garment shown fitting ten real bodies beats twelve that cannot be.

## Ships

Four things, nothing else:

1. **Fit fixes.** Anything the early round (from 26 Oct), the full round (from 9 Nov) or a review finds wrong in
   a draft, and bugs in anything already live.
2. **Tester tools.** Tester codes, send to device, keep data, the "How did it fit?" question after printing,
   the four weekly counts (sign-ups by source, printed, fit reported, paid).
3. **Waitlist.** The sign-up page and the "tell me when it opens" cards.
4. **Real sign-in.** Accounts that survive a new phone, before the public launch.

**UX/UI fixes carry on (Cat, 20 October 2026).** The freeze stops new styling tools, garments and features. Making
the screens that already exist clearer, easier and better looking is not frozen: layout, wording, buttons, demo
videos for existing tools and fixes like these go ahead.

| What | Where | State on 20 Oct |
| --- | --- | --- |
| Fit fixes from the Fable review | PR #114 | queued |
| Height first, double-checks against height and weight | PR #112 | queued |
| Shorter mini, above-knee and midi lengths | PR #119 | queued |
| Tester codes, send to device, keep data | `src/ui/TesterCode.tsx`, `src/moveLink.ts`, `src/store.ts` | live |
| "How did it fit?" after printing, the four counts, In testing labels | PR #113 | queued |
| Waitlist and tester sign-ups | `src/screens/SignupScreen.tsx`, `netlify/functions/signup.mts` | live |
| Real sign-in | not started | build before the gate |

## Launch garments

Skirt, bodice, dress. They are the only garments on the landing page and in any video until the gate passes.
A garment joins them (`src/launch.ts`) when sewists score it 4 of 5 or better in a fit round.

## In testing (usable, labelled in the app, not promoted)

Each carries the "In testing" tag (`src/launch.ts`, `src/ui/TestingTag.tsx`):

| Feature | Where the tag shows |
| --- | --- |
| Trousers, T-shirt, jacket, coat | "What would you like to make?" and the Style heading |
| Menswear form | the form choice when measuring |
| The Collection and the Archive (numbered drops) | the Collection heading |
| Body Double dress form and draping on it | the dress form page and "Draw your lines" |
| Prints beyond checks | "What's the print?" in About your fabric |
| Pro files: DXF, measurement files, tech pack, 3D body | "More files" on Print |
| Size run, pattern file check, client book | each one's heading |

Lingerie and swimwear stay hidden (`?lingerie=preview`, PR #102). Tracé Engine, Atelier Nights, Deadstock and
Cut For You are sign-ups only: nothing more is built behind them before the gate.

## Already built when the freeze was adopted

Work finished by 20 October goes out in the next bundled release; where it is not on the list it sits under an
In testing tag. Nothing new starts.

| PR | What | Freeze |
| --- | --- | --- |
| #115 | All round: the form turns with the garment | built, In testing (draping) |
| #116 | No tape on the welcome-back screen | built, polish |
| #117 | Sideways rows slide only sideways | built, bug fix |
| #118 | Draw on your form: legs and arms | built, In testing (draping) |
| #120 | Welcome: quieter Terms line | built, polish |
| #121 | Enlarge the garment drawing | built, new feature |
| #122 | Re-recorded How it works video | built |

## Not until the gate passes

New garments, new tools, new revenue streams, promo film re-records, expansion languages, app store builds,
more mock-up rounds for screens that already work. Bugs in anything already live are fixed as found.

An ask that breaks the freeze is flagged before any work starts, with the cost, and Cat decides.
