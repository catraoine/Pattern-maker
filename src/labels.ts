// Signature labels (Cat's picks L1 and L4, 2026-10-18): a label for the finished piece reading "Drafted for
// <name> · Maison Tracé" with a short code. Typing the code into the app opens that saved pattern again.
// Labels never carry measurements.
import { ME, sameChoices, type Account, type SavedPattern } from './account';
import type { PatternChoices } from './garments';

// No 0/O, 1/I/L or U, so a code read off a small woven label can't be mistaken.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A saved pattern's label code, such as MT-7K3Q. It comes from the pattern's own id, so it never changes. */
export function labelCode(patternId: string): string {
  // FNV-1a, then four letters from the alphabet.
  let h = 0x811c9dc5;
  for (let i = 0; i < patternId.length; i++) {
    h ^= patternId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length);
  }
  return `MT-${code}`;
}

/** What someone typed, as a code: any case, with or without the MT, the dash and spaces. */
export function readCode(typed: string): string | undefined {
  const raw = typed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^MT/, '');
  if (raw.length !== 4 || [...raw].some((c) => !ALPHABET.includes(c))) return undefined;
  return `MT-${raw}`;
}

/** The saved pattern a code belongs to, on this device. */
export function findByCode(account: Account, typed: string): SavedPattern | undefined {
  const code = readCode(typed);
  return code ? account.patterns.find((p) => labelCode(p.id) === code) : undefined;
}

/** The saved copy of the pattern on screen, which gives it its code. */
export function savedCopy(account: Account, choices: PatternChoices, personId?: string): SavedPattern | undefined {
  return account.patterns.find((p) => sameChoices(p.choices, choices) && (p.personId ?? ME) === (personId ?? ME));
}

/** The name as it reads on the label, in capitals, kept short enough to weave. */
export const labelName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 18).toUpperCase();
