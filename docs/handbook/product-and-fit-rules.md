# Product and fit rules

## What the app is

One installable web app (PWA) for phone and computer, hosted on Netlify from this repo. People
measure, pick or photograph a style, and print a pattern drafted to their measurements. Data stays
on the device; real sign-in (Supabase, email code) is built and hidden behind `?signin=preview`, to be
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
23. **Every garment is drawn on as cloth** (Nov 4, Cat: "treat all garments the same"): Draw your lines puts the
   garment on the form as on the Style page, a calico toile until a fabric is picked, on every garment (the skirt and
   bodice showed the bare form with thin lines before, so pleats, pockets and a slanted hem seemed to do nothing). The
   flat's own lines (darts, pleats, pockets, slits) press into the cloth as each line lands. A collar drawn on a
   drawn neckline puts the neckline back to the round one it sits on (it was silently dropped before). Code:
   `cloth` and `flatLines` on `DrawOnForm`.

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
