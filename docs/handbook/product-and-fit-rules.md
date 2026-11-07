# Product and fit rules

## What the app is

One installable web app (PWA) for phone and computer, hosted on Netlify from this repo. People
measure, pick or photograph a style, and print a pattern drafted to their measurements. Data stays
on the device; real sign-in (Supabase, email code or Continue with Google) is built and hidden behind `?signin=preview`, to be
switched on in the fix week (Dec 7 to 11). Code map: [HOW-IT-FITS-TOGETHER.md](../HOW-IT-FITS-TOGETHER.md).

## The feature freeze (to Jan 18, 2027)

Source of truth: [SHIP-LIST.md](../SHIP-LIST.md).

- **Ships:** fit fixes and bugs, tester tools, the waitlist, real sign-in.
- **Carries on without a flag** (Cat, Oct 20): UX/UI fixes and polish to screens that exist
  (layout, wording, buttons, motion, drawings, demo videos).
- **Design options carry on without a flag** (Cat, Oct 31: "the whole point of the app is for people
  to be able to design what they want"): new style choices on garments that exist (lapels, collars,
  necklines, flared hems, yokes, fullness, peplums and the like) go ahead. Each is In testing until a
  sewist fit-tests it, and must pass its sweep tests before it ships.
- **Still breaks the freeze:** a whole new garment type with its own block (wired bras, say), a new
  feature or revenue stream, or anything that would push the Jan 18 fit gate or the Feb 11 launch.
  Say so in one line with the cost before starting, then do what Cat decides.
- **Launch garments:** skirt, bodice, dress. Everything else usable carries an **In testing** tag,
  listed in the registry in `src/launch.ts` (a test fails if a tag is unregistered). Tags come off only
  with their proof; the fit gate release on Jan 18 does the batch. List tagged items in ship replies.
- **Oversized and Long tops** (Oct 31, freeze broken for the big Parma Shirt, In testing): Oversized is a top's own fit, 26 cm
  of ease, no darts, straight from the bust, worn with dropped shoulders; Long runs 14 cm past the hip. Not offered on dresses.
- **Boxy** (Oct 30) is the dress's fourth fit, a full launch fit (Cat took off In testing, Oct 30): straight from the bust (waist no narrower than the
  bust less 4 cm, a moved seam no narrower than the bust), the shoulder squared 1.5 cm and carried on 1.5 cm in
  the cut (Cat: "not shoulder pads, not a stiff shoulder, just the cut"), bust darts always kept. Its Self band
  belt sits on the waist seam. A dropped-seam Mini now ends at the MINI mark (it ran 3 to 5 cm long).
- Lingerie and swimwear stay hidden (`?lingerie=preview`) until after the fit test. Tracé Engine,
  Atelier Nights, Deadstock and Cut For You stay sign-ups only.

## Measuring

- Ask only the essential measurements up front; ask the complex ones when a garment needs them.
- Order (Release 13, Oct 21): waist first, height last. Weight is optional and never leaves the device.
- Checks warn, never block, and fix nothing silently about the body. The "Enter your X to carry on"
  line stays (its removal was reversed).
- No placeholder text in boxes, no time estimates, the name field is just "Name".
- Measuring someone else has a helper mode. Cat rejected "measure twice".

## Drawings and the form

1. The dress form/body shape is the same everywhere (menswear: one form each).
2. Example and film bodies are slim and tall (176 cm, 82/62/90); garments never look bulky.
3. Sleeveless cloth sits inside the arms; shaped, not boxy; skirts fall softly.
4. Prints and checks read clearly, never flat grey.
5. **Pattern-true** (Oct 27): every view shows only what the drafted pattern does; the waist cinches
   only as much as the pattern does.
6. Any drawing change is checked on all garments and views with a before/after sheet before "ship",
   and the How it works film is re-recorded after it ships (stills first).
