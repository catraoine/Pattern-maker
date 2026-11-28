import { useState } from 'react';
import type { FitIssue, FitTarget, Fitting } from '../engine/fitting';
import { MAX_FIT_WORDS, tickMatches, type FitMatch, type FitReading, type FitWordsResponse } from '../fitWords';
import type { PhotoError } from '../photo/types';
import { testerHeaders } from './TesterCode';
import { TestingTag } from './TestingTag';

const FIT_WORDS_ERROR: Partial<Record<PhotoError, string>> = {
  limit_reached: "You've used today's descriptions. Tick what you see in the list below for now, or try again tomorrow.",
  busy: 'Lots of people are describing their toiles today. Tick what you see in the list below for now, or try again tomorrow.',
  declined: "We couldn't read that as a fitting. Try saying where on your body you see it, and what the toile does there.",
  not_configured: "Describing your toile isn't working just now. Tick what you see in the list below.",
};

/** "and" between the last two, commas before. */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

interface Props {
  garment: FitTarget;
  hasBustDart: boolean;
  /** The problems the page lists for this garment, so a match shows with the same words. */
  issues: FitIssue[];
  f: Fitting;
  onChange: (f: Fitting) => void;
  testerCode?: string;
}

/**
 * At the top of the fitting page: the person says what they see on their toile in their own words, and the reader
 * finds the matching problems on the list. They untick any that aren't right and confirm, and only then are the
 * problems ticked in the list, at their usual starting amounts, for the person to set (Cat, Nov 28). Nothing changes
 * the pattern until they save.
 */
export function DescribeFit({ garment, hasBustDart, issues, f, onChange, testerCode }: Props) {
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<PhotoError>();
  const [reading, setReading] = useState<FitReading>();
  const [keep, setKeep] = useState<string[]>([]);
  const [ticked, setTicked] = useState(0);

  const ask = async () => {
    setAsking(true);
    setError(undefined);
    setReading(undefined);
    setTicked(0);
    try {
      const res = await fetch('/.netlify/functions/describe-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...testerHeaders(testerCode) },
        body: JSON.stringify({ text: text.trim(), garment, bustDart: hasBustDart }),
      });
      const data = (await res.json()) as FitWordsResponse;
      if (data.ok) {
        setReading(data.reading);
        setKeep(data.reading.matches.map((m) => m.id));
      } else setError(data.error);
    } catch {
      setError('failed');
    } finally {
      setAsking(false);
    }
  };

  const found = (reading?.matches ?? []).map((m) => ({ m, issue: issues.find((i) => i.id === m.id) })).filter((x): x is { m: FitMatch; issue: FitIssue } => !!x.issue);
  const confirm = () => {
    const picked = found.filter((x) => keep.includes(x.m.id)).map((x) => x.m);
    onChange(tickMatches(f, picked));
    setTicked(picked.length);
    setReading(undefined);
  };

  return (
    <div className="describe-fit">
      <div className="field plain ready">
        <label htmlFor="fitwords">
          Describe it in your own words <TestingTag tool="describe_fit" />
        </label>
        <textarea
          id="fitwords"
          rows={3}
          maxLength={MAX_FIT_WORDS}
          value={text}
          onChange={(e) => {
            // New words: what was found for the old ones goes, so nothing is ticked from words no longer there.
            setText(e.target.value);
            setTicked(0);
            setReading(undefined);
          }}
        />
      </div>
      <p className="muted small">
        Say where you see it and what the toile does there, such as folds under the back waist or a neckline that stands away. We use AI
        to find the matching problems below, then you check them and set how much.
      </p>
      {error && (
        <p className="msg small" role="alert">
          {FIT_WORDS_ERROR[error] ?? "We couldn't read that just now. Try again, or tick what you see in the list below."}
        </p>
      )}
      {!reading && (
        <button type="button" className="secondary" disabled={!text.trim() || asking} onClick={ask}>
          {asking ? 'Reading your words…' : 'Find the problems'}
        </button>
      )}
      {ticked > 0 && (
        <p className="small" role="status">
          {ticked === 1 ? 'Ticked in the list below.' : `${ticked} problems ticked in the list below.`} Set how much for each, then save.
        </p>
      )}
      {reading && (
        <div className="describe-fit-found">
          {found.length ? (
            <>
              <p className="small" role="status">This sounds like {found.length === 1 ? 'this problem' : 'these problems'}. Untick any that aren't right.</p>
              {found.map(({ m, issue }) => (
                <label key={m.id} className="check">
                  <input type="checkbox" checked={keep.includes(m.id)} onChange={() => setKeep((k) => (k.includes(m.id) ? k.filter((x) => x !== m.id) : [...k, m.id]))} />
                  <span>
                    <strong>{issue.title}</strong>
                    <span className="muted small"> {issue.detail}</span>
                    {m.side && <span className="muted small"> On your {m.side}.</span>}
                  </span>
                </label>
              ))}
            </>
          ) : (
            <p className="small" role="status">
              Nothing on the list quite matches that yet. Have a look through the problems below, each with how to spot it, or add a little
              more, such as where on your body it is and which way the folds run.
            </p>
          )}
          {reading.notCovered.length > 0 && (
            <p className="muted small">The app can't correct {andList(reading.notCovered)} yet, so those need adjusting by hand for now.</p>
          )}
          <div className="row wrap">
            {found.length > 0 && (
              <button type="button" className="secondary" disabled={!keep.length} onClick={confirm}>
                {keep.length === 1 ? 'Tick this one' : 'Tick these'}
              </button>
            )}
            <button type="button" className="link" onClick={() => setReading(undefined)}>
              {found.length ? 'Not these' : 'Try again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
