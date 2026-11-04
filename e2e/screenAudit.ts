import type { Page } from '@playwright/test';

// The screen check's eye (Quality: Automated checks, Cat 2026-11-04), run inside the page: what on this screen a person
// can't read or reach. Each finding names the thing by its words on screen, so the baseline holds the same finding
// from one run to the next.
// - the page scrolls sideways: something is wider than the screen;
// - off the screen: a button, a heading, a line of words standing out past the screen's left or right edge;
// - cut off: words clipped by the box they sit in (a button too narrow for its name, a heading under a lid), or an
//   ellipsis (…) cutting them short.
// Words in something that scrolls (a row of cards that slides) are not counted: they can be scrolled into view. Nor
// are words hidden on purpose for screen readers (a box 1 pixel across).
export async function auditScreen(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out = new Set<string>();
    const vw = document.documentElement.clientWidth;
    const wide = document.documentElement.scrollWidth - vw;
    if (wide > 1) out.add(`the page scrolls sideways: something is ${Math.round(wide)} px wider than the screen`);
    const ownText = (el: Element) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    const name = (el: Element, text: string) => {
      const role = el.closest('button, a, [role=button], [role=tab], [role=radio], [role=menuitemradio], label, h1, h2, h3, h4, th, td, li, p');
      const what = role ? role.tagName.toLowerCase() : el.tagName.toLowerCase();
      return `${what} "${text.length > 40 ? `${text.slice(0, 40)}…` : text}"`;
    };
    const visible = (el: Element, r: DOMRect) => {
      if (r.width <= 2 || r.height <= 2) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (el.closest('[aria-hidden="true"], [hidden], svg, details:not([open]) > :not(summary)')) return false;
      // Kept for screen readers only: a box a pixel across, or clipped away to nothing, round it.
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const ar = a.getBoundingClientRect();
        const acs = getComputedStyle(a);
        if (ar.width <= 2 || ar.height <= 2 || (acs.clipPath !== 'none' && /inset\(50%/.test(acs.clipPath)) || acs.clip.startsWith('rect(0')) return false;
      }
      return true;
    };
    for (const el of document.querySelectorAll('body *')) {
      const text = ownText(el);
      if (!text || /^[\s·•|/–—-]*$/.test(text)) continue;
      const r = el.getBoundingClientRect();
      if (!visible(el, r)) continue;
      const cs = getComputedStyle(el);
      // An ellipsis, or words longer than their own clipped box.
      const clipsX = /hidden|clip/.test(cs.overflowX);
      const clipsY = /hidden|clip/.test(cs.overflowY);
      if ((clipsX || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) out.add(`cut off: ${name(el, text)} is too wide for its box`);
      else if (clipsY && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) out.add(`cut off: ${name(el, text)} is too tall for its box`);
      // Clipped by a box around it, unless that box scrolls (the words can be brought into view).
      let scrolls = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (/auto|scroll/.test(acs.overflowX) || /auto|scroll/.test(acs.overflowY)) {
          scrolls = true;
          break;
        }
        const ar = a.getBoundingClientRect();
        if (/hidden|clip/.test(acs.overflowX) && (r.right > ar.right + 2 || r.left < ar.left - 2)) {
          out.add(`cut off: ${name(el, text)} runs past the side of the box it sits in`);
          break;
        }
        if (/hidden|clip/.test(acs.overflowY) && ar.height > 2 && (r.bottom > ar.bottom + 2 || r.top < ar.top - 2) && r.top < ar.bottom && r.bottom > ar.top) {
          out.add(`cut off: ${name(el, text)} runs past the top or bottom of the box it sits in`);
          break;
        }
      }
      if (!scrolls && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') out.add(`off the screen: ${name(el, text)} stands past the screen's edge`);
    }
    return [...out];
  });
}
