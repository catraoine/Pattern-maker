import type { ChangeEvent } from 'react';

/** A code box that types in capitals (Cat, Nov 15), keeping the cursor where it was: setting the capitalised value
 *  moved it to the end, so a letter fixed mid-code sent the next one to the end (code review, Nov 15). */
export const typeCaps = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
  const el = e.target;
  const at = el.selectionStart;
  set(el.value.toUpperCase());
  if (at !== null) requestAnimationFrame(() => el.setSelectionRange(at, at));
};
