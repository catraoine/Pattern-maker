# Design: Garment range

New garment types, started Nov 7, 2026 when Cat broke the feature freeze for them ("I want to do all, break
freeze"; "Move forward": everything at once, no second wave).

## What it owns

- **Jumpsuit**: the top and the trousers joined at a waist seam, the body cut a little longer so you can sit.
- **Knit dress**: the T-shirt carried on past the hip.
- **Hoodie**: the T-shirt in a sweatshirt knit with the jacket's two-piece hood.

Other gaps from the Nov 6 flexibility rating belong elsewhere: trousers and tee in All round and the 80% mixed-design
rate (All round quality), pockets, jacket and trouser options (styling options), your own fabric photo (Fabric).

## Rules

- Option sheets first; mock-ups only until Cat says "apply". The round 1 sheet (Nov 7) is in project files
  `garment-range/` and linked from the business plan.
- All three launch **In testing** (registered in `src/launch.ts`); the tags come off only after testers sew them.
- New garment code goes in its own files beside the old (CLAUDE.md rule 4). While the testers sew (Nov 16 to Dec 6)
  the launch garments' patterns (skirt, top, dress) don't change unless it is a fit fix testers asked for, and the
  golden-copy tests stay green.
- Each new garment gets its pattern sweep, fit sweep, print and DXF checks, and its Front drawing check, like the others.
- Releases go out on Cat's "ship" with everyone else's.

## Where it stands

- Nov 7: round 1 sheet sent (J1 to J5 jumpsuits, K1 to K5 knit dresses, H1 to H5 hoodies), waiting on Cat's pick.
