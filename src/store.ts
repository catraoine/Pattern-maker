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

export function usePersistent<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`pattern-maker:${key}`);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
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
