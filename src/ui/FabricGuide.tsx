import { useRef } from 'react';
import { DRAPES, WEIGHTS } from '../engine/fabrics';

const SHOP_TIPS = [
  'Check the width on the bolt. The metres you need change with it.',
  'Pull it gently across. If it stretches back, it is a knit or has elastane: this pattern needs woven cloth.',
  'Unroll a metre and let it hang from your hand to see how it drapes.',
  'Scrunch a corner in your fist. Deep creases that stay mean it will wrinkle as you wear it.',
  'Buy 10% extra for shrinkage, and more for a nap, a one-way print or a large pattern to match.',
];

const CUT_TIPS = [
  'Pre-wash and dry it the way you will wash the finished piece. Steam wool instead, and test silk on a small square.',
  'Press it, then straighten the grain so the cut end sits square to the selvedge.',
  'Make the toile in calico of a similar weight. For a fluid fabric, use an inexpensive viscose so it hangs the same way.',
];

/** A "Fabric guide" link that opens a short guide to weight, drape and buying fabric. */
export function FabricGuide({ label = 'Fabric guide' }: { label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="link" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog ref={dialog} className="guide" aria-labelledby="fgtitle" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="guide-body">
          <div className="row between">
            <p className="eyebrow">Fabric guide</p>
            <button type="button" className="link" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>
          <h2 id="fgtitle">Choosing your fabric</h2>
          <p className="muted small">
            Every pattern here is drafted for woven fabric, the kind that doesn't stretch. Two things decide how it looks made up: its weight
            and its drape.
          </p>
          <div className="scale">
            <p className="eyebrow">Weight</p>
            <div className="scalebar">
              {WEIGHTS.map((w) => (
                <div key={w.id}>
                  <b>{w.label}</b>
                  {w.examples}
                </div>
              ))}
            </div>
          </div>
          <div className="scale">
            <p className="eyebrow">Drape</p>
            <div className="scalebar">
              {DRAPES.map((d) => (
                <div key={d.id}>
                  <b>{d.label}</b>
                  {d.about}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">In the shop</p>
            <ul className="tips">
              {SHOP_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Before you cut</p>
            <ul className="tips">
              {CUT_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </dialog>
    </>
  );
}
