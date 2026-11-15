/** The first measuring page's picture (Cat's T1 + F5 + G2, Nov 15): a sewing tape laid full width along the top, its
 *  metal end at the left, in place of the line form, which the page no longer needs (the measuring pages after it
 *  show the body). Drawn larger than the travelling tape so it reads as a tape, not a header bar (Cat, Nov 8). The
 *  How it works film slides its tape in along the top and lands on this one. Long enough for the widest card. */
export function FirstTape() {
  return (
    <div className="first-tape" aria-hidden="true">
      <div className="tape-band landed">
        <div className="tape-marks">
          {Array.from({ length: 40 }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What to have to hand before the first measurement (Cat's F5, Nov 15), quiet numbered rows under the title. */
export function FirstNeeds() {
  return (
    <section className="first-needs" aria-labelledby="first-needs-h">
      <p className="first-label" id="first-needs-h">
        What you need
      </p>
      <ol>
        <li>A soft tape measure</li>
        {/* The asides close up on a short screen (39-first-form.css), so the three fit on fewer lines. Each row's words sit
            in one span, because the row is a flex box and its gap would otherwise open a space before the comma. */}
        <li>
          <span>
            A piece of string<span className="first-aside">, if you have one</span>
          </span>
        </li>
        <li>
          <span>
            Someone to help<span className="first-aside">, if you can</span>
          </span>
        </li>
      </ol>
    </section>
  );
}
