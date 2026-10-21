/** Where the welcome's tape came to rest as the welcome closed, so the first measuring page can bring its own
 *  tape on from exactly there, whatever the window's layout (Cat, 2026-10-21: the tape must never jump). */
let rest: { left: number; top: number; at: number } | undefined;

export function tapeRested(el: Element) {
  const r = el.getBoundingClientRect();
  rest = { left: r.left, top: r.top, at: Date.now() };
}

/** The welcome's resting tape, if it closed a moment ago; taken once. */
export function takeTapeRest() {
  const r = rest;
  rest = undefined;
  return r && Date.now() - r.at < 2000 ? r : undefined;
}
