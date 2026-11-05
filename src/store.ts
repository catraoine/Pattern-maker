// Saves the guest's work in this browser so nothing is lost between visits.
import { useEffect, useState } from 'react';

let asked = false;

/**
 * Ask the browser to keep this site's data rather than clear it when space runs low or the site goes unvisited
 * for a while (Safari clears it after 7 days otherwise). Asked once a visit, the first time something is saved;
 * most browsers decide quietly, and the app works the same whatever they say.
 */
function keepData() {
  if (asked) return;
  asked = true;
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return;
    storage
      .persisted()
      .then((kept) => (kept ? true : storage.persist()))
      .catch(() => undefined);
  } catch {
    // No storage manager: nothing to ask.
  }
}

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Work saved by an older version of the app, with every setting it doesn't have yet filled in from `initial`, at
 * every depth: a dress saved before a new bodice choice existed comes back with that choice at its default, rather
 * than blank. What was saved always wins; lists and plain values are taken as saved.
 */
export function fillMissing<T>(initial: T, saved: unknown): T {
  if (saved === undefined || saved === null) return initial;
  if (!isPlain(initial) || !isPlain(saved)) return saved as T;
  const out: Record<string, unknown> = { ...saved };
  for (const [k, v] of Object.entries(initial)) out[k] = k in saved ? (isPlain(v) && isPlain(saved[k]) ? fillMissing(v, saved[k]) : saved[k]) : v;
  return out as T;
}

export function usePersistent<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`pattern-maker:${key}`);
      return raw ? fillMissing(initial, JSON.parse(raw)) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`pattern-maker:${key}`, JSON.stringify(value));
    } catch {
      // Private browsing or storage full: the app still works, it just won't remember.
    }
  }, [key, value]);
  const set = (v: T) => {
    keepData();
    setValue(v);
  };
  return [value, set];
}
