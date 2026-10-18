import { ExplainSet, SKILL_WORDS, explainLine } from '../explain';

/**
 * The line under a Style section that says what its picked choice does (Cat's E2 Line Under Pick). It
 * changes as soon as another choice is tapped; nothing shows when nothing is picked (a hand-drawn hem, say).
 */
export function Explain({ set, group, options, pick }: { set: ExplainSet; group: string; options: readonly (readonly [unknown, string])[]; pick: unknown }) {
  const option = options.find(([id]) => id === pick);
  const line = option && explainLine(set, group, String(pick));
  if (!line) return null;
  const [text, skill] = line;
  return (
    <p className="explain" aria-live="polite">
      <span className="explain-name">{option[1]}:</span> {text}
      {skill && <span className={`skill-tag ${skill}`}>{SKILL_WORDS[skill]}</span>}
    </p>
  );
}
