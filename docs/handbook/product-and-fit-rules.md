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

## Style steps

- **No repeated names** (Oct 30): a question never carries its step's name (no "Details" question on the
  Details step); pleats, godets, flounces, tiers and ruching are called **Fullness** everywhere, as on the Draw tool.
  On the skirt's Details step, Waist comes first.
- **Phone Style panel** (Oct 31, P1): no step bars; "Step 1 of 5" opens the list of steps. One short line
  under a pick (the short lines live in `src/explain.ts`, 40 characters at most; the computer keeps the full line).
  The bar holds one button; Review all choices and Watch demo are links at the end of the step.

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
