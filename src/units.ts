import type { Unit } from './measurements';

/**
 * Lengths for sewists who measure in inches. The engine drafts in centimetres throughout; the text a sewist reads
 * (style summaries, print notes, sewing steps and the PDF) is turned into inches at the edge, so one setting
 * reaches every page. Inches are shown to the nearest eighth, the way patterns and tape measures mark them.
 */

const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** `2.5` → "1 in", `1.5` → "⅝ in": the nearest eighth of an inch. */
export function toInches(cm: number): string {
  const eighths = Math.round((cm / 2.54) * 8);
  const whole = Math.floor(eighths / 8);
  const part = EIGHTHS[eighths % 8];
  if (!whole && !part) return '0 in';
  return `${whole || ''}${part} in`;
}

/** Fabric amounts: metres to yards, rounded up to the next eighth so the cloth is never short. */
export function toYards(m: number): string {
  const eighths = Math.ceil((m / 0.9144) * 8 - 1e-9);
  const whole = Math.floor(eighths / 8);
  const part = EIGHTHS[eighths % 8];
  return `${whole || ''}${part} yd`;
}

/** A height in feet and inches, the way most people know it: 165 cm → "5 ft 5 in". */
export function toFeetInches(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)} ft ${inches % 12} in`;
}

/** A measurement as the sewist reads it back: centimetres, inches to a tenth, or feet and inches for a height. */
export function fmtMeasure(id: string, cm: number, unit: Unit): string {
  if (unit === 'cm') return `${cm} cm`;
  if (id === 'height') return toFeetInches(cm);
  return `${inchWords(measureInches(cm))} in`;
}

/** A measurement in inches as it was typed. It's kept to a tenth of a centimetre, so a tape's 37.75 came back as 37.8
 *  and 15.25 as 15.2 (pretend-tester walk, Nov 18). The tenth of an inch is shown when it gives back the same tenth of a
 *  cm; failing that the quarter inch, a tape's own mark, when that does; otherwise the tenth (entered in cm, say). */
export function measureInches(cm: number): number {
  const inches = cm / 2.54;
  const back = (n: number) => Math.round(n * 25.4) / 10 === cm;
  const tenth = Math.round(inches * 10) / 10;
  const quarter = Math.round(inches * 4) / 4;
  return back(tenth) || !back(quarter) ? tenth : quarter;
}

/** Inches as read back on screen: a quarter or half inch the way every page writes it, "7¾", "30½" (a typed 7 3/4
 *  showed as "7.75" in the step list while the pages said ¾, pretend tester, Nov 18); any other tenth stays a decimal. */
export function inchWords(inches: number): string {
  const quarters = Math.round(inches * 4);
  if (Math.abs(inches * 4 - quarters) > 1e-9 || quarters % 4 === 0) return String(inches);
  return `${Math.floor(quarters / 4) || ''}${EIGHTHS[(quarters % 4) * 2]}`;
}

/** A length in the sewist's unit: "12 cm" or "4¾ in". */
export function fmtLength(cm: number, unit: Unit): string {
  return unit === 'cm' ? `${cm} cm` : toInches(cm);
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
// "30 × 20 cm" or "30 x 20 cm": both numbers are centimetres. A length already followed by its inches, "10 cm (3.94
// in)", is left alone; other brackets are not ("neckline 19.5 cm (half)" stayed in cm in the inch booklet, Nov 17).
const DONE = '(?!\\s*\\(\\d)';
const PAIR_CM = new RegExp(`${NUM}\\s*([×x])\\s*${NUM}\\s*cm\\b${DONE}`, 'g');
const ONE_CM = new RegExp(`${NUM}\\s*cm\\b${DONE}`, 'g');
const ONE_M = new RegExp(`${NUM}\\s*m\\b${DONE}`, 'g');
// The labels printed along each seam are in capitals ("SHOULDER · 1.5 CM ALLOWANCE") and stayed in centimetres in an
// inch PDF whose title block said "Seam allowance 5/8 in" (Nov 17).
const ONE_CM_CAPS = new RegExp(`${NUM}\\s*CM\\b${DONE}`, 'g');
// And the fabric amount on the booklet's cover and cutting layout ("2.4 M OF 55⅛ IN FABRIC").
const ONE_M_CAPS = new RegExp(`${NUM}\\s*M\\b${DONE}`, 'g');
// Millimetres, for the small steps in sewing ("trim 3 mm off", "2 mm from its edge"): to the nearest sixteenth of an inch,
// never less than one, since an eighth is too coarse for them (Nov 17: they stayed in mm in the inch booklet).
const ONE_MM = new RegExp(`${NUM}\\s*mm\\b${DONE}`, 'g');
function mmToInches(mm: number): string {
  const sixteenths = Math.max(1, Math.round((mm / 25.4) * 16));
  return sixteenths % 2 ? `${sixteenths}/16 in` : toInches((sixteenths / 16) * 2.54);
}
// "stitch the sides 1 cm in." turned into "3/8 in in."; said the way an inch pattern does instead. Only where "in"
// means inward (at the end of a clause, or before "from", "as soon", "and along" or "if you"), never "1 cm in length".
const IN_IN = /([\d⅛¼⅜½⅝¾⅞][\d/⅛¼⅜½⅝¾⅞-]* in) in(?=[.,;:)]|$| from\b| as soon\b| and along\b| if you\b)( from)?/g;
// The test square is the one length a sewist checks with a ruler, so it keeps the exact figure.
const SQUARE = /10 cm test square|exactly 10 cm/g;
const SQUARE_LABEL = /^10 CM$/;

const num = (s: string) => parseFloat(s.replace(',', '.'));
// An iron's heat, "about 150 C": an inch sewist reads Fahrenheit, to the nearest 10 like the dial (pretend tester, Nov 18).
const IRON_C = /\b(about) (\d+) C\b/gi;

/**
 * Rewrite every centimetre and metre length in a piece of text as inches and yards. The 10 cm test square
 * keeps both, because a printed copy is checked against it and 3.94 in is the exact figure.
 */
export function inInches(text: string): string {
  if (SQUARE_LABEL.test(text)) return '10 CM · 3.94 IN';
  return text
    .replace(IRON_C, (_, about, c) => `${about} ${Math.round((Number(c) * 9) / 5 / 10 + 3.2) * 10} F`)
    .replace(SQUARE, (m) => (m.startsWith('exactly') ? 'exactly 10 cm (3.94 in)' : '10 cm (3.94 in) test square'))
    .replace(PAIR_CM, (_, a, sep, b) => `${toInches(num(a)).replace(/ in$/, '')} ${sep} ${toInches(num(b))}`)
    .replace(ONE_CM, (_, a) => toInches(num(a)))
    .replace(ONE_CM_CAPS, (_, a) => toInches(num(a)).replace(/ in$/, ' IN'))
    .replace(ONE_M, (_, a) => toYards(num(a)))
    .replace(ONE_M_CAPS, (_, a) => toYards(num(a)).replace(/ yd$/, ' YD'))
    .replace(ONE_MM, (_, a) => mmToInches(num(a)))
    .replace(IN_IN, (_, len, from) => (from ? `${len} from` : `${len} from the edge`));
}

/**
 * Show a page in inches: every length in its text is rewritten as it appears, and again whenever the page
 * changes. Returns a function that stops it. The screens keep drafting and writing centimetres, so switching
 * back is a matter of letting the text through untouched.
 *
 * A length is often two text nodes ("75.9" and " cm"), so runs of neighbouring text nodes are read as one.
 * What the page itself wrote is kept apart from what was written over it, so a value the page updates later
 * is read afresh rather than on top of the rewrite.
 */
export function showInInches(root: Node): () => void {
  const written = new WeakMap<Node, string>();
  const source = new WeakMap<Node, string>();
  const isText = (n: Node | null): n is Text => !!n && n.nodeType === Node.TEXT_NODE;
  const original = (n: Text) => {
    const v = n.nodeValue ?? '';
    if (written.get(n) !== v) source.set(n, v);
    return source.get(n) ?? v;
  };
  const put = (n: Text, v: string) => {
    if (n.nodeValue !== v) n.nodeValue = v;
    written.set(n, v);
  };
  const fixRun = (node: Text) => {
    const parent = node.parentElement;
    if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.closest('[data-keep-cm]')) return;
    let first: Text = node;
    while (isText(first.previousSibling)) first = first.previousSibling;
    const run: Text[] = [];
    for (let n: Node | null = first; isText(n); n = n.nextSibling) run.push(n);
    const originals = run.map(original);
    const whole = originals.join('');
    const changed = inInches(whole);
    if (changed === whole) run.forEach((n, i) => put(n, originals[i]));
    else run.forEach((n, i) => put(n, i ? '' : changed));
  };
  const fix = (node: Node) => {
    if (isText(node)) return fixRun(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
    texts.forEach(fixRun);
  };
  fix(root);
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') fix(r.target);
      else r.addedNodes.forEach(fix);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true });
  return () => {
    observer.disconnect();
    // Put the page's own words back.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text;
      if (written.has(t) && source.has(t) && t.nodeValue === written.get(t)) t.nodeValue = source.get(t)!;
    }
  };
}

const FRACTION: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
const UNIT_SAID = /\s*(cm|centimet(?:er|re)s?|mm|in|inch(?:es)?|"|”|″)$/;

/**
 * A length as someone types or pastes it, in centimetres. A unit written with it wins over the screen's unit, and
 * a tape's fractions ("33 1/2", "33½") count, because "33 in" pasted into a cm box was read as 33 cm and "33 1/2"
 * as 33, then turned away as out of range (bug hunt's paste check, Nov 15). NaN when there's no number.
 */
export function typedLength(text: string, unit: Unit): number {
  // A full stop or comma after it ("33 in.", pasted from a sentence) is left off (code review, Nov 15).
  let t = text.trim().toLowerCase().replace(/(\d),(\d)/, '$1.$2').replace(/[.,;:]+$/, '');
  const said = t.match(UNIT_SAID)?.[1];
  if (said) t = t.slice(0, -said.length).trim();
  // "33 1/2" or "33-1/2" (a space or dash before the fraction, so "12/2" isn't read as 1 and 2/2), "33½", "1/2", or a
  // plain number.
  const m = t.match(/^(?:(\d+(?:\.\d+)?)(?:(?:\s+|\s*-\s*)(\d+)\/(\d+)|\s*([¼½¾⅛⅜⅝⅞]))?|(\d+)\/(\d+))$/);
  const n = !m ? parseFloat(t) : m[5] ? Number(m[5]) / Number(m[6]) : parseFloat(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : m[4] ? FRACTION[m[4]] : 0);
  if (!Number.isFinite(n)) return NaN;
  if (said === 'mm') return n / 10;
  if (said?.startsWith('c')) return n;
  return said || unit === 'in' ? n * 2.54 : n;
}
