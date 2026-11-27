// Hold to leave a note (Cat, Nov 26, 2026: "Hold to drop a pin"): on a tester's device, pressing and holding any spot
// still for half a second opens Help & feedback pinned to that spot, like dropping a pin in a map app. A right click
// does the same on a computer. Plain double tap was ruled out: it already zooms All round and the page itself.
// What the pin says is only what's on screen at that spot, with numbers taken out (a measurement is never sent), and the
// tester sees all of it in the box before sending.

/** How long a finger stays still before the note opens. Half a second, like a map's dropped pin. */
export const HOLD_MS = 500;
/** When the ring starts to fill, so a quick tap never flashes one. */
export const RING_MS = 150;
/** How far a finger can drift and still count as held still. Turning the garment always moves it further. */
export const MOVE_PX = 10;

/** Places a hold belongs to the app, not to a note: typing, sliders, dragging points, drawing a line, the projector. */
const NOT_A_PIN = 'input, textarea, select, [contenteditable="true"], [role="slider"], [role="application"], .drawing, .projector, .projector-stage, .tour, [data-no-pin], .pin-layer';

/** True when a hold on this element should do what it always did. */
export const holdsItsOwn = (el: Element | null) => !el || !!el.closest(NOT_A_PIN);

/** Screens made of other people's names and studios (the client book, a measuring link sent or arriving): only the
 *  screen is said. */
const NAMED_VIEWS = new Set(['client', 'arrive', 'link']);

/** Words too common to hide when someone is named them ("Me" is the owner's name until they give one). */
const TOO_COMMON = new Set(['me', 'my', 'i', 'you', 'your']);

/** The names this device holds (the owner, the people measured, a studio), to take out of the words. */
export const namesToHide = (names: readonly (string | undefined)[]) => [...new Set(names.map((n) => n?.trim() ?? '').filter((n) => n.length > 1 && !TOO_COMMON.has(n.toLowerCase())))];

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Words for one spot: short, single-spaced, and with no numbers, names or email addresses, so a measurement or a person
 * shown there is never sent. `hide` is namesToHide's list.
 */
export function scrub(text: string | null | undefined, max = 50, hide: readonly string[] = []): string {
  let t = (text ?? '').replace(/\S+@\S+/g, 'an email').replace(/\d+([.,]\d+)?/g, '#');
  for (const n of hide) t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, 'giu'), 'a name');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  // Cut at a word, never inside one ("fr…" read as nothing, the Nov 27 walk).
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Where in a drawing the pin sits, in plain words: "lower middle" reads quicker than two numbers. */
export function region(fx: number, fy: number): string {
  const row = fy < 1 / 3 ? 'upper' : fy < 2 / 3 ? 'middle' : 'lower';
  const col = fx < 1 / 3 ? 'left' : fx < 2 / 3 ? 'centre' : 'right';
  if (row === 'middle' && col === 'centre') return 'centre';
  return `${row} ${col === 'centre' ? 'middle' : col}`;
}

/** An element's words with a space between each piece: textContent ran "Opening" and its chip's name together
 *  (the Nov 27 stills). */
function wordsOf(el: Element): string {
  const parts: string[] = [];
  const walk = el.ownerDocument.createTreeWalker(el, 4 /* text nodes */);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue?.trim()) parts.push(n.nodeValue.trim());
  return parts.join(' ');
}

/** The control or label under the finger, by the words it shows (or its spoken label). */
function controlWords(el: Element, hide: readonly string[]): string {
  const c = el.closest('button, a, [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], label, summary, legend');
  if (!c) return '';
  return scrub(c.getAttribute('aria-label') || wordsOf(c), 50, hide);
}

/** The heading of the part of the screen the spot is in. */
function sectionWords(el: Element, hide: readonly string[]): string {
  for (let at: Element | null = el; at; at = at.parentElement) {
    const head = at.matches('h1, h2, h3, legend, summary') ? at : at.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > legend, :scope > summary, :scope > header h1, :scope > header h2, :scope > div > h2, :scope > div > h3');
    // A heading that holds the spot or other controls is a whole question, not its name: keep looking further up.
    if (!head || head.contains(el) || head.querySelector('button, a, input, [role="radio"], [role="button"]')) continue;
    const words = wordsOf(head);
    if (words) return scrub(words, 50, hide);
  }
  return '';
}

interface PinSpot {
  /** What is there, in the app's words: "All round view of your shift, lower middle", "Sleeve length". */
  spot: string;
  /** The heading of that part of the screen, when there is one and it says something more. */
  section?: string;
  /** Which garment view or tab was showing (Front, Flat, All round), when the screen has one. */
  showing?: string;
}

/** The garment view showing (Front, Flat, All round), when the spot is in the part of the screen that has the views. */
function viewShowing(el: Element): string | undefined {
  for (let at: Element | null = el; at && at.tagName !== 'MAIN' && at.tagName !== 'BODY'; at = at.parentElement) {
    const views = at.querySelector('[aria-label="Garment view"]');
    if (views) return scrub(views.querySelector('[aria-pressed="true"]')?.textContent, 30) || undefined;
  }
  return undefined;
}

