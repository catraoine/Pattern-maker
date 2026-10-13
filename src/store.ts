// Saves the guest's work in this browser so nothing is lost between visits.
import { useEffect, useState } from 'react';

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
  return [value, setValue];
}
