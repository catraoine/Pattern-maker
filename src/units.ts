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
  return `${Math.round((cm / 2.54) * 10) / 10} in`;
}

/** A length in the sewist's unit: "12 cm" or "4¾ in". */
export function fmtLength(cm: number, unit: Unit): string {
  return unit === 'cm' ? `${cm} cm` : toInches(cm);
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
// "30 × 20 cm" or "30 x 20 cm": both numbers are centimetres.
const PAIR_CM = new RegExp(`${NUM}\\s*([×x])\\s*${NUM}\\s*cm\\b(?!\\s*\\()`, 'g');
const ONE_CM = new RegExp(`${NUM}\\s*cm\\b(?!\\s*\\()`, 'g');
const ONE_M = new RegExp(`${NUM}\\s*m\\b(?!\\s*\\()`, 'g');
// The test square is the one length a sewist checks with a ruler, so it keeps the exact figure.
const SQUARE = /10 cm test square|exactly 10 cm/g;
const SQUARE_LABEL = /^10 CM$/;

const num = (s: string) => parseFloat(s.replace(',', '.'));

/**
 * Rewrite every centimetre and metre length in a piece of text as inches and yards. The 10 cm test square
 * keeps both, because a printed copy is checked against it and 3.94 in is the exact figure.
 */
export function inInches(text: string): string {
  if (SQUARE_LABEL.test(text)) return '10 CM · 3.94 IN';
  return text
    .replace(SQUARE, (m) => (m.startsWith('exactly') ? 'exactly 10 cm (3.94 in)' : '10 cm (3.94 in) test square'))
    .replace(PAIR_CM, (_, a, sep, b) => `${toInches(num(a)).replace(/ in$/, '')} ${sep} ${toInches(num(b))}`)
    .replace(ONE_CM, (_, a) => toInches(num(a)))
    .replace(ONE_M, (_, a) => toYards(num(a)));
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
