import { useEffect, useState } from 'react';
import { sendNote, shrinkShot } from '../help/note';
import { OWNER } from '../legal';

interface Props {
  /** The screen they came from, sent with the note so they don't have to say where they were. */
  from: string;
  onDone: () => void;
}

/** Short answers to what testers trip on first (the handbook's testers page lists them). */
const ANSWERS: [string, string][] = [
  ['My printed pattern is the wrong size', 'Measure the 10 cm test square on page A1. If it isn’t 10 cm, print again at 100% or “Actual size”, never “Fit to page”.'],
  ['Letter or A4?', 'Pick the paper on Print: Letter in North America, A4 almost everywhere else. A large pattern prints best as one A0 sheet at a copy shop.'],
  ['Getting my pattern to a computer', 'In Your account, open Your data and tap Send to another device. Open the link on the computer and everything is there.'],
  ['A measurement looks wrong', 'Tap Measure, change it, and every pattern redrafts to the new number.'],
  ['Where is my work kept?', 'On this phone or computer. Download a backup from Your data to keep a copy.'],
];

/**
 * Help & feedback (Cat's H3, Nov 6, 2026): opened from the small links at the foot of Your account. The answers first,
 * then a note to us for anything else. Kept plain, not a praise grab (Cat, Nov 5).
 */
export function HelpScreen({ from, onDone }: Props) {
  const [writing, setWriting] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [writing]);
  if (writing) return <NotePage from={from} onClose={() => setWriting(false)} onDone={onDone} />;
  return (
    <article className="card legal help" aria-labelledby="helptitle">
      <h1 id="helptitle">Help &amp; feedback</h1>
      <div className="help-answers">
        {ANSWERS.map(([q, a], i) => (
          <details key={q} open={i === 0}>
            <summary>{q}</summary>
            <p className="muted small">{a}</p>
          </details>
        ))}
      </div>
      <div className="help-note">
        <p className="small">Didn’t find it here?</p>
        <p className="muted small">Every note is read.</p>
        <button type="button" className="secondary sm" onClick={() => setWriting(true)}>
          Send us a note
        </button>
      </div>
    </article>
  );
}

function NotePage({ from, onClose, onDone }: { from: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [shot, setShot] = useState<string>();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'limit' | 'busy' | 'failed' | 'badshot'>('idle');

  if (state === 'sent')
    return (
      <article className="card legal help" aria-labelledby="notetitle">
        <p className="eyebrow">Feedback</p>
        <h1 id="notetitle">Thank you</h1>
        <p>Your note is in. Every note is read.</p>
        <button type="button" className="secondary" onClick={onDone}>
          Done
        </button>
      </article>
    );

  return (
    <article className="card legal help" aria-labelledby="notetitle">
      <div className="help-top">
        <p className="eyebrow">Feedback</p>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <h1 id="notetitle">Send us a note</h1>
      <p className="muted">Something confusing or broken? Every note is read. We add which screen you came from and what phone or computer you use, so you don’t have to.</p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!note.trim() || state === 'sending') return;
          setState('sending');
          setState(await sendNote(note, from, shot));
        }}
      >
        <div className="field plain">
          <label htmlFor="helpnote">What happened, or what would make it better?</label>
          <textarea id="helpnote" rows={6} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {shot ? (
          <div className="row help-shot">
            <img src={shot} alt="Your screenshot" />
            <span className="small">Screenshot added</span>
            <button type="button" className="link" onClick={() => setShot(undefined)}>
              Remove
            </button>
          </div>
        ) : (
          <label className="secondary sm filebtn">
            Add a screenshot
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const small = await shrinkShot(file);
                setState(small ? 'idle' : 'badshot');
                setShot(small ?? undefined);
              }}
            />
          </label>
        )}
        <p className="help-added">
          Added for you: the screen you came from, your browser and the app version.
        </p>
        <button type="submit" className="primary" disabled={!note.trim() || state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        {state === 'failed' && (
          <p className="msg small" role="status">
            That didn’t go through. Check you’re online and try again.
          </p>
        )}
        {state === 'limit' && (
          <p className="msg small" role="status">
            That’s the most notes we can take from you today. Please send more tomorrow, or email {OWNER.email}.
          </p>
        )}
        {state === 'busy' && (
          <p className="msg small" role="status">
            We’ve had a lot of notes today. Please try again tomorrow, or email {OWNER.email}.
          </p>
        )}
        {state === 'badshot' && (
          <p className="msg small" role="status">
            That picture couldn’t be read. Try a screenshot from your photos.
          </p>
        )}
      </form>
    </article>
  );
}
