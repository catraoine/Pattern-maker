// The guest's account, kept on this device until sign-in arrives: their name, the people they measure and saved patterns.
// Patterns are stored as choices (not geometry), so they redraft whenever measurements or the engine change.
import { PatternChoices, isBodice } from './garments';
import type { MeasurementValues } from './measurements';

export const FREE_SAVED_LIMIT = 3;

export interface SavedPattern {
  id: string;
  name: string;
  choices: PatternChoices;
  savedAt: string; // ISO date
  /** Whose measurements it was saved with; opening it switches to them. Older saves have none and stay with whoever is active. */
  personId?: string;
}

/** One body's measurements. The account owner is always the person with id ME; their name is the account name. */
export interface Person {
  id: string;
  name: string;
  values: MeasurementValues;
  /** Set once we've asked whose measurements these are, so the question comes up only once per person. */
  named: boolean;
}

export const ME = 'me';

export interface Account {
  onboarded: boolean;
  name: string;
  patterns: SavedPattern[];
  /** Missing on accounts from before there could be more than one person; see withPeople. */
  people?: Person[];
  active?: string;
}

export const NEW_ACCOUNT: Account = { onboarded: false, name: '', patterns: [] };

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));

/** Accounts from before people existed kept one set of measurements elsewhere; fold them in as the owner's. */
export function withPeople(account: Account, legacyValues: MeasurementValues = {}): Account & { people: Person[]; active: string } {
  const people = account.people?.length ? account.people : [{ id: ME, name: '', values: legacyValues, named: account.name.trim() !== '' }];
  const active = people.some((p) => p.id === account.active) ? account.active! : people[0].id;
  return { ...account, people, active };
}

export const personName = (account: Account, p: Person) => (p.id === ME ? account.name.trim() || 'Me' : p.name.trim() || 'Someone else');

export function activePerson(account: Account): Person {
  const a = withPeople(account);
  return a.people.find((p) => p.id === a.active)!;
}

export function updatePerson(account: Account, id: string, change: Partial<Person>): Account {
  const a = withPeople(account);
  return { ...a, people: a.people.map((p) => (p.id === id ? { ...p, ...change } : p)) };
}

export function addPerson(account: Account, name: string, values: MeasurementValues = {}): Account {
  const a = withPeople(account);
  const id = newId();
  return { ...a, people: [...a.people, { id, name: name.trim(), values, named: true }], active: id };
}

export function removePerson(account: Account, id: string): Account {
  if (id === ME) return account;
  const a = withPeople(account);
  return { ...a, people: a.people.filter((p) => p.id !== id), active: a.active === id ? ME : a.active };
}

/**
 * Answer "whose measurements are these?" for the owner's unnamed measurements, asked once after measuring.
 * Mine: they stay the owner's. Someone else: they move to a new person with that name, and the owner starts empty.
 */
export function claimMeasurements(account: Account, whose: 'mine' | 'other', name: string): Account {
  const a = updatePerson(account, ME, { named: true });
  if (whose === 'mine') return { ...a, name: name.trim() || a.name };
  const mine = withPeople(a).people.find((p) => p.id === ME)!;
  return addPerson(updatePerson(a, ME, { values: {} }), name, mine.values);
}

export function sameChoices(a: PatternChoices, b: PatternChoices): boolean {
  if (isBodice(a) || isBodice(b)) {
    return isBodice(a) && isBodice(b) && a.fit === b.fit && a.neckline === b.neckline && a.length === b.length && a.darts === b.darts;
  }
  return (
    a.fit === b.fit &&
    a.silhouette === b.silhouette &&
    a.length === b.length &&
    (a.look ?? '') === (b.look ?? '') &&
    JSON.stringify(a.shape ?? null) === JSON.stringify(b.shape ?? null) &&
    a.lengthCm === b.lengthCm &&
    a.flareCm === b.flareCm &&
    JSON.stringify(a.hem ?? null) === JSON.stringify(b.hem ?? null)
  );
}

/** Whether this exact pattern is already saved for this person. */
export const isSavedFor = (account: Account, choices: PatternChoices, personId?: string) =>
  account.patterns.some((p) => sameChoices(p.choices, choices) && (p.personId ?? ME) === (personId ?? ME));

export function savePattern(account: Account, choices: PatternChoices, name: string, personId?: string): Account {
  if (account.patterns.length >= FREE_SAVED_LIMIT || isSavedFor(account, choices, personId)) return account;
  return { ...account, patterns: [{ id: newId(), name, choices, savedAt: new Date().toISOString(), personId }, ...account.patterns] };
}

export function removePattern(account: Account, id: string): Account {
  return { ...account, patterns: account.patterns.filter((p) => p.id !== id) };
}

export function renamePattern(account: Account, id: string, name: string): Account {
  return { ...account, patterns: account.patterns.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/** The name of whoever's measurements are in use, shown on screens and printed on the pattern. */
export const profileName = (account: Account) => personName(account, activePerson(account));

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

/** Read a backup file's text; returns null when it isn't a Maison Tracé backup. */
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
