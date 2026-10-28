# What ships before 18 January 2027

**Adopted by Cat on 20 October 2026.** The app is frozen to this list until the stage 1 fit gate (20 sewists
averaging 4 of 5 on a skirt or bodice toile, decision on 18 January 2027; Cat moved it from 21 December 2026 on 22 October 2026, launch now Thursday 11 February 2027). Everything else is either built
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
| Real sign-in | `src/cloud/`, `src/ui/CloudAccount.tsx`, `netlify/functions/delete-account.mts`, `supabase/` | built, hidden behind `?signin=preview` until the 7 to 13 Dec fix week |

## Launch garments

Skirt, bodice, dress. They are the only garments on the landing page and in any video until the gate passes.
A garment joins them (`src/launch.ts`) when sewists score it 4 of 5 or better in a fit round.

## In testing (usable, labelled in the app, not promoted)

Each carries the "In testing" tag. The list below is the registry in `src/launch.ts` (`TESTING_TOOLS` for tools,
`LAUNCH_GARMENTS` for garments); `src/launch.test.ts` fails the build if a tag on any screen is missing from it, an
entry is on no screen, or this table no longer names them all. The Account page shows the same list under "Still in
testing". A tag comes off by hand, once its proof is in: delete the entry and the tag (or move the garment to
`LAUNCH_GARMENTS`). The fit gate release on 18 Jan 2027 does the batch.

| Still in testing | Where the tag shows | Comes off when |
| --- | --- | --- |
| Trousers, T-shirt, jacket, coat (and lingerie while hidden) | "What would you like to make?" and the Style heading | sewists score it 4 of 5 or better at the fit gate |
| Draw your lines | Style, Draw on your form | fit testers draw a hem, a neckline and a side and the pattern follows |
| Body Double | Account and the form page | one padded form checked against its person |
| Prints beyond checks | "What's the print?" in About your fabric | three testers cut a one-way or border print from the lay plan |
| Any colour | the colour dots on the Fabric tab | shop colourways match the picked colour on five fabrics |
| Exact colour | under Any colour | the first custom-dyed order delivered and matched |
| Pro files (DXF, measurement files, tech pack, 3D body) | More files on Print | one factory or dressmaker cuts from the pack |
| Size run | Print, For production | a graded run sewn in two sizes |
| Check any pattern file | Account | five outside files walked with no false alarm |
| Client book | Account | one dressmaker keeps three clients in it |
| The collection and the Archive | the Collection heading | drop 01 published |

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

## Exceptions Cat approved

**Styling gaps (Cat, 23 October 2026).** After the waistline (#147), Cat approved all 15 ranked styling gaps
from the [Styling gaps audit](https://claude.ai/artifact/K1z78vim85e8dr1rvwwsgX), on this schedule: the top 7 by
mid-November so the 40 testers sew them, the other 8 by mid-December for the January round. Anything that
hasn't passed at the gate keeps its "In testing" tag. In order: sleeve length anywhere with cap and flutter
sleeves; gathered skirt; mock or funnel neck; shirt dress; shift or sheath dress; halter neck; wrap styles;
then slits, skirt waists, cuffs, ties and bows, back details, drop shoulder and raglan, skirt yoke and button
front, ruffles and shirring.
