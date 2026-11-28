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
| Close | Square, in the window's top corner. The enlarged view's shrink mark is square too, an icon with no word. | `.enlarge` |
| Done (a tool open) | One thin outlined word, top right, standing in the shrink icon's spot. Never a fill, never a different place per tool. | `button.done`, `.pe-open-tool.on` |
| Download pair | Download pattern (filled) and Download instructions (outlined) are the same height, 56 px. | `.print-go`, `.print-controls .stack` |
| Play mark | Words then ▶ ("Demo ▶"), 13.5 px, one size everywhere. | `.demo-play` |
| Picked choice | 2 px champagne outline, never a fill. Views (Front, Flat, All round, Pattern) too. | `.on` |
| Tag | 11 px, 1 px outline, never filled ("In testing"). Fit words are plain muted text. | `.testing-tag`, `.fitword` |
| Small label | 13.5 px spaced capitals, muted. | `.eyebrow` |
| Headings | Page 40, part 28, section 22 (Archivo 600). A garment's description is 17 px sentence case. | `h1`, `.print-part h2`, `.sew-card > h2` |
| Reading text | 16 px; help lines 14 px muted. Nothing under 11 px. | `body`, `.muted` |
| Opens in place | A ruled row with + / −. | `.fold-pick`, `details > summary` |
| Phone margin | 16 px on every screen. | `.main` |
| Help under a pick | The same short line on a phone and a computer. | `.explain-short` |

## Where controls sit in the drawing window

Cat applied this on Nov 28, 2026 ("We don't want things bouncing around too much, requiring the user to hunt for
buttons"). Every view of Style's window (Front, Flat, All round, Pattern, the enlarged view, Draw on it, Move points)
keeps each control in the same corner:

| Corner | What sits there |
| --- | --- |
| Top right | Enlarge, or the shrink icon when the window is big. The tool words (Draw on it, Move points) sit just left of it. With a tool open, its Done takes the shrink icon's spot. |
| Top left | Demo ▶, plain words then ▶, never a circled play. |
| Bottom left | Draft it ▶ on Pattern. With a tool open, the tool's how-to. |
| Bottom right | Undo and Redo, with Start again while Move points is open. All round keeps Look closer here. |

Above the window, two lines at most: the garment's name with "Example body · Measure me" level with it at the right,
then The collection and Your tester look side by side. The header steps (Measure, Style, Print, Sew) each fit their
word, with equal space between them.

## How it's checked

The clarity checks' "one style per role" pass ([playbooks/clarity-checks.md] in the project files) lists every
button, link, play mark, back, close, tab, picked state, tag, label, heading, help line, fold and type size with its
computed style at five sizes, and compares them with this table. A role drawn two ways is a finding.
