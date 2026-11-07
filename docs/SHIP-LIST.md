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
| Your own fabric, photographed | Your photo on the Fabric tab | five testers photograph their own fabric and say the drawing looks like their cloth |
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
| Oversized shirt cuffs (14 cm deep, 8 cm loose round the wrist, falling 3 cm over the hand, 3 buttons up a 14 cm placket; from Cat's ivory-shirt picture, 2026-11-01) | the Oversized cuff chip on a long straight or bishop sleeve | two testers sew oversized cuffs and they sit loose and level over the hand, the buttons lining up |
| Low-rise skirt (the skirt's top drafted about 6 cm below the waist, at most a quarter of the way to the hip, the hem kept where it was; Cat's SS27 knife-pleat skirt, 2026-11-01) | the Rise chips on a skirt | two testers sew a low-rise skirt and it sits level on the hip without slipping, the hem where it was |
| Bias slip mini (the bias slip skirt cut to mini or above-knee length, still at least 12 cm below the hip; Cat's SS27 Look 07 shell top and mini, 2026-11-02) | the Slip chip on a skirt cut above the knee | two testers sew a bias slip mini and it moulds over the hip and swings without twisting, the hem level |
| Open polo collar (a one-piece pointed collar with a little roll on a crew neck, over a faced centre-front slit with no buttons, the zip at the back; Cat's SS27 cropped polo set, 2026-11-02) | the Open polo chip under Collar on a top | two testers sew an open polo collar and the slit lies flat and open, the collar points sitting level on the chest |
| Ruffled trouser hem (a strip 7 cm deep gathered 1.8 times round each hem, the legs cut 7 cm shorter so they end where set; Cat's SS27 black cropped flares, 2026-11-02) | the Hem chips on trousers | two testers sew ruffled hems and the gathers sit evenly round each leg, the trousers ending where they set them |
| Bias slip side slit (up the left side seam as high as the hip line, the zip moved to the right side seam, its edges stayed with interfacing and rolled; Cat's SS27 lavender slip, 2026-11-02) | the Side chip under Slit on a bias slip skirt | two testers sew a slit bias slip and the slit edges hang straight without stretching or flaring, the top holding |
| Front pleats on trousers (one or two pleats on each front, cut by slashing the front down its crease line and spreading it 4 cm, or 3 cm each, the whole leg's length; the dart folds into the first pleat; for the SS27 gold python Bermuda, 2026-11-05) | the Front pleats chips on trousers | two testers sew a pleated front and the pleats lie flat and even from the waistband, releasing into the leg without pulling |
| Belt loops on trousers (five loops cut from one strip: centre back, each side seam, halfway across each front; 2026-11-05) | the Belt loops chips on trousers | two testers sew the five loops and a belt sits level in them, the loops clear of the pockets and the fly |
| Patch and slant pockets on skirts and dresses (a 14 by 15 cm patch pocket on each front's hip below the dart, or the trouser slant pocket cut in at the front waist; Cat's styling options round 1, 2026-11-07) | the Patch and Slant front chips under Pockets on a skirt or dress | two testers sew patch pockets and two sew slant pockets, and each lies flat on the hip without gaping, the slant opening staying closed when standing |
| Barrel-leg trousers (the side seam bows out plumb through the knee, 0.62 of the hip round it, and curves back in to a 0.4 hem; Cat's styling options round 1, 2026-11-07) | the Barrel chip under Leg on trousers | two testers sew barrel-leg trousers and the leg curves out evenly round the knee and in to the ankle, with no break in the side seam |
| Back welt pockets on trousers (a 13 cm single welt on each back, 7 cm below the waist and parallel to it, between the darts, which are cut 9.5 and 8.5 cm long; Cat's styling options round 1, 2026-11-07) | the Welt pockets chip under Back pockets on trousers | two testers sew back welt pockets and they lie flat and level with the waist, the corners clean, the shortened darts smooth over the seat |
| Drop-yoke skirt (a fitted yoke to below the hip, one deep gathered skirt below, Soft, Full or Dramatic; for the lilac suit, 2026-10-31) | the One, drop yoke chip under Tiers on a skirt | two testers sew a drop-yoke skirt and the yoke lies smooth over the hip, the gathers falling evenly below it |
| Ruffled hem on a gathered skirt (the dirndl's panels shortened by the ruffle's depth, a band 1.8 times the hem gathered on below; for the SS27 pink gown, 2026-11-01) | the Ruffled hem chip on a gathered skirt | two testers sew a gathered skirt with a ruffled hem and the ruffle hangs evenly, the length kept |
| Balloon peplum (the peplum gathered at its hem onto a shorter underskirt, 2 cm up, so it puffs out and turns under; cut 1.6 times its seam and about a third deeper for the puff; from Cat's SS27 taffeta-top picture, 2026-11-06) | the Balloon chip under Peplum on a top | two testers sew a balloon peplum in a crisp cloth and it puffs out and turns under all round |
| Plunge to the waist (the plunge's V run on to 2 cm above the waist seam in place of 7; from Cat's SS27 lace-blouse picture, 2026-11-06) | the To the waist chip under Plunge depth on a plunge neckline | two testers sew a plunge to the waist and the V lies flat without gaping |
| Full puff and bishop sleeves (a puff cut 1.9 times the arm with a crown 7 cm higher, a bishop swelling to 2.3 times the arm at the hem, in place of 1.3 and 1.5; from Cat's SS27 lace-blouse picture, 2026-11-06) | the Full chip under Sleeve fullness on a puff or bishop sleeve | two testers sew a full bishop sleeve and it gathers evenly into its cuff |
| Cropped top (the waist-length bodice cut off under the bust, as a dress's empire seam cuts it, 6 cm under the bust point and above any side dart; a peplum hangs from the cut edge; from Cat's SS27 taffeta-top picture, round 4, 2026-11-06) | the Cropped chip under Length on a top | two testers sew a cropped top and its hem sits under the bust without riding up |
| Sleeveless jacket (waistcoat): the jacket without sleeves, no shoulder pads, armholes bagged out with the lining; from Cat's SS27 black vest picture, 2026-11-06 | the Sleeveless chip under Sleeves on a jacket or coat | two testers sew a sleeveless jacket and its armholes lie flat and close to the body, bagged out cleanly with the lining |
| Knit dress: the T-shirt carried past the hip to mini, above-knee, knee, midi or maxi, straight, close, A-line or skater skirt, rib bands; Cat broke the freeze for the Garment range, 2026-11-07 | Knit dress on "What would you like to make?" | two testers sew a knit dress and it skims the hip without riding up, the hem hanging level |
| Hoodie: the T-shirt block with a lined two-piece hood, kangaroo or split pockets, zip-up or half-zip front, rib cuffs and band (Garment range, 2026-11-07) | Hoodie on "What would you like to make?" | two testers sew a hoodie and the hood sits round the face without pulling the neck back |
| Jumpsuit: the top and trousers joined at the waist, cut lower in the body to sit in, back zip or buttons and fly; playsuit at shorts length (Garment range, 2026-11-07) | Jumpsuit on "What would you like to make?" | two testers sew a jumpsuit, sit down in it without the crotch pulling, and the waist seam sits at their waist |
| Lace drawn on the turning garment (All round; the cloth thinned to a net between flower motifs on a 4 cm trellis, so the form shows through between them, in place of a plain sheer; 2026-11-06) | All round, with a lace fabric picked | the lace drawing matched against two bought laces |
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
