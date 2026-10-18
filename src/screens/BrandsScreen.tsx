import { useEffect } from "react";
import { InterestCard } from "../ui/InterestCard";

interface Props {
  onPrivacy: () => void;
}

/** Tracé Engine for brands (Cat's E1 Quiet Page, 2026-10-18): what it would do and an early-access sign-up. Nothing is built behind it yet. */
export function BrandsScreen({ onPrivacy }: Props) {
  useEffect(() => window.scrollTo(0, 0), []);
  return (
    <article className="card legal promo" aria-labelledby="btitle">
      <p className="eyebrow">Tracé Engine · for brands</p>
      <h1 id="btitle">Every order cut to the person</h1>
      <p className="lead">
        Plug our drafting into your own shop. Each order arrives as a pattern
        drafted to that customer, ready for your cutting room.
      </p>
      <ol className="promo-steps">
        <li>
          <span className="num">01</span>Your customer measures in your shop
        </li>
        <li>
          <span className="num">02</span>We draft your block to their body
        </li>
        <li>
          <span className="num">03</span>You cut from their own pattern
        </li>
      </ol>
      <p className="muted small">
        Measurements stay between you and your customer. We would draft each
        pattern and keep nothing.
      </p>
      <InterestCard offer="engine" inset />
      <p className="fineprint">
        We keep only your email, to get in touch about early access.{" "}
        <button type="button" className="inline-link" onClick={onPrivacy}>
          Privacy Policy
        </button>
      </p>
    </article>
  );
}
