import { useRef, useState } from 'react';
import { useShake } from './shake';

const UNDO_LIMIT = 40;

// Undo for the style screens that keep their choices as one object (dress, trousers, T-shirt, jacket and
// coat), the same as the skirt and bodice: an Undo button, shake to undo on phones, and a short toast.
export function useUndo<T>(choices: T, onChoices: (c: T) => void) {
  const [history, setHistory] = useState<T[]>([]);
  const [toast, setToast] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const say = (text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(undefined), 1800);
  };
  /** Every change goes through here, so it can be undone; `before` for one made of several live steps. */
  const change = (next: T, before: T = choices) => {
    if (JSON.stringify(next) !== JSON.stringify(before)) setHistory((h) => [...h.slice(-UNDO_LIMIT + 1), before]);
    onChoices(next);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (prev === undefined) return say('Nothing to undo');
    setHistory(history.slice(0, -1));
    onChoices(prev);
    say('Undone');
  };
  const shake = useShake(undo);
  return { change, undo, canUndo: history.length > 0, shake, toast };
}

/** What the Undo button and toast need, whatever the choices are. */
export type Undo = Omit<ReturnType<typeof useUndo<unknown>>, 'change'>;

/** "Shake to undo" (iPhones ask first) and the Undo button, beside the preview tabs. */
export function UndoTools({ undo }: { undo: Undo }) {
  return (
    <div className="row tools">
      {undo.shake.state === 'ask' && (
        <button type="button" className="link small" onClick={undo.shake.enable}>
          Shake to undo
        </button>
      )}
      {undo.canUndo && (
        <button type="button" className="ghost" onClick={undo.undo} aria-label="Undo the last change">
          Undo
        </button>
      )}
    </div>
  );
}

/** Says "Undone" or "Nothing to undo" over the preview. */
export function UndoToast({ undo }: { undo: Undo }) {
  return undo.toast ? (
    <p className="toast" role="status">
      {undo.toast}
    </p>
  ) : null;
}
