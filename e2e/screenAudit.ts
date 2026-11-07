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
        const acs = getComputedStyle(a);
        // A box drawn as its children only (display: contents, as the drawing's row on a phone) has no size of its own.
        if (acs.display === 'contents') continue;
        const ar = a.getBoundingClientRect();
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

    // Words printed over other words, or over a drawing (Cat, Nov 7: Enlarge and Draw sat on the Flat drawing, Draw on
    // the pattern's how-to line). Measured by the words' own lines, not their boxes, and against a drawing's lines and
    // fills themselves, not the empty box round it.
    const lines: { el: Element; text: string; rects: DOMRect[] }[] = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg')) continue;
      const nodes = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim());
      if (!nodes.length) continue;
      const text = ownText(el);
      const box = el.getBoundingClientRect();
      if (!visible(el, box)) continue;
      const rects: DOMRect[] = [];
      for (const n of nodes) {
        const range = document.createRange();
        range.selectNodeContents(n);
        rects.push(...[...range.getClientRects()].filter((q) => q.width > 2 && q.height > 2));
      }
      if (rects.length) lines.push({ el, text, rects });
    }
    // Shrunk a little, so letters that only touch (a tight line height, an underline) don't count.
    const meet = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3;
    // Only what is on the screen as it stands: the page's own scroll puts words under the pinned header, the pinned
    // drawing and the bar at the foot, and a sheet (the list of steps) opens over the page on purpose. Those hide the
    // words under them; they don't print over them.
    const vh = window.innerHeight;
    const onScreen = (q: DOMRect) => q.top >= 0 && q.bottom <= vh;
    const layer = (el: Element) => {
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.position === 'fixed' || cs.position === 'sticky' || a.matches('[role=dialog], dialog, .sheet, [role=tablist]')) return a;
      }
      return document.body;
    };
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i];
        const b = lines[j];
        if (a.el.contains(b.el) || b.el.contains(a.el) || layer(a.el) !== layer(b.el)) continue;
        if (a.rects.some((p) => onScreen(p) && b.rects.some((q) => meet(p, q)))) out.add(`overlap: ${name(a.el, a.text)} prints over ${name(b.el, b.text)}`);
      }
    // Over a drawing: the words' lines against the drawing's own painted lines and fills (a backdrop filling most of
    // its drawing, such as pattern paper, is the ground the drawing sits on, not the drawing).
    const shapes = [...document.querySelectorAll<SVGGeometryElement>('svg path, svg polygon, svg polyline, svg line, svg circle, svg ellipse, svg rect')].filter((s) => {
      if (s.closest('defs, clipPath, mask, pattern, marker, symbol, [aria-hidden="true"]:not(svg)')) return false;
      const cs = getComputedStyle(s);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
      if (cs.fill === 'none' && cs.stroke === 'none') return false;
      const svg = s.ownerSVGElement;
      if (!svg || svg.closest('[hidden]')) return false;
      const sr = s.getBoundingClientRect();
      const vr = svg.getBoundingClientRect();
      if (sr.width < 1 && sr.height < 1) return false;
      return sr.width * sr.height < 0.6 * vr.width * vr.height;
    });
    for (const l of lines) {
      if (l.el.closest('.all-round-quiet, .all-round')) continue;
      const hits = new Set<SVGSVGElement>();
      for (const q of l.rects)
        for (const s of shapes) {
          const svg = s.ownerSVGElement!;
          if (hits.has(svg) || svg.contains(l.el) || l.el.contains(svg)) continue;
          // An icon inside the same button or link as the words is part of that button.
          const own = l.el.closest('button, a, label, summary');
          if (own && own.contains(svg)) continue;
          const sr = s.getBoundingClientRect();
          if (!onScreen(q) || !meet(sr, q)) continue;
          // Cut away by a box round the drawing (the form's head above the drawing's box), it isn't painted there.
          let shown = true;
          for (let a: Element | null = svg; a && a !== document.body; a = a.parentElement) {
            const acs = getComputedStyle(a);
            if (acs.overflowX !== 'visible' || acs.overflowY !== 'visible') {
              const ar = a.getBoundingClientRect();
              if (!meet(ar, q)) shown = false;
            }
          }
          if (!shown) continue;
          // Words pinned at the top or foot, with the page's drawing scrolled under them.
          if (layer(l.el) !== layer(svg) && !layer(l.el).contains(svg)) continue;
          const m = s.getScreenCTM()?.inverse();
          if (!m) continue;
          const cs = getComputedStyle(s);
          let painted = 0;
          for (let x = 1; x < 6; x++)
            for (let y = 1; y < 4; y++) {
              const pt = new DOMPoint(q.left + (q.width * x) / 6, q.top + (q.height * y) / 4).matrixTransform(m);
              if ((cs.fill !== 'none' && s.isPointInFill(pt)) || (cs.stroke !== 'none' && s.isPointInStroke(pt))) painted++;
            }
          if (painted >= 2) {
            hits.add(svg);
            const what = svg.getAttribute('aria-label') ?? svg.querySelector('title')?.textContent ?? svg.getAttribute('class') ?? 'a drawing';
            out.add(`overlap: ${name(l.el, l.text)} prints over the drawing "${what.length > 40 ? `${what.slice(0, 40)}…` : what}"`);
          }
        }
    }
    return [...out];
  });
}
