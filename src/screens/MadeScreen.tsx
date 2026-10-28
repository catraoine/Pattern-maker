import { useEffect } from 'react';

interface Props {
  onPrivacy: () => void;
}

/**
 * How your pattern is made (Cat's AI stance, 2026-10-28): sewists know "AI patterns" as untested junk, so say
 * plainly where AI is (reading a photo or a few words) and where it isn't (everything that draws the pattern).
 */
export function MadeScreen({ onPrivacy }: Props) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <article className="card legal promo" aria-labelledby="madetitle">
      <p className="eyebrow">How your pattern is made</p>
      <h1 id="madetitle">Drafted, not generated</h1>
      <p className="lead">
        Every line of your pattern is worked out from your measurements by pattern-cutting rules. The same measurements always give the
        same pattern.
      </p>
      <ol className="promo-steps">
        <li>
          <span className="num">01</span>You measure. A few measurements up front, more only when a style needs them.
        </li>
        <li>
          <span className="num">02</span>You choose the style, by hand or from a photo or a few words. For a photo or words, AI reads
          them and suggests the closest style. You check it and change anything before a line is drafted.
        </li>
        <li>
          <span className="num">03</span>We draft it to you: every seam, dart, ease and notch, then your print file and sewing steps.
        </li>
        <li>
          <span className="num">04</span>Real sewists test every garment. It stays marked "In testing" until they've sewn it and it fits.
        </li>
        <li>
          <span className="num">05</span>You sew a quick toile first, make any small fix, then cut your good fabric.
        </li>
      </ol>
      <h2>Is this an AI pattern?</h2>
      <p>
        No. Your pattern is drafted by pattern-cutting rules from your measurements, and real testers sew every garment. AI only reads a
        photo or a description to suggest a style, and you can skip it and choose everything yourself.
      </p>
      <h2>What happens to my photo?</h2>
      <p>
        It's shrunk on your device and sent only to be read for its style. We don't store it, and we never send your measurements or name with it.
      </p>
      <p className="fineprint">
        <button type="button" className="inline-link" onClick={onPrivacy}>
          Privacy Policy
        </button>
      </p>
    </article>
  );
}
