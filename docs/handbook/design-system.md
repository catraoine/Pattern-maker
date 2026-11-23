# Design system: one style per role

Cat applied this on Nov 22, 2026, from the first clarity checks (playbook: one style per role). Every control with
the same job is drawn the same way on every screen, at every size. It sits inside the brand rules in
[brand-and-voice.md](brand-and-voice.md): Chakra Petch for buttons and small labels, Archivo for headings, Instrument
Sans for reading; square corners; one fill per screen.

Before adding a button, link, tag or heading, find its role here and use that style. If nothing fits, ask Cat before
inventing a new one. The shared rules live in `src/styles/47-clarity.css`.

| Role | The one style | In code |
| --- | --- | --- |
| Main button | Champagne fill, 16 px Chakra Petch 500, spaced 0.1em, 56 px tall (52 px on phones under 480 px tall). One per screen, in view. | `button.primary` |
| Second button | 1 px champagne outline, 13.5 px capitals, 44 px tall. | `button.secondary` |
| Action link | 13.5 px champagne capitals; › only when it leaves the screen. | `.later`, `.link` |
| Link in a sentence | The sentence's own type, underlined. | `a`, `.link.quiet` |
| Back | Inside Style's steps a named "‹ Shape"; elsewhere the header ←. | `.step-back-arrow.named`, `.steady-back` |
| Close | Square, in the window's top corner. The enlarged view's shrink mark is square too. | `.enlarge` |
| Play mark | Words then ▶ ("Demo ▶"), 13.5 px, one size everywhere. | `.demo-play` |
| Picked choice | 2 px champagne outline, never a fill. Views (Front, Flat, All round, Pattern) too. | `.on` |
| Tag | 11 px, 1 px outline, never filled ("In testing"). Fit words are plain muted text. | `.testing-tag`, `.fitword` |
| Small label | 13.5 px spaced capitals, muted. | `.eyebrow` |
| Headings | Page 40, part 28, section 22 (Archivo 600). A garment's description is 17 px sentence case. | `h1`, `.print-part h2`, `.sew-card > h2` |
| Reading text | 16 px; help lines 14 px muted. Nothing under 11 px. | `body`, `.muted` |
| Opens in place | A ruled row with + / −. | `.fold-pick`, `details > summary` |
| Phone margin | 16 px on every screen. | `.main` |
| Help under a pick | The same short line on a phone and a computer. | `.explain-short` |

## How it's checked

The clarity checks' "one style per role" pass ([playbooks/clarity-checks.md] in the project files) lists every
button, link, play mark, back, close, tab, picked state, tag, label, heading, help line, fold and type size with its
computed style at five sizes, and compares them with this table. A role drawn two ways is a finding.
