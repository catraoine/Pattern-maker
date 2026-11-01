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

**Design options carry on (Cat, 31 October 2026: "the freeze is too strict").** New style choices on garments that
already exist (lapels, collars, necklines, hems, yokes, fullness, peplums) go ahead without a freeze flag. Each one
is In testing, with a row in the table below, until two testers sew it.

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
| Draw on it all round | Draw your lines, the all round switch | three testers draw a hem and a side on the turning garment and get the same pattern as drawn flat |
| Body Double | Account and the form page | one padded form checked against its person |
| Prints beyond checks | "What's the print?" in About your fabric | three testers cut a one-way or border print from the lay plan |
| Any colour | the colour dots on the Fabric tab | shop colourways match the picked colour on five fabrics |
| Exact colour | under Any colour | the first custom-dyed order delivered and matched |
| Pro files (DXF, measurement files, tech pack, 3D body) | More files on Print | one factory or dressmaker cuts from the pack |
| Size run | Print, For production | a graded run sewn in two sizes |
| Check any pattern file | Account | five outside files walked with no false alarm |
| Client book | Account | one dressmaker keeps three clients in it |
| The collection and the Archive | the Collection heading | drop 01 published |
| Projector mode | Print, Projector, and inside projector mode | two sewists cut a garment with it on their own projectors |
| Oversized and long tops (the big shirt: Oversized fit and Long length; Cat broke the freeze for it, 2026-10-31) | the Oversized fit and Long length chips on the top | two testers sew an oversized long shirt and it hangs straight, its sleeves lifting without pulling |
| Lowered peplum (the peplum sewn to a hem 6 to 12 cm below the waist, the waist still cinched; Cat broke the freeze for it, 2026-10-31) | the Peplum chips on a top longer than the waist | two testers sew a peplum lowered 6 to 9 cm and the waist stays nipped in above it |
| Oversized jackets and coats (boxy, dropped shoulders, no pads, a wider lapel rolling lower; Cat broke the freeze for it, 2026-10-31) | the Oversized fit chip on a jacket or coat | two testers sew an oversized jacket and it hangs open and straight, the dropped shoulders sitting past their own |
| Plunging V neckline (a V cut nearly to the waist on 2.5 cm straps; Cat broke the freeze for the SS27 slip, 2026-10-31) | the Plunge neckline chip on a top or dress | two testers sew a plunging slip and the V lies flat to the body without gaping |
| High-low peplum (a top's peplum curving down to hang 8 to 14 cm longer at the centre back; Cat broke the freeze for the SS27 lilac top, 2026-10-31) | the Peplum hem chips on a top with a peplum | two testers sew a high-low peplum and it falls smoothly from the sides to the longer back |
| Gathered skirt fullness (Soft 1.6, Full 2.2 or Dramatic 2.8 times the waist, in place of the fit's own; Cat asked for fullness choices for the SS27 D1 dress, 2026-10-31) | the Gathers chips on a gathered skirt or dress skirt | two testers sew a Full or Dramatic gathered skirt and the gathers sit evenly into the waist |
| Big peplum (1.4 times as deep, a flared one cut as a full circle, a gathered one 2.2 times its seam; Cat asked for a bigger peplum on the SS27 ice-blue top, 2026-10-31) | the Peplum size chips on a top with a peplum | two testers sew a big peplum and it stands out evenly from the waist |
| Peak, shawl and funnel collars, wide and plunging lapels on jackets and coats (Cat asked for more lapel and collar options, 2026-10-31) | the Collar and Lapels chips on a jacket or coat | two testers sew a peak or shawl lapel and it rolls cleanly from the break point, the collar sitting flat at the back neck |
| Flared jacket and coat hem (each seam bent out from the waist like a basque; Cat asked for the lilac blazer from her plaid-blazer picture, 2026-10-31) | the Flared chip below the waist on a jacket or coat | two testers sew a flared jacket and it stays close at the waist, kicking out evenly over the hips with a level hem |
| Drop-yoke skirt (a fitted yoke to below the hip, one deep gathered skirt below, Soft, Full or Dramatic; for the lilac suit, 2026-10-31) | the One, drop yoke chip under Tiers on a skirt | two testers sew a drop-yoke skirt and the yoke lies smooth over the hip, the gathers falling evenly below it |
| Ruffles, ruching, cape and balloon hem (ruffled hems and sleeve hems, ruched sides, cape, balloon hem) | the chips for each on the Style screens | three testers sew a ruffled hem, ruched sides and a cape and each hangs as drawn |

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

New garment types, new features, new revenue streams, promo film re-records, expansion languages, app store builds,
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
