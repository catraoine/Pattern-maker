// A copy shop prints the whole pattern on large paper, so nothing is taped (Cat, Nov 14: "add connection to print
// shop here"; she agreed to a row that switches to A0 and finds a shop nearby, with what to ask for at the counter).
// A map search rather than one named shop: it works in every town and needs no partner.
const NEAR_ME = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('large format printing near me');

/** "Print at a copy shop" in the Print screen's Other ways list: one tap switches the paper to A0. While A0 is the
 *  paper (picked here or from the paper menu) it stays open, saying what to ask for, with a map of nearby shops. */
export function CopyShopWay({ a0, onA0, unit }: { a0: boolean; onA0: () => void; unit: 'cm' | 'in' }) {
  if (!a0)
    return (
      <button type="button" className="way" onClick={onA0}>
        Print at a copy shop
      </button>
    );
  return (
    <div className="stack copy-shop" role="group" aria-labelledby="copy-shop-title">
      <p id="copy-shop-title" className="eyebrow">
        Print at a copy shop
      </p>
      <p className="small">
        <b>Ask for</b> A0 paper ({unit === 'in' ? '33 × 47 in' : '84 × 119 cm'}), printed at 100% (actual size).
      </p>
      <a className="way" href={NEAR_ME} target="_blank" rel="noopener noreferrer">
        Find a copy shop near me
      </a>
    </div>
  );
}
