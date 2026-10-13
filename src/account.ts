// The guest's account, kept on this device until sign-in arrives: their name and saved patterns.
// Patterns are stored as choices (not geometry), so they redraft whenever measurements or the engine change.
import type { Choices } from './App';

export const FREE_SAVED_LIMIT = 3;

export interface SavedPattern {
  id: string;
  name: string;
  choices: Choices;
  savedAt: string; // ISO date
}

export interface Account {
  onboarded: boolean;
  name: string;
  patterns: SavedPattern[];
}

export const NEW_ACCOUNT: Account = { onboarded: false, name: '', patterns: [] };

export const sameChoices = (a: Choices, b: Choices) => a.fit === b.fit && a.silhouette === b.silhouette && a.length === b.length;

export function savePattern(account: Account, choices: Choices, name: string): Account {
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
