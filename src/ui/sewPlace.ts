// The step you were on in Sewing mode, kept per pattern in this browser, so the Sew tab and Sewing mode both open where
// you left off, even after a day away from the machine.

const KEY = 'maison-trace-sewing';

export const readAt = (keep: string, n: number) => {
  try {
    const at = (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>)[keep];
    return typeof at === 'number' && at >= 0 && at < n ? at : 0;
  } catch {
    return 0;
  }
};

export const saveAt = (keep: string, at: number) => {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
    localStorage.setItem(KEY, JSON.stringify({ ...all, [keep]: at }));
  } catch {
    // Private browsing: the place just isn't kept.
  }
};
