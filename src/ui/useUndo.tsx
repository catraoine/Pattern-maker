import { useRef, useState } from 'react';

const UNDO_LIMIT = 40;

// Undo and Redo for every style screen that keeps its choices as one object (skirt, bodice, dress,
// trousers, T-shirt, jacket and coat): two buttons that stay in one place, and a short toast.
export function useUndo<T>(choices: T, onChoices: (c: T) => void) {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  const [toast, setToast] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const say = (text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(undefined), 1800);
  };
  /** Every change goes through here, so it can be undone; `before` for one made of several live steps. */
  const change = (next: T, before: T = choices) => {
    if (JSON.stringify(next) !== JSON.stringify(before)) {
      setPast((h) => [...h.slice(-UNDO_LIMIT + 1), before]);
      setFuture([]);
    }
    onChoices(next);
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (prev === undefined) return say('Nothing to undo');
    setPast(past.slice(0, -1));
    setFuture([...future, choices]);
    onChoices(prev);
    say('Undone');
  };
  const redo = () => {
    const next = future[future.length - 1];
    if (next === undefined) return say('Nothing to redo');
    setFuture(future.slice(0, -1));
    setPast([...past, choices]);
    onChoices(next);
    say('Redone');
  };
  return { change, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, toast };
}

/** What the Undo and Redo buttons and toast need, whatever the choices are. */
export type Undo = Omit<ReturnType<typeof useUndo<unknown>>, 'change'>;

/** Undo and Redo in the bar at the bottom of the style screen, beside Review, where the thumb already is; always
 * there so nothing moves, greyed out when there's nothing to do. */
export function UndoTools({ undo }: { undo: Undo }) {
  return (
    <div className="row tools undotools">
      <button type="button" className="ghost" onClick={undo.undo} disabled={!undo.canUndo} aria-label="Undo the last change" title="Undo">
        ↶
      </button>
      <button type="button" className="ghost" onClick={undo.redo} disabled={!undo.canRedo} aria-label="Redo the change you undid" title="Redo">
        ↷
      </button>
    </div>
  );
}

/** Says "Undone", "Redone" or "Nothing to undo" over the preview. */
export function UndoToast({ undo }: { undo: Undo }) {
  return undo.toast ? (
    <p className="toast" role="status">
      {undo.toast}
    </p>
  ) : null;
}
