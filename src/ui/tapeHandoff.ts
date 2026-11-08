/** Where the welcome's tape came to rest as the welcome closed, so the first measuring page can bring its own
 *  tape on from exactly there, whatever the window's layout (Cat, 2026-10-21: the tape must never jump). */
let rest: { left: number; top: number; width: number; at: number } | undefined;

export function tapeRested(el: Element) {
  const r = el.getBoundingClientRect();
  rest = { left: r.left, top: r.top, width: r.width, at: Date.now() };
}

/** Where the tape last came to rest, if it was a moment ago: the welcome's as the first page opens, the first page's
 *  as the waist page opens (Cat, 2026-10-21: the tape carries on down to the waist). */
export function takeTapeRest() {
  return rest && Date.now() - rest.at < 2000 ? rest : undefined;
}

/** Forget where the tape rested: Begin measuring takes it on round the neck, not carried from across the top. */
export function clearTapeRest() {
  rest = undefined;
}

/** Begin measuring on the first page, a moment ago: the waist page comes up out of the black rather than cutting in. */
let left = 0;
export function introLeft() {
  left = Date.now();
}
export function takeIntroLeft() {
  const recent = Date.now() - left < 2000;
  left = 0;
  return recent;
}
