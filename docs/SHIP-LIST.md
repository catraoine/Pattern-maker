# What ships before 21 December 2026

Cat's decision, 20 October 2026: the app is frozen to this list until the stage 1 fit gate (20 sewists
averaging 4 of 5 on a skirt or bodice toile, decision on 21 December 2026). Everything else is built
already or waits, and is labelled **In testing** in the app (see `src/launch.ts`).

Why: every new feature adds support load, fit-test surface and things to explain, and none adds
sign-ups. One garment shown fitting ten real bodies beats twelve that cannot be.

## Ships

| What | Where | State |
| --- | --- | --- |
| Fit fixes from the early round (26 Oct) and the Fable review | engine files per garment | as found |
| Tester tools: tester codes, send to device, keep data | `src/ui/TesterCode.tsx`, `src/moveLink.ts`, `src/store.ts` | live |
| Waitlist and tester sign-ups | `src/screens/SignupScreen.tsx`, `netlify/functions/signup.mts` | live |
| Real sign-in (Supabase) before the public launch | not started | stage 2 |
| "How did it fit?" after every print, with an optional toile photo | `src/ui/FitForm.tsx`, `src/screens/ExportScreen.tsx` | this PR |
| The four weekly numbers: sign-ups by source, printed, fit reported, paid | `src/report/report.ts`, `src/server/reports.ts` | this PR |
| In testing labels on every non-launch garment | `src/launch.ts` | this PR |

## Launch garments

Skirt, bodice, dress. They are the only garments on the landing page and in any video until the gate passes.

## In testing (usable, labelled, not promoted)

Trousers, T-shirt, jacket, coat, menswear forms, lingerie drafts (`?lingerie=preview`), draping on the form,
pro exports (DXF, measurement files, tech pack), numbered drops, the Archive, Cut For You, Deadstock,
Tracé Engine and Atelier Nights sign-ups, prints beyond checks, 3D body export.

A garment moves to the launch list when sewists score it 4 of 5 or better in a fit round. Nothing else
moves until the gate decision.

## Not until the gate passes

New garments, new revenue streams, promo film re-records, expansion languages, app store builds.
Bugs in anything already live are fixed as found; new features wait.
