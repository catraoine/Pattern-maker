import { useState } from 'react';
import { exactColourFile, SPOONFLOWER_URL } from '../engine/exactColour';
import { InterestCard } from './InterestCard';
import { TestingTag } from './TestingTag';

/** Draws the picked colour as a square PNG at Spoonflower's print size, or nothing where there's no canvas. */
function colourPng(hex: string): string | undefined {
  const { px } = exactColourFile(hex);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, px, px);
  return canvas.toDataURL('image/png');
}

/** Exact Colour Card (Cat's X1, 2026-10-26): when no shop colourway is a near match, the picked colour can be printed
 * by Spoonflower or hand dyed to order. Printing saves a colour file and opens Spoonflower; dyeing is a sign-up
 * until partner studios join. Both are palette cards in the picked colour. */
export function ExactColour({ hex, garment }: { hex: string; garment: string }) {
  const [printed, setPrinted] = useState(false);
  const [dyed, setDyed] = useState(false);
  const file = exactColourFile(hex);

  const printIt = () => {
    // Both happen in the tap itself, so phones don't block the new tab.
    const png = colourPng(hex);
    if (png) {
      const a = document.createElement('a');
      a.href = png;
      a.download = file.name;
      a.click();
    }
    window.open(SPOONFLOWER_URL, '_blank', 'noopener');
    setPrinted(true);
  };

  return (
    <div className="exactcolour">
      <p className="colourmatch-q">
        Not close enough? Get <span className="hexname">{hex}</span> exactly <TestingTag />
      </p>
      <div className="exactcolour-row">
        <button type="button" className="exactcard" onClick={printIt} aria-describedby="exact-print">
          <span className="card-tex" style={{ backgroundColor: hex }} aria-hidden="true" />
          <span className="card-name">Print it</span>
        </button>
        <span className="exactcolour-text" id="exact-print">
          <b>Printed by Spoonflower</b>
          <span className="muted small">Cotton, linen and silk blends, from about US$20 a yard, 1 to 2 weeks.</span>
        </span>
      </div>
      {printed && (
        <ol className="exactcolour-steps muted small">
          <li>
            We saved <span className="hexname">{file.name}</span>, an {file.inches} inch square in exactly {hex}.
          </li>
          <li>On Spoonflower, choose Create, then upload the file. It stays private to you.</li>
          <li>Pick your fabric. Order a small swatch first, because printed colour can look different from your screen.</li>
        </ol>
      )}
      <div className="exactcolour-row">
        <button type="button" className={`exactcard${dyed ? ' on' : ''}`} onClick={() => setDyed(!dyed)} aria-expanded={dyed} aria-describedby="exact-dye">
          <span className="card-tex" style={{ backgroundColor: hex }} aria-hidden="true" />
          <span className="card-name">Dyed to order</span>
        </button>
        <span className="exactcolour-text" id="exact-dye">
          <b>Hand dyed by a studio</b>
          <span className="muted small">Natural fibres, matched to your colour, about 3 to 5 weeks. Opening soon.</span>
        </span>
      </div>
      {dyed && <InterestCard offer="dyed" pattern={`${garment} ${hex}`} inset />}
    </div>
  );
}
