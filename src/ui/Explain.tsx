import { useState } from 'react';
import { ExplainSet, SKILL_WORDS, explainLine, shortLine } from '../explain';
import { BigDrawing, Drawing } from './Drawing';
import { detailPic } from './detailPics';

/**
 * The line under a Style section that says what its picked choice does (Cat's E2 Line Under Pick). It
 * changes as soon as another choice is tapped; nothing shows when nothing is picked (a hand-drawn hem, say).
 * Sections without picture tiles get a little moving drawing of the choice beside the line, which opens
 * full size when tapped. A phone shows one short line instead, with no drawing (Cat's P1, 2026-10-31).
 */
export function Explain({ set, group, options, pick }: { set: ExplainSet; group: string; options: readonly (readonly [unknown, string])[]; pick: unknown }) {
  const [big, setBig] = useState(false);
  const option = options.find(([id]) => id === pick);
  const line = option && explainLine(set, group, String(pick));
  if (!option || !line) return null;
  const [text, skill] = line;
  const pic = detailPic(set, group, String(pick));
  const words = (
    <span>
      <span className="explain-name visually-hidden">{option[1]}:</span> <span className="explain-full">{text}</span>
      <span className="explain-short">{shortLine(set, group, String(pick), text)}</span>
      {skill && <span className={`skill-tag ${skill}`}>{SKILL_WORDS[skill]}</span>}
    </span>
  );
  if (!pic)
    return (
      <p className="explain" aria-live="polite">
        {words}
      </p>
    );
  return (
    <div className="explain with-pic" aria-live="polite">
      <button type="button" className="explain-pic" aria-label="See the drawing full size" onClick={() => setBig(true)}>
        <Drawing pic={pic} />
      </button>
      <p>{words}</p>
      {big && <BigDrawing pic={pic} name={option[1]} line={line} onClose={() => setBig(false)} />}
    </div>
  );
}
