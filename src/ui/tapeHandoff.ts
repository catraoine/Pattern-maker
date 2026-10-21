/** Where the welcome's tape came to rest as the welcome closed, so the first measuring page can bring its own
 *  tape on from exactly there, whatever the window's layout (Cat, 2026-10-21: the tape must never jump). */
let rest: { left: number; top: number; at: number } | undefined;

export function tapeRested(el: Element) {
  const r = el.getBoundingClientRect();
  rest = { left: r.left, top: r.top, at: Date.now() };
}

/** Where the tape last came to rest, if it was a moment ago: the welcome's as the first page opens, the first page's
 *  as the waist page opens (Cat, 2026-10-21: the tape carries on down to the waist). */
export function takeTapeRest() {
  return rest && Date.now() - rest.at < 2000 ? rest : undefined;
}