7. Form finish (Oct 30, PR #231): matte charcoal form and crisp plain cloth on the Style drawings.
   Measuring and welcome keep the line form; satin/finish only from Style on.
8. **All round is quiet** (Oct 31, Q2): no seam dots or hem chart; the checks are one line ("Seams and
   hem checked") and the disclaimer is small text. With no fabric picked the garment turns in pale calico
   (the How it works film keeps its lines).
9. **All round falls back to the Front drawing** (Nov 2, eye check): a design that fails the drape score shows its
   garment's Front drawing with "The turning view of this design is still in testing, so this is its drawing", never
   the old shape preview (which lost drawn details and broke on circle skirts, halters and flutter sleeves). A
   side slit is drawn open on the wearer's left, as the pattern cuts it. A sleeve the pattern has but the drawing
   dropped fails the score ("missing"). Developers: `?sewn=all` shows the cloth even when the score fails, `?sewn=outer`
   sews jackets and coats. The eye-check designs live in `e2e/eye-designs.ts` (run with `EYE_CHECK=<dir>`).
10. **All round quality checks** (Nov 3): the Front drawing also stands in when a design's sewing crashes or takes
   over 30 seconds (never "Sewing your pattern…" for ever). Every option of every sewn garment is sewn on its own
   (`optionDesigns` in `src/drapeSweep.ts`, about 290) and held to `src/drapeOptions.json`: on every pull request
   the check fails if an option that passed now fails, or if an option isn't in the file yet. A new option is
   looked at first (the eye check, `DRAPE_EYE` + `EYE_FROM`), then added with `DRAPE_OPTIONS=write`. Nightly, the
   sweep workflow runs 300 random designs and the options and prints a summary; the department reads it at 3:37am
   and logs it in project files `all-round-quality/sweep-history.md`. The weekly Fable eye check (Wednesdays)
   grades 12 random designs plus new options by eye; a false pass (an ugly drawing the score let through) is the
   worst finding and is fixed first.
11. **Under the arm** (Nov 3): on a sleeved top the stretch check skips the cloth within 5 cm of the armhole, which the
   sleeve hides and pulls as the arm hangs (long sleeves on tops read right by eye but failed). A ruffle or tie at the
   wrist that the drawing leaves out fails the score ("missing") until it is drawn.
12. **The sleeve cap is measured round the arm** (Nov 3, Fable): the cap edge's length, which sets how much cloth is
   eased in and where each point is sewn into the armhole, is measured by angle round the arm and height, never across
   the flat piece (that counted the step between the cap's two underarm ends as the sleeve's whole width, read the
   cap as two or three times the armhole, drew a third of the sleeve top in as ease and sewed half the cap into the
   top of the back armhole: the dress's underarm rode 8 to 10 cm up, squaring the shoulders and folding a ledge
   across the chest). The armhole is a stayed seam: under a sleeve it is held at its cut depth (below the top 4 cm,
   which the shoulder seam holds), so a short top's armhole doesn't sag under a long sleeve. Two seam points sewn to
   one spot (the cap's underarm ends) are not a sawtooth.
13. **Sleeveless shoulders sit on the form** (Nov 3, Fable): the pass that draws a sleeveless side in to the ribs
   goes by each point's height on the form below the shoulder's tip, never by its place on the flat piece (the top
   of the front armhole, cut just below the tip but hanging level with it past the form's narrow shoulder, was drawn
   in to the body's narrow top and folded up over the shoulder as a wing, on every sleeveless dress and top). A
   sleeveless top cut with full shoulders has its shoulder seam held a little behind the side, as a sleeveless
   dress's is (left to settle, the seam slid 6 to 7 cm behind and the armhole's top ran forward level over the arm as
   a square shelf; held nearer the side, a crew neck dropped at the front). A shoulder counts as full from 7 cm (a
   square neck's 8.8 cm shoulder, left to settle as a strap, stood its corners up as wings). A sleeveless garment's
   cloth never rests on the arm (Nov 4): the arm the drape hangs beside the form isn't drawn, and cloth resting on
   its top rode up over it as a shelf standing in the air past the shoulder (the boat neck's straps sit at the tip,
   so all of its armhole top did); the cloth now falls past the arm, and the old pass that lowered it onto the
   arm's top is gone. An unshaped top (cut as wide at the waist as the bust, the oversized top) hangs as a curtain
   from the bust down, and its smoothing pass now stops at the bust (Nov 4): run to the top, it drew the rows under
   the shoulder seam across the shoulder's bend into the form, and the last clamp slid them 3 cm out along the
   shoulder, read as stretched.
14. **A wrap front is sewn as its own half** (Nov 3, Fable): each wrap front is cut whole, its own half and most of the
   other's. Sewn whole, both halves and their mirrors lay four deep over the chest and the form showed through the
   fighting layers (the wrap top and wrap dress failed the score and showed their Front drawing). The drape now sews
   the own half cut 2.5 cm past the centre, lapping over the other front as a buttoned front's extension does; its
   mirror is the under front, so the V and the lap read right. The over front's diagonal edge across the far half is
   not drawn yet.
15. **A tailored collar is eased from its seam** (Nov 4, Fable): a jacket's or coat's collar is placed point by point
   from the nearest stretch of its neck seam (its stand rising round the neck, its end lying flat on with the lapel).
   Where the nearest stretch changed from the neck's to the gorge's, one point stood up the neck and its neighbour lay
   flat on the lapel, 4 to 5 cm apart for 1.2 cm of cloth: nearly every plain jacket and coat option (74 of 290)
   failed the score as "stretched" at the collar's end and showed its Front drawing. The laid collar is now eased back
   to its cut lengths with its neck seam held, so the end rolls from the stand into the lapel.
16. **Godets are the skirt's own fullness in All round** (Nov 4, Fable): a godet is a sector set into a slash, and its
   two edges are sewn to one line of the panel, which the drape's mesh does not cut; sewn as its own triangle it hung
   loose below the hem. The drape now leaves the godet pieces out and draws the panel's cloth beyond each slash out
   sideways by the godet's hem width (nothing at the point, all of it at the hem), kept as far from the point as it was
   cut, so the hem gains what the godets add, stays level, and the skirt flares from the godets' height down. The
   pattern and the flat drawing still show the real godets. A side-seam godet gives half its width to each panel.
17. **A flute is not a sawtooth** (Nov 4, Fable): the jagged-edge check counts a point only where its lean off the line
   through its neighbours turns against the point before or after it. A flute on a full hem (a half-circle's, a
   gathered skirt's) leans the same way for several points and is meant; a sawtooth turns back at every point. The
   half-circle and gathered skirts showed their Front drawing for their flutes before.
18. **A full circle skirt hangs in flutes** (Nov 4, Fable): a half circle starts in the drape as the cone its pieces
   make, and settles well. A full circle's hem is more than any cone can hold, so it started as a tutu's flat disc the
   sim then tore pulling in. It now starts as the half-circle cone with the rest of each level's round laid in eight
   even flutes that grow from nothing at the waist, and the flare pass that draws each level out to its cut width
   reads a circle piece's levels as arcs round its waist centre (its rows run along the fall beside the side seam,
   which that pass had flung out as a wing). The circle skirt and the circle-skirt dress pass the score and read as
   circle skirts; the half circle is unchanged.
19. **A gathered band hangs from the edge it is gathered to** (Nov 4, Fable): a tier's or a ruffle's top is not a
   waist. The pass that draws a skirt's top edge in to the body (its waistband) was drawing every tier's top in too, so
   the band hung 4 to 8 cm inside the hem above it with the seam torn. Tier and ruffle tops are left alone; after the
   skirt's own passes each band is carried whole back onto its seam (top band first), the edge it gathers onto first
   smoothed along its own length (the gathers had drawn it into a 1 cm zigzag, where the gathering thread sews a
   straight line). A balloon hem's swell ends at its hem, which is gathered onto the underskirt's hem and is set back
   on it; the outer skirt's fullness is not drawn out as width. The quality hem check measures only the lowest hem.
20. **An inverted pleat is drawn closed, with its V** (Nov 4, Fable): the drape leaves off the extension behind an
   inverted pleat (it lies hidden behind the face; sewn open it hung as a wide sheet with a gaping V down the centre
   front and back). The face is draped as cut, and the pleat drawn on it: its two folds meet at the centre, stitched
   to the hip (the back's from where its pleat starts, below the zip), and part below into a narrow V to the hem with
   the cloth inside set in and darkened, deepest at the centre and out to nothing at the fold edge (a flat step drew
   the edge as a sawtooth). Knife and box pleats are unchanged.
21. **A hem cut unlevel stays unlevel** (Nov 4, Fable): the pass that lets a flared skirt's hem down where it rode up
   at the sides skips a high-low, diagonal or shaped hem (`shapedHem` in the drape options). It was letting a
   diagonal's short side down to the long side's level and stretching the cloth above it to nearly three times its cut.
22. **The cloth beside a drawn-back neckline is eased** (Nov 4, Fable): a jacket's or coat's front neckline is drawn
   back along itself from the shoulder after the sim, by 6 to 8 cm; the cloth within 5 cm came with it on a steep
   share, so the neck's last point and the gorge point beside it were drawn nearly three times their cut apart (the
   shawl-collar jacket and the fitted-sleeve jacket failed on it). The front is now eased back to its cut lengths
   with the neckline and shoulder held. The coat's shawl collar still tears at the collar's end (its own placement).
23. **Every option's printed pattern is walked** (Nov 4, Quality: Automated checks): every option of every garment on its
   own (All round's list plus trousers, the T-shirt and the lined, faced and couture finishes, about 340) is drafted to
   the example body, built into the printed pattern and walked: seams that sew together match (`checkPattern`, as the
   print screen shows it), balance notches on side seams, inside legs and sleeve seams meet (a single on the front
   against a double on the back is right; a vent's top notch is not a balance mark), every notch sits on the edge
   within 5 mm, and no stitching or cutting line crosses itself. `src/patternSweep.ts`, held to
   `src/patternOptions.json` (the faults each option still has): every pull request fails on a new fault or an option
   not in the file. A fault in the file is a real one waiting on a fix, never one hidden; `PATTERN_OPTIONS=write`
   rewrites the file once it is fixed. Nightly (`quality-nightly.yml`) the same walk runs on 20 random bodies and
   only reports.
24. **Cloth clear of the body hangs plumb on the form** (Nov 4, Fable, blush shift): the cloth settles in true cm on
   the wearer's body and is drawn back on the form by the form's scale at each level (bust, waist, hip). That is right
   where the cloth lies on the body, but a dress hanging straight from the bust was drawn bowing out over the belly
   wherever the wearer's waist is smaller than the form's. Each point now carries down the scale of where its column
   of cloth last touched the body (smoothed across the panels and seams, never inside the form), so a straight fall
   draws straight; fitted cloth is unchanged. A shift's or sheath's hem is also levelled, and the one-point notches
   at the centre fold and the side seam foot are taken out.
25. **Every garment is drawn on as cloth** (Nov 4, Cat: "treat all garments the same"): Draw your lines puts the
   garment on the form as on the Style page, a calico toile until a fabric is picked, on every garment (the skirt and
   bodice showed the bare form with thin lines before, so pleats, pockets and a slanted hem seemed to do nothing). The
   flat's own lines (darts, pleats, pockets, slits) press into the cloth as each line lands, front and back. A
   diagonal hem slants the way it is drawn (`asymFlip` when drawn lower on the right of the form). A collar drawn on a
   drawn neckline puts the neckline back to the round one it sits on (it was silently dropped before). Code:
   `cloth` and `flatLines` on `DrawOnForm`.
26. **Every garment is fitted on 300 random bodies** (Nov 4, Quality: Automated checks): a random design of every
   garment (skirt, top, dress, jacket, coat, trousers, T-shirt), made valid as the style screen keeps it, drafted for
   each of 300 random bodies and held to the body: the printed finished size is the body plus its ease; the bust and
   hip have at least the fit's ease (a bias slip 3 cm less at the hip, on purpose); woven cloth is never cut smaller
   than the body at the bust, hip, armhole or upper arm (a boned top's bust is, on purpose; a dropped shoulder's or a
   raglan's armhole is on the arm); a straight-cut skirt's or trousers' pieces measure the hip printed on them; the
   hem lands at the length asked for (not a high-low or diagonal hem); a fitted or regular set-in armhole's underarm is
   no more than 2.5 cm below the bust point. `src/fitSweep.ts`, held to `src/fitKnown.json` (the kinds of fault
   already found): every pull request runs 300 bodies (its own CI job; 30 inside `npm test`) and fails on a new
   kind. Nightly it runs 300 new bodies and only reports.
27. **The printed pages are checked like a sewist checks them** (Nov 4, Quality: Automated checks): seven sample
   patterns (A-line skirt, maxi circle skirt, shirt-collared top, midi dress, trousers, T-shirt, knee coat) on A4, US
   Letter and A0. Every piece's lines lie on a printed page (from the sheet, inside `npm test`). In its own CI job the
   PDF is rendered to pixels with pdftoppm: every page is the paper's size, page A1 is printed, the 10 cm test square
   measures 10 cm both ways within half a millimetre, and where two pages overlap both show the same lines and words
   (the joining diamonds and the page footer are left out). `src/printCheck.ts`, held to `src/printKnown.json`.
28. **Every option's DXF reads back as drafted** (Nov 4, Quality: Automated checks): every option's printed pattern
   is written as the DXF a factory downloads and read back in as Check a file reads one. The same pieces, names,
   quantities and cutting notes come back; cutting and stitching lines within a tenth of a millimetre (so the seam
   allowances too); grain, fold and internal lines; every notch where it cuts into the cutting line and every drill hole
   within half a millimetre. Inside `npm test`; nightly on random bodies too. `src/dxfRoundTrip.ts`, held to
   `src/dxfKnown.json`.
29. **Every option's Front drawing is scored** (Nov 4, Quality: Automated checks): every option is opened in the real
   app and the Front drawing (which also stands in when All round fails) is read out of the page and measured: no
   broken points or missing cloth, no cloth past the top or bottom of the drawing's box, no outline folding through
   itself (a loop of 0.5 cm² or more), no sawtooth edge, no hole of 2 cm² or more where the form shows through (the
   space beside a hanging sleeve and an open front up to the neck are meant), and both sides alike unless the design
   is cut asymmetric. Its own CI job (`e2e/front-drawing.spec.ts` captures, `src/frontCheck.ts` scores), held to
   `src/frontKnown.json`.
30. **Every screen is looked over on a phone and a computer** (Nov 4, Quality: Automated checks): the waitlist,
   welcome, every measuring page, every Style step of every garment with its Flat, All round and Pattern views,
   Review, Print and the account are photographed at phone size (390 px) and computer size (1280 px) and looked over
   for the page scrolling sideways, anything standing past the screen's edge, and words cut off by their box or an
   ellipsis (words in a row that scrolls, and words kept for screen readers only, don't count). Its own CI job
   (`e2e/screen-check.spec.ts`, `e2e/screenAudit.ts`), photos kept with the run, held to `src/screenKnown.json`.
31. **A halter's top edge is not a plunge** (Nov 4, Fable): the stay-tape pass that lays a plunging neckline on the body
   by its cut length runs only when the neck run's deepest point is at the centre front. A halter's top edge is tagged
   neck all the way from the centre round the neck and down its cut-in armhole to the side, as deep as a plunge: walked
   down from the neck point it was drawn round to the centre front, the upper chest stretched twice its cut and the
   side seam's top dragged 4 cm.
32. **A plunge top's straps are held on the shoulder** (Nov 4, Fable): a sleeveless front cut down to a plunge, hung
   from straps, has them held 1.5 cm behind the side (height left free) and goes without the short top's extra pull.
   Left to settle, the straps slid 8 cm behind the shoulder and took the V's edge round to the side of the body; pinned
   down at their cut distance out, they lay level past the shoulder as tabs; the extra pull dragged the V's edge 4 cm
   down the chest. A plunge dress already had the hold under its skirt's weight, and keeps its straps pinned where
   they are cut: settled 1.5 cm back, the bias slip gown's front went 2 cm inside the form (caught by the locked SS27
   looks test, Nov 4).
33. **A cowl front hangs in its own U** (Nov 4, Fable): the cowl's whole bias front is sewn as its right half, cut off at
   the fold line (the grown-on facing dropped), its top edge the fold from the centre front to the neck point. Above the
   bust each row is wider than the body by the spread the cowl was opened with; that spare width is placed hanging from
   the neck point on a parabola down to the centre front as deep as its length reaches (the drafted depth), the fold
   held there, the rest of the row on the body from the neck point out as cut. The hug-the-ribs pass leaves a cowl
   front alone. Sewn whole, both halves and their mirrors lay four deep and hung as a rag.
34. **A piece cut whole is sewn and drawn whole** (Nov 4, Fable): a one-shoulder's front and back carry both halves.
   A whole back is turned over first (right side up its left is the wearer's left, seen from behind), its side seams
   are sewn left to left and right to right (not all four runs strung into one chain), the skirt is sewn to the right
   half of the waist (the half it is drafted to) and the other half's waist is set on the skirt's mirror after the sim;
   All round draws a whole panel once, not mirrored. Sewn as two half-pieces strung together, the one-shoulder was a rag.
35. **A flat collar lies on the shoulders** (Nov 4, Fable): a peter pan collar is placed out along the body's surface
   from the neck seam, each point as far out as it is cut from the neck edge, keyed by its distance along the curved
   neck edge (not across the piece, which read the front half of the edge as the back half again), and left as soft
   cloth: not re-set stiff after the sim. Placed by height above the neck like a band, it stood up round the neck.
36. **A bow and a neck ruffle are spread over half the neck ring** (Nov 4, Fable): a strip's neck edge, however long it
   is cut (a bow's runs on into its tie, a ruffle's is cut twice the neck), is spread from the centre back to the centre
   front by its share of the neck edge; the bow's tie then hangs down the front of the body from the centre front,
   the strip's width across, and the ruffle stands up in waves 6 cm apart, deeper toward its edge. Both keep that shape
   after the sim, carried by the average movement of the few centimetres of seam nearest each point (a gathered seam
   settles in a zigzag, and carried by one seam point the strip tore). Placed round the neck by cut length, the tie
   wrapped round the back and the ruffle went twice round.
37. **A tie cuff's ties hang from the wrist, a sleeve ruffle is laid round the hem** (Nov 4, Fable): the tie cuff's band
   is the middle of its strip (its `roundCm` and `tieCm` in the piece meta), laid round the wrist as the shirt cuff is,
   and each tie turns down out of the band over 4 cm and hangs on past the hand, the two side by side. The sleeve
   ruffle is laid round the sleeve's hem as it hung, flaring and fluted like the trouser hem ruffle. The tie cuff's
   fold is a meant fold, not a fin. Before, the cuff's whole strip length was taken as the wrist round (the hem spread
   to 70 cm) and neither piece was drawn. A buttoned shirt cuff's whole strip, underlap included, is still spread once
   round the wrist: laid to its wrist round alone, the 2.5 cm underlap piled on the strip's start and buckled it.
38. **A raglan sleeve's shoulder pieces lie on the body** (Nov 4, Fable): each raglan half is sewn as half the sleeve
   (overarm to overarm, underarm to underarm, lower cap to its own side's armhole below the raglan line, raglan line
   to the bodice's from the neck end, shoulder to shoulder); the shoulder piece on it, inside the outline it was turned
   on with (`raglanYoke`, `raglanTurn` in the piece meta), is turned back to where it was cut from the bodice and placed
   as the bodice places it, held on the shoulder and treated as body cloth. The sleeve's cloth next to the piece hangs
   from the piece's edge down the arm and only lower lies round the arm; the cap-settle pass leaves the piece alone (it
   was pulling it round the arm, 5 cm off its raglan seam). Before, only one half was drawn.
39. **A jacket closed at the neck keeps the neckline the sim settles** (Nov 4, Fable): the pass that developed a
   jacket's or coat's front neckline back along itself from the shoulder (rule 22's neighbour) is off: on a stand,
   funnel, hood or collarless jacket or coat it ran the neckline down the chest in a drooping V, tore the front and
   left the collar's seam 9 to 23 cm off it. Stand and collarless jackets and coats, and the double-breasted coat, pass.
40. **A funnel collar stands away as it rises** (Nov 4, Fable): a funnel's ring is set 0.3 cm further out for every cm
   above its neck seam, so it flares open round the face instead of sitting as a tube that crossed the centre front
   and stretched. Jacket and coat funnels pass.
41. **A hood hangs as a pouch from the nape** (Nov 4, Fable): a hood is a collar piece sewn by its neck edge, not a body
   shell. Its neck edge is keyed along the seam from the centre back; the rest is hung from the nape's own level,
   swept over the shoulder to the pouch's side first and then let down plumb on the body profile's convex hull, its
   crown rounded in a quarter circle, its face edge drawn (not held on the centre plane) and the pouch bellied 4 cm
   behind the neck. Neighbours hang from the one nape level, never each from its own seam point (that hung them 10 cm
   apart). Jacket and coat hoods pass.
42. **A collar end sewn to a pressed lapel stays on the lapel** (Nov 4, Fable): after the lapel press, the seam
   re-close lets a collar's seam points follow the body (the body never follows the collar), and the collar lay keeps
   its seam points on the lapel rather than pushing them out with the fall below. The coat shawl's collar-to-front
   seam closed from 4.6 cm; notched, peak, shawl and stand collars on jacket and coat unchanged.
43. **A long coat's hem fullness is laid out too** (Nov 4, Fable): the jacket rule that lays back the cloth the sim
   could not show out (a step out and soft flutes, growing from the waist to the hem) now runs for coats of any length;
   a long flared coat was left to the sim, which tucked 100 cm of hem fullness into creases beside the side seams
   (13 fins). Below a piece's cut hem the piece keeps its hem's width, so the last rows that settle past the cut are
   not left 4 cm inside the rows above. All 39 coat options pass.
44. **The centre smoothing stops at a vent** (Nov 4, Fable): the pass that runs a top's centre line smooth leaves the
   rows below a vent's top alone: there the cloth either side of the centre is the vent's overlap and underlap, two
   layers that lap, and smoothing them together drew the underlap to 2.4 times its cut.
45. **A high-low peplum's hem is cut unlevel on purpose** (Nov 4, Fable): a bodice with a high-low peplum is draped as a
   shaped hem, like a dress with one, so the A-line evening does not "let down" its sides as if they rode up (it drew
   the back peplum's side to 5 times its cut). All peplum options pass.
46. **A gathered skirt's side seam is closed by its sewn pairing, its halves meshed alike** (Nov 4, Fable): the side
   seam is closed point to its place on the other piece's edge, by the seam as sewn, not to the nearest point (which
   put two points of a finer front on one point of a coarser back: a sawtooth of 47 teeth down a dress's gathered
   skirt). A gathered skirt's front and back are meshed at the same step: with the fullness shown just over 2 on one
   piece and just under on the other, the finer piece hung 3 to 5 cm shorter and the hem ran unlevel. Skirt and dress
   pass with level hems.
47. **A sleeveless armhole is cut clean** (Nov 5, Fable, blush shift): a sleeve needs a deep, roomy armhole to go
   into; a bare arm does not. Sleeveless, the armhole is the arm's own plus 2.5 cm and a quarter of the bust ease
   (a sleeved one has 4 cm and half), so the underarm sits about 2 cm higher and close under the arm, and the
   shoulder stops 1.2 cm short of the shoulder point so the strap sits on the shoulder. Tops cut below the
   shoulders, draped necklines, the plunge's strap and the oversized cut keep their own (`SLEEVELESS` in
   `src/engine/bodice.ts`). A shift's flare at the hem follows the skirt's own flare setting when one is given.
48. **Seams are closed for the drawing** (Nov 5, Fable, blush shift): the sim leaves each seam point a few mm off
   the edge it is sewn to; before drawing, it is put exactly on that edge (`closeSeams` in
   `src/engine/drape/hang.ts`), so no hairline of the form shows between two panels where a side seam is seen
   edge-on.
49. **A dropped shoulder's armhole goes round the arm with room** (Nov 6, Fit Quality): the shoulder runs 5 cm
   past the shoulder point and the underarm drops 3 cm, lower still where the armhole would otherwise be less than
   the arm's own armhole plus 4 cm (the room a set-in sleeve's armhole has). Redrawn, the armhole lost more on a big
   body than a small one: on the oversized jacket and coat it came out up to 1.4 cm smaller than the arm on busts
   of 125 to 145 cm (`DROP` in `src/engine/sleeveCut.ts`, `cutSleeves` in `src/engine/bodice.ts`).
50. **All round shows the cloth clean, in its own finish, and closer on request** (Nov 5, Cat's A + C): the swatch
   pictures carry light painted into them (satin's fold bands, velvet's shading, linen's cloudy grid), which wrapped
   round a garment read as stripes, a plaid or blotches. All round lifts those broad bands out (half the fine weave
   kept, none on a smooth cloth) and lights each cloth in its own finish: velvet, corduroy, wool and terry glow softly
   where they turn away, satin and silk take one broad sheen, leather a thin coat (`cleanCloth` in allRoundCloth.ts,
   `FINISH` in allRoundMesh.ts). Prints and drawn checks are untouched. At the whole-garment size the weave is a pixel
   or two, so "Look closer" (and a pinch, a double tap, or a trackpad pinch) zooms about 2x so the weave reads.
   Raised weave (normal maps) and a lower side light were tried and rejected: no gain, and shimmer bands on wool.
51. **A sleeveless peplum top is held between a top's hold and a dress's** (Nov 6, Fable, SS27 Look 09): a sleeveless
   top cut with full shoulders and a peplum has its shoulder held 1.5 cm behind the side, not the 3 cm back that
   suits a dress nor the half centimetre forward a plain sleeveless top takes. Held 3 cm back under the peplum's light
   weight, its shoulders sank inside the form's and the form showed through both shoulder tops; held forward, a big
   peplum's weight drew the back 2.3 cm inside the form and stretched a big flared one's back three times its cut.
   A dress's skirt is heavy and keeps the 3 cm (`heavySkirt` in `src/engine/drape/garment.ts`).
52. **A cropped top's seam is held under the bust, and a gathered peplum's folds meet the side seam whole** (Nov 6,
   Fable, SS27 Look 09 round 4): a top cut off under the bust (the Cropped length, In testing) is cut from the
   waist-length draft by the dress's empire cut (`maxRaise`, `raiseBodice` in `src/engine/waistline.ts`), 6 cm under
   the bust point and above any side dart's lower leg, and its peplum hangs from the cut edge. In All round that edge
   is held at its height, as a bra's band sits: the coarse sim let a big balloon peplum drag it down the ribs and the
   bust showed through above the seam. A gathered peplum's starting folds are fitted a whole number to each piece's
   waist (about 12 cm each), so a fold is never cut in half at the side seam and sewn to the next piece's half fold,
   which folded over on itself as a fin and failed the quality check. A balloon peplum's outer, gathered at both
   ends, starts in gentler folds still (two thirds the depth), since seeded as deep as a plain gathered peplum's the
   cropped top's big balloon crumpled into fins. The hold is `src/engine/drape/cropHold.ts`; a cropped top is cut
   only from a plain front and back (no princess seams, draped neckline or boning), as a dress's empire cut is.
53. **A plunge to the waist is taped most of the way** (Nov 6, Fable, SS27 Look 09 round 4): left to settle, the
   narrow V's edges fell open 4 cm each side over the bust and the V read wide (the round 3 sheet hid it, the blouse
   being tucked into a skirt that held it closed; Cat: "R2 has changed"). Its stay tape now brings each edge 90% of
   the way back to its cut distance from the centre front (50% on a sleeveless one, whose narrow strap stretched
   twice its cut), the cloth within 12 cm coming with it; all the way tore the cloth beside it 2.1 times its cut.
54. **Your own fabric, photographed, stays on the device** (Nov 7, Design: Fabric, In testing): Your photo on the Fabric
   step takes a photo (or picks one) of the maker's own cloth and dresses Front, Flat, the palette card and All round
   in it. The photo is made into a tile on the phone (the middle square, its window light lifted out, its edges
   blended so it repeats with no line) and kept in this browser's photo store; saved work holds only its id, so on
   another device the drawing falls back to the fabric type picked. It is never sent. Small, Medium and Large show one
   tile 10, 20 or 40 cm wide (a photo from about 30 cm away is Medium); a big-repeat print reads best on Large. The
   fabric type stays, as what the cloth is made of, for the advice and the cutting; a colour or shop fabric comes off.
   Code: `src/fabricPhoto.ts`, `src/engine/fabricTile.ts`, `PhotoSwatch` in `src/ui/FabricFill.tsx`.
55. **The fit map shows the room, from the pattern's own ease** (Nov 7, Design/3D quality, Cat's D): All round's Fit map
   button colours the sewn garment by the room it leaves the body, CLO's heat scale (red tight, yellow snug, green easy,
   blue loose), with the pattern's ease in cm at the bust, waist and hip on the front, and a key under the view; Fabric
   puts the cloth back. It is read from the cloth's girth round each level as sewn (the drape holds each edge to its cut
   length only roughly, so stretch would show pulls that aren't there), and pinned to the pattern's finished bust, waist
   and hip so it never disagrees with the measurement table (the drape alone read a fitted dress's waist 6 cm roomy).
   Pull lines from real cloth stretch come later, with Design: Fabric behaviour. Code: `src/engine/drape/fitMap.ts`,
   `fitPins` in `run.ts`, the colours in `allRoundMesh.ts`.
56. **The cloth behaves as the fabric picked** (Nov 7, Design: Fabric behaviour, Cat's A + B + C; the Feel is In
   testing): every fabric has a card (`clothCard` in `src/engine/drape/clothCard.ts`) from its own weight and drape,
   then a special cloth's, a knit's, then the fibre's usual ones. Heavier cloth lies thicker and hangs harder; a fluid
   cloth (silk and viscose by default) pours in its skirt and falls 1.5 times harder; a crisp one and denim stand out.
   The cloth's own stiffness and fall show in a skirt or a dress's skirt, where it hangs free (`skirtBend`, `fall`);
   the bodice keeps the fibre's stiffness, as before, since made stiffer or pulled harder all through, tops folded
   into fins or stretched. A yoke and a full circle keep the light pull. A skirt's woven cloth gives on the bias and
   holds on its grain (`bias`, B). A knit gives along its length (`stretch`). A plain cotton is drawn exactly as
   before. **Feel** under All round (skirts and dresses) nudges the cloth two steps each way stiffer or softer,
   heavier or lighter, from the fabric's own card, says what it is set to, and goes back to the fabric's own when
   another is picked. It changes the drawing, not the pattern. Round 2 (Nov 7): a top's bodice and sleeves take the
   square root of the cloth's stiffness against its fibre's (a fitted top lies on the body, so it shows most in the
   sleeves); a bias-cut slip in a fluid cloth gives three times as much on its length and hangs twice as hard, so it
   clings; a circle's pieces give half as much on the bias; a crisp peplum stands out at ten times a plain cotton's
   stiffness (it was 40, and 7 of 8 failed their check; now 7 of 8 pass). Round 3 (Nov 7): trousers and the T-shirt
   take the same square root as a top; a jacket or coat moves only 0.9 to 1.6 times its fibre's stiffness and lies at
   most 0.6 cm off the body (a silk peak lapel and a heavy wool shawl collar stretched past those). All 135 trouser,
   T-shirt, jacket and coat options pass in silk, satin, heavy wool, denim, leather and cotton.

## Style steps

- **No repeated names** (Oct 30): a question never carries its step's name (no "Details" question on the
  Details step); pleats, godets, flounces, tiers and ruching are called **Fullness** everywhere, as on the Draw tool.
  On the skirt's Details step, Waist comes first.
- **Phone Style panel** (Oct 31, P1): no step bars; "Step 1 of 5" opens the list of steps. One short line
  under a pick (the short lines live in `src/explain.ts`, 40 characters at most; the computer keeps the full line).
  The bar holds one button; Review all choices and Watch demo are links at the end of the step.
- **One journey** (Oct 31, J1-J8): every garment's steps run Shape, Neck & sleeves, Length & hem, Details, Fabric
  (skipping any it has nothing for), each named the same everywhere and in full on Next. The views read Front ·
  Flat · All round on every garment. A fabric property (the knit's stretch) is asked on Fabric. The T-shirt's Fabric step offers
  knit swatches only (Nov 1, `src/engine/knitFabrics.ts`), never wovens. On a phone Show all
  tools is on the Review page.
- **Palette card** (Nov 2, D1): once a fabric is picked, it stands beside the form on Front as one tall palette
  card (cloth over a cream name strip); a shop fabric adds its shop and listed price. Phone: the picks sit under
  it, as many of three as fit. Not on Flat or the pattern. Code: `src/ui/PaletteCard.tsx`.
- **Back a step** (Oct 31, A): a plain ← box left of Next/Review on every step after the first, never a named
  link. On a phone Undo/Redo are named words across from "Step 2 of 4", away from the back arrow; Clear sits
  under Done while drawing.

- **Photos are measured for proportion** (Nov 7, Cat: "This needs to be how users photos are handled instantly",
  "Measured for proportion and design detail, aiming for max refinement"; In testing): a photo reading measures
  the garment against the wearer's own body, not only its nearest named options. Skirts already had hem and
  fullness. Jackets and coats now take the hem below the waist, the lapel break, the button count and spacing, the
  shoulder line out or in, the room at the bust and the hem's flare; trousers the leg's round at the knee and hem;
  woven tops the room at the bust. Each is applied only when the wearer's measurements are known, kept to what
  drafts soundly, and listed in words on the photo page. Code: `measures` in `src/photo/types.ts` and the prompt in
  `src/photo/analyze.ts`; `measuredOuter` and `measuredLeg` in `src/photo/garments.ts`; the jacket's own numbers
  (`dropCm`, `easeCm`, `breakCm`, `buttons`, `buttonGapCm`, `shoulderCm`) in `src/engine/outerwear.ts`, which win
  over the named choice (the Look 09 high lapel uses the same `breakCm`/`buttons`).
- **Cuts are ratios to her body** (Nov 7, Cat: "the insp vest is oversized", "How can we always account for oversized
  and other design types?"; In testing): an Oversized jacket or coat takes 0.45 (jacket) or 0.5 (coat) of her bust as
  ease (`outerEase`, never less than the old 30/34 cm), up to 70 cm from a photo. With sleeves it has the dropped
  shoulder; without sleeves (a waistcoat) it keeps a set-in shoulder moved out at least as far as the room at the side,
  so it hangs straight (a dropped shoulder with no sleeve buckles on the form). A photo showing 1.28 times her bust or more is read as Oversized. Fitted, Regular and Relaxed, and
  every skirt, top and dress, keep their fixed ease through the tester round. Before a photo's jacket or coat is shown
  to Cat, the ratio check (`src/photo/ratios.ts`) compares the pattern's room, hem, shoulder and buttons with the photo's.

## Fixing problems

- **Auto-fix rule** (Oct 18): never point out problems the user's own edits cause (uneven seams,
  hems). True them silently where pieces join; never change the drawn design shape.
- Show finished measurements and ease up front (Review table + paper marks, live).

## Money-shaped product rules

- Guests can draft and preview freely. Billing is built but off (`VITE_BILLING`).
- No surcharge for complex patterns; flat, no nickel-and-diming.
- Fabric yardage is free (moved out of Premium); A0 and projector files are free.
- Photo readings are capped (per visitor, per site and per tester pool) and the Claude Console has a
  monthly spend limit. Never raise caps without checking the bill safeguards doc.
