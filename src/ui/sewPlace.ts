// Where you are in Sewing mode, kept per pattern in this browser, so the Sew tab and Sewing mode both open where you left
// off, even after a day away from the machine: the step you were on, the lines you've ticked (Cat's A Tick list, Nov 21)
// and whether you've sewn it all.

const KEY = 'maison-trace-sewing';

interface Place {
  at: number;
  /** Ticked lines, by step. */
  ticks?: Record<number, number[]>;
  /** Done pressed on the last step. */
  done?: boolean;
}

const readAll = (): Record<string, Place> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Place>;
  } catch {
    return {};
  }
};

const read = (keep: string): Place => {
  const p = readAll()[keep] as Place | number | undefined;
  if (typeof p === 'number') return { at: p };
  return p && typeof p === 'object' && typeof p.at === 'number' ? p : { at: 0 };
};

const write = (keep: string, change: Partial<Place>) => {
  try {
    const all = readAll();
    localStorage.setItem(KEY, JSON.stringify({ ...all, [keep]: { ...read(keep), ...change } }));
  } catch {
    // Private browsing: the place just isn't kept.
  }
};

/** Whether a place has been kept at all: step 1 kept by From the start is not the same as never begun. */
export const hasPlace = (keep: string) => keep in readAll();

export const readAt = (keep: string, n: number) => {
  const { at } = read(keep);
  return at >= 0 && at < n ? at : 0;
};

/** Moving to a step: a finished garment you go back into isn't finished any more. */
export const saveAt = (keep: string, at: number) => write(keep, { at, done: false });

export const readTicks = (keep: string): Record<number, number[]> => read(keep).ticks ?? {};
export const saveTicks = (keep: string, ticks: Record<number, number[]>) => write(keep, { ticks });

export const readDone = (keep: string) => !!read(keep).done;
export const saveDone = (keep: string) => write(keep, { done: true });