/** Describes the spot under a held finger, from what the screen shows there. `hide`: see namesToHide. */
export function spotAt(el: Element, x: number, y: number, view: string, hide: readonly string[] = []): PinSpot {
  if (NAMED_VIEWS.has(view)) return { spot: 'this screen' };
  const drawing = el.closest('[role="img"], [role="group"][aria-label]');
  let spot = controlWords(el, hide);
  if (!spot && drawing) {
    const box = drawing.getBoundingClientRect();
    const fx = box.width ? (x - box.left) / box.width : 0.5;
    const fy = box.height ? (y - box.top) / box.height : 0.5;
    // The drawing's own label, up to its first full stop: the rest is help on how to use it.
    const name = scrub((drawing.getAttribute('aria-label') ?? 'the drawing').split('. ')[0], 60, hide);
    spot = `${name}, ${region(Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy)))}`;
  }
  // The garment view is said only for a spot on the drawing: a chip beside it is the same whatever view shows.
  const showing = !controlWords(el, hide) && drawing ? viewShowing(el) : undefined;
  if (!spot) spot = scrub(wordsOf(el), 50, hide) || 'an empty part of the screen';
  const section = sectionWords(el, hide);
  const repeats = !!section && (section.toLowerCase().includes(spot.toLowerCase()) || spot.toLowerCase().includes(section.toLowerCase()));
  return { spot, ...(section && !repeats ? { section } : {}), ...(showing ? { showing } : {}) };
}

/** What a pinned note carries about its spot, as the server takes it (src/server/notes.ts). */
export interface Pin extends PinSpot {
  /** Where on the screen, as a share of its width and height, so the spot can be found again on any size. */
  x: number;
  y: number;
  /** The garment open at the time, by its name in the app (or its look's name), on screens about a garment. */
  garment?: string;
  device: 'phone' | 'computer';
  /** The window's size in CSS pixels, "390x844". */
  screen: string;
}

/** Screens about one garment, where its name says which pattern the note is about. */
const GARMENT_VIEWS = new Set(['style', 'photo', 'export', 'sew', 'fitting', 'scale', 'collection']);

export function pinFor(spot: PinSpot, x: number, y: number, view: string, garment: string | undefined, phone: boolean, w: number, h: number): Pin {
  const share = (v: number, of: number) => (of > 0 ? Math.round(Math.min(1, Math.max(0, v / of)) * 1000) / 1000 : 0);
  return {
    ...spot,
    x: share(x, w),
    y: share(y, h),
    ...(garment && GARMENT_VIEWS.has(view) ? { garment: scrub(garment, 60) || undefined } : {}),
    device: phone ? 'phone' : 'computer',
    screen: `${Math.round(w)}x${Math.round(h)}`,
  };
}

/** The one line the tester reads before sending, so nothing goes that they haven't seen. */
export function pinLine(pin: Pin, screenName: string): string {
  // A drawing's own label often names the garment and its view already ("Knee A-line skirt, front view"): said once.
  const has = (t?: string) => !!t && pin.spot.toLowerCase().includes(t.toLowerCase());
  return [!has(pin.garment) && pin.garment, pin.spot, pin.section, !has(pin.showing) && pin.showing && `${pin.showing} view`, `${screenName} screen`].filter(Boolean).join(' · ');
}

type HoldEvent = { pointerId: number; pointerType: string; clientX: number; clientY: number; button: number };

/**
 * Watches a finger for a still hold. Told each pointer event; says when to show the ring and when the hold is done.
 * Kept apart from the page so its rules can be tested: one finger only, still within MOVE_PX, for HOLD_MS.
 */
export class HoldWatch {
  private down = new Map<number, { x: number; y: number }>();
  private ringTimer?: ReturnType<typeof setTimeout>;
  private doneTimer?: ReturnType<typeof setTimeout>;
  private held?: { id: number; x: number; y: number; el: Element };

  constructor(private on: { ring: (x: number, y: number) => void; done: (x: number, y: number, el: Element) => void; stop: () => void }) {}

  start(e: HoldEvent, el: Element | null) {
    this.down.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // A mouse holds nothing (a computer uses the right click), and a second finger is a pinch, not a pin.
    if (e.pointerType === 'mouse' || this.down.size > 1 || e.button > 0 || !el || holdsItsOwn(el)) return this.cancel();
    this.cancel();
    this.held = { id: e.pointerId, x: e.clientX, y: e.clientY, el };
    this.ringTimer = setTimeout(() => this.held && this.on.ring(this.held.x, this.held.y), RING_MS);
    this.doneTimer = setTimeout(() => this.finish(), HOLD_MS);
  }

  move(e: HoldEvent) {
    if (!this.held || e.pointerId !== this.held.id) return;
    if (Math.hypot(e.clientX - this.held.x, e.clientY - this.held.y) > MOVE_PX) this.cancel();
  }

  end(e: Pick<HoldEvent, 'pointerId'>) {
    this.down.delete(e.pointerId);
    if (this.held?.id === e.pointerId) this.cancel();
  }

  /** The phone's own long press (Android's menu): ours instead, if the finger was held still on a spot we take. */
  finishNow(): boolean {
    if (!this.held) return false;
    this.finish();
    return true;
  }

  cancel() {
    clearTimeout(this.ringTimer);
    clearTimeout(this.doneTimer);
    if (this.held) this.on.stop();
    this.held = undefined;
  }

  private finish() {
    const h = this.held;
    clearTimeout(this.ringTimer);
    clearTimeout(this.doneTimer);
    this.held = undefined;
    if (h) this.on.done(h.x, h.y, h.el);
  }
}
