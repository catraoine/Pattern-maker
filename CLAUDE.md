# Coding rules for Maison Tracé

Every Claude thread (and any developer) reads this before touching code. Each rule comes from something that went
wrong here or that Cat decided. Agreed with Cat on Nov 5, 2026; change it only when she does, and log the change in
docs/handbook/decisions-log.md.

## Before you start

1. Read your department's page in `docs/handbook/` first (`departments.md` says which one is yours).
2. Branch from the latest `main`. Never build on another PR's branch unless Cat asks; check every PR's base before
   a release.

## Writing code

3. Match the file's own style: single quotes, long lines. Never run a formatter (Prettier or any other) over existing
   files: the repo has no formatter config, and one pass rewrote 4,600 lines for a 260-line change (Nov 4).
4. Keep new garment logic in its own file. Don't grow `src/engine/drape/garment.ts`; add beside it.
5. Comments explain why, in plain words, like the rest of the code.
6. A new design option starts as In testing (`src/launch.ts`) until it is fit-tested.
7. Saved work must still open after your change: give every new setting a default in `INITIAL` /
   `DEFAULT_*` (saved work is filled in from them by `fillMissing` in `src/store.ts`).
8. Server functions (`netlify/functions/`): every limit fails closed (if the counter can't be reached, say no), and
   keys go in headers, never in web addresses.
9. Switching off a code checker warning (`eslint-disable`) needs a reason on the same line.

## The repo is public

10. No secrets, tester codes, names, emails, addresses or money figures in code, tests, comments, docs or PR text.
    Example codes never match live ones.

## Before calling a PR ready

11. Run `npx tsc -b`, `npm run lint`, `npm run dead-code`, and the tests for what you changed (`npx vitest run <files>`;
    the full `npm test` takes about 5 minutes).
12. Run Claude's code review on your own changes (`/code-review`) and fix what it finds.
13. Never skip, switch off or loosen a test, and never add an entry to a known-faults list (`src/*Known.json`) just to
    turn a check green. If a check is wrong, say so to Cat.
14. The PR text says what changed in plain words and gives the deploy preview link
    (`https://deploy-preview-<number>--whimsical-mooncake-2cf9a9.netlify.app`). Talk to Cat about what changed in the
    app, never by PR number.

## Releasing

15. Don't merge. PRs wait for Cat's "ship", then every green PR goes out together as one release
    (`docs/handbook/release-state.md`).

## Weekly review

Every Monday a scheduled Claude session reviews everything merged to `main` in the past week as a whole, and opens
one PR with any fixes, which waits for "ship" like any other.
