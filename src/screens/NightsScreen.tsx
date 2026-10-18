import { useEffect, useState } from "react";
import { CITY_NAMES, NIGHT_CITIES, NightCity } from "../offers";
import { InterestCard } from "../ui/InterestCard";

interface Props {
  onPrivacy: () => void;
}

/** Atelier Nights (Cat's N3 Pick Your City, 2026-10-18): tap a city to be counted in for a night there. No tickets are sold yet. */
export function NightsScreen({ onPrivacy }: Props) {
  const [open, setOpen] = useState<NightCity>();
  useEffect(() => window.scrollTo(0, 0), []);
  return (
    <article className="card legal promo" aria-labelledby="ntitle">
      <p className="eyebrow">Atelier Nights</p>
      <h1 id="ntitle">Cut it tonight</h1>
      <p className="lead">
        An evening to measure, draft and cut a piece with a pattern cutter
        beside you, with music and a fabric bar. Tap your city and we'll write
        when tickets open.
      </p>
      <ul className="cities">
        {NIGHT_CITIES.map((c, i) => (
          <li key={c}>
            <div className="city-row">
              <div>
                <strong>{CITY_NAMES[c]}</strong>
                <span className="eyebrow">{i === 0 ? "First" : "Next"}</span>
              </div>
              <button
                type="button"
                className="secondary"
                aria-expanded={open === c}
                onClick={() => setOpen(open === c ? undefined : c)}
              >
                Count me in
              </button>
            </div>
            {open === c && <InterestCard offer="nights" city={c} inset />}
          </li>
        ))}
      </ul>
      <p className="muted small">25 seats a night.</p>
      <p className="fineprint">
        We keep only your email and the city you picked, to tell you when
        tickets open.{" "}
        <button type="button" className="inline-link" onClick={onPrivacy}>
          Privacy Policy
        </button>
      </p>
    </article>
  );
}
