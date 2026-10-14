// The guest's account, kept on this device until sign-in arrives: their name and saved patterns.
// Patterns are stored as choices (not geometry), so they redraft whenever measurements or the engine change.
import { PatternChoices, isBodice } from './garments';

export const FREE_SAVED_LIMIT = 3;

export interface SavedPattern {
  id: string;
  name: string;
  choices: PatternChoices;
  savedAt: string; // ISO date
}

export interface Account {
  onboarded: boolean;
  name: string;
  patterns: SavedPattern[];
}

export const NEW_ACCOUNT: Account = { onboarded: false, name: '', patterns: [] };

export function sameChoices(a: PatternChoices, b: PatternChoices): boolean {
  if (isBodice(a) || isBodice(b)) {
    return isBodice(a) && isBodice(b) && a.fit === b.fit && a.neckline === b.neckline && a.length === b.length && a.darts === b.darts;
  }
  return (
    a.fit === b.fit && a.silhouette === b.silhouette && a.length === b.length && (a.look ?? '') === (b.look ?? '') &&
    JSON.stringify(a.shape ?? null) === JSON.stringify(b.shape ?? null)
  );
}

export function savePattern(account: Account, choices: PatternChoices, name: string): Account {
  if (account.patterns.length >= FREE_SAVED_LIMIT || account.patterns.some((p) => sameChoices(p.choices, choices))) return account;
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
  return { ...account, patterns: [{ id, name, choices, savedAt: new Date().toISOString() }, ...account.patterns] };
}

export function removePattern(account: Account, id: string): Account {
  return { ...account, patterns: account.patterns.filter((p) => p.id !== id) };
}

export function renamePattern(account: Account, id: string, name: string): Account {
  return { ...account, patterns: account.patterns.map((p) => (p.id === id ? { ...p, name } : p)) };
}

export const profileName = (account: Account) => account.name.trim() || 'Me';

/** A backup file holds everything the app keeps on this device, so it can move to a new phone or survive a cleared browser. */
export interface Backup<S> {
  app: 'pattern-maker';
  version: 1;
  savedAt: string;
  skirt: S;
  account: Account;
}

export function makeBackup<S>(skirt: S, account: Account): Backup<S> {
  return { app: 'pattern-maker', version: 1, savedAt: new Date().toISOString(), skirt, account };
}

/** Read a backup file's text; returns null when it isn't a Pattern Maker backup. */
export function readBackup<S extends object>(text: string): Backup<S> | null {
  try {
    const b = JSON.parse(text);
    const ok =
      b?.app === 'pattern-maker' &&
      b.version === 1 &&
      typeof b.skirt === 'object' &&
      b.skirt !== null &&
      typeof b.account?.name === 'string' &&
      Array.isArray(b.account?.patterns);
    return ok ? b : null;
  } catch {
    return null;
  }
}
