# Affiliates and partners

Affiliate money stays small next to subscriptions; the value is the pitch and the sign-ups. Every
affiliate link in the app carries a "We earn a commission" line. No outside contact, supplier or
payment account without Cat's say. IDs and tags below are already public in the app's links.

| Partner | Route | State (Oct 30) |
| --- | --- | --- |
| Mood Fabrics | Awin, 5%, US + CA buyers, no PPC | Whole dressmaking catalogue in the app (Nov 7). Buy links wrapped via Awin; waiting on Mood's approval (chased inside Awin Nov 7; their old affiliates@ address bounces) |
| NY Designer Fabrics | Awin (programme 89379), about 10% | Whole catalogue in the app (Nov 7), plain links until approved; Cat applies in Awin |
| Fashion Fabrics Club | CJ, about 10 to 12%, US | Whole catalogue in the app (Nov 7), plain links until approved; Cat applies in CJ. Its site lists quarter-yard prices, so the app says "price at the shop" |
| Amazon.ca / Amazon.com | Associates, tags `maisontrace-20` / `maisontrace0c-20` | Live in the projector kit list ("What you'll need"). 180-day / 3-sale clock from Oct 29 |
| Spoonflower | CJ, 1% | CJ account active, application pending. Swap the plain link in `src/engine/exactColour.ts` for the CJ link once approved; adding more waits for Jan 18 |
| Etsy | Awin | Dropped: Etsy closed its Awin programme (Nov 4); the Awin support case closed Nov 5 |
| Minerva | Awin (programme 5270), UK | On hold until we sell to the UK (Cat, Nov 7) |
| Pattern printers | Direct referral/discount code ask | Emails sent Oct 30 to PDF Plotting (US) and The Workroom (Toronto). "Get it printed" link after Jan 18 |
| Hand-dye studios | Dyed to order (In testing) | A Vancouver studio is keen; meeting proposed for December. Sewists supply natural fabric |
| Pattern cutter | Paid drafting review | Booked; review due first week of November |
| Dressmakers | Vancouver pilot | Planned from Apr 2027, not started |

Rules:

- Tester vouchers cannot earn affiliate commission (self-purchase is banned).
- Whole catalogues (Nov 7): `scripts/shop-catalogue.py` reads each partner shop's public product list (all three run on Shopify), keeps the
  dressmaking fabrics in stock and writes `public/shops/<type>.json`; the app loads a type only when it is tapped
  (`src/engine/shopCatalogue.ts`). Re-run it to refresh prices and stock. When a shop approves us, add its line to
  `AFFILIATE` in `src/engine/shopFabrics.ts` so its Buy links earn. Buy puts the exact yards in the shop's cart for Mood and
  NY Designer Fabrics (Shopify add-to-cart links, Nov 10); Fashion Fabrics Club sells by the quarter yard, so its Buy
  opens the fabric's page. The Affiliates thread refreshes the catalogue every Monday and hands the files to Releases.
- Check any outward email address in a real source before sending (a guessed Mood address bounced, Nov 7).
- Mood bans coupon and cashback sites. Skip sewing-class sites and coupon sites generally.
- Cart Ready (shop fabric in the app) uses each shop's own checkout; no money, tax or refunds pass
  through Maison Tracé.
- Payouts (Amazon Associates, Awin, CJ) go to the Maison Tracé chequing account, confirmed by Cat Oct 30.
- CJ: one publisher account only. Its company ID is the one in CJ's own account emails to hello@
  (Oct 26). An older note with a different number was wrong.
