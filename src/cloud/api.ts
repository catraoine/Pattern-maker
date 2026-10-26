// The account service behind sign-in: Supabase (Canada region), reached only once someone uses accounts, so a
// guest's visit never downloads its code. Kept behind one small interface so the screens and the click-through
// tests don't depend on it: in development a stand-in on this device takes its place (see fakeCloud).
import type { Backup } from '../account';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './flag';

export interface CloudUser {
  id: string;
  email: string;
}

interface CloudApi {
  /** Who is signed in on this device, if anyone (also finishes a sign-in arriving from an email link). */
  user(): Promise<CloudUser | null>;
  onChange(fn: (u: CloudUser | null) => void): () => void;
  /** Emails a sign-in link with a 6-digit code in it. */
  sendLink(email: string, returnTo: string): Promise<void>;
  /** The 6-digit code from that email, for when the link opens in another browser (or outside the home-screen app). */
  verifyCode(email: string, code: string): Promise<CloudUser>;
  signOut(): Promise<void>;
  /** The work kept in the account, with the stamp of its last save (null when there's none yet). */
  load(u: CloudUser): Promise<Kept | null>;
  /**
   * Writes the account's copy, but only if nobody has saved since the copy stamped `seen` was read (null: nothing
   * was there). Gives the new stamp, or null when another device got there first, so the caller loads and joins again.
   */
  save(u: CloudUser, backup: Backup<unknown>, seen: string | null): Promise<string | null>;
  /** Removes the account and everything kept in it. */
  deleteAccount(): Promise<void>;
}

export interface Kept {
  backup: Backup<unknown>;
  /** When it was last saved, as the service wrote it; compared as text, never parsed. */
  stamp: string;
}

export const cloudConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let api: Promise<CloudApi> | undefined;

/** The account service, made once. */
export function cloud(): Promise<CloudApi> {
  api ??= import.meta.env.DEV && hasFake() ? Promise.resolve(fakeCloud()) : supabaseCloud();
  return api;
}

const asUser = (u: { id: string; email?: string } | null | undefined): CloudUser | null => (u ? { id: u.id, email: u.email ?? '' } : null);

async function supabaseCloud(): Promise<CloudApi> {
  const { createClient } = await import('@supabase/supabase-js');
  // Implicit flow: the link works in whichever browser the email app opens, not only the one that asked for it.
  const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true } });
  return {
    async user() {
      const { data } = await sb.auth.getSession();
      return asUser(data.session?.user);
    },
    onChange(fn) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => fn(asUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async sendLink(email, returnTo) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: returnTo, shouldCreateUser: true } });
      if (error) throw error;
    },
    async verifyCode(email, code) {
      const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error || !data.user) throw error ?? new Error('No user');
      return asUser(data.user)!;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async load(u) {
      const { data, error } = await sb.from('backups').select('data, updated_at').eq('user_id', u.id).maybeSingle();
      if (error) throw error;
      return data ? { backup: data.data as Backup<unknown>, stamp: String(data.updated_at) } : null;
    },
    async save(u, backup, seen) {
      const row = { user_id: u.id, data: backup, updated_at: new Date().toISOString() };
      if (seen === null) {
        // First save: an insert, which fails if another device made the row meanwhile.
        const { data, error } = await sb.from('backups').insert(row).select('updated_at').maybeSingle();
        if (error?.code === '23505') return null;
        if (error) throw error;
        return data ? String(data.updated_at) : null;
      }
      // Later saves change the row only while it still carries the stamp we read: zero rows means someone saved first.
      const { data, error } = await sb.from('backups').update(row).eq('user_id', u.id).eq('updated_at', seen).select('updated_at');
      if (error) throw error;
      return data?.length ? String(data[0].updated_at) : null;
    },
    async deleteAccount() {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/.netlify/functions/delete-account', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await sb.auth.signOut();
    },
  };
}

// --- Development stand-in -------------------------------------------------------------------------------------------
// Turned on with localStorage 'pattern-maker:cloud-fake' (the click-through tests set it). The "server" is another
// localStorage key, shared by every page of this browser, and the emailed code is always 123456.

const FAKE = 'pattern-maker:cloud-fake';
const hasFake = () => {
  try {
    return localStorage.getItem(FAKE) !== null;
  } catch {
    return false;
  }
};

const FAKE_CODE = '123456';

function fakeCloud(): CloudApi {
  type Store = { users: Record<string, { id: string; backup: Backup<unknown> | null; stamp?: string }>; session?: string; sent?: string };
  const read = (): Store => JSON.parse(localStorage.getItem(FAKE) || '{}').users ? JSON.parse(localStorage.getItem(FAKE)!) : { users: {} };
  const write = (s: Store) => localStorage.setItem(FAKE, JSON.stringify(s));
  const listeners = new Set<(u: CloudUser | null) => void>();
  const current = (s = read()): CloudUser | null => (s.session && s.users[s.session] ? { id: s.users[s.session].id, email: s.session } : null);
  const tell = () => listeners.forEach((fn) => fn(current()));
  return {
    async user() {
      return current();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async sendLink(email) {
      const s = read();
      write({ ...s, sent: email.trim().toLowerCase() });
    },
    async verifyCode(email, code) {
      const s = read();
      const e = email.trim().toLowerCase();
      if (code !== FAKE_CODE || s.sent !== e) throw new Error('Wrong code');
      s.users[e] ??= { id: `user-${Object.keys(s.users).length + 1}`, backup: null };
      write({ ...s, session: e });
      tell();
      return current()!;
    },
    async signOut() {
      const s = read();
      delete s.session;
      write(s);
      tell();
    },
    async load(u) {
      const kept = read().users[u.email];
      return kept?.backup ? { backup: kept.backup, stamp: kept.stamp ?? '0' } : null;
    },
    async save(u, backup, seen) {
      const s = read();
      const kept = s.users[u.email];
      if (!kept) return null;
      const now = kept.backup ? (kept.stamp ?? '0') : null;
      if (now !== seen) return null;
      kept.backup = backup;
      kept.stamp = String(Number(kept.stamp ?? '0') + 1);
      write(s);
      return kept.stamp;
    },
    async deleteAccount() {
      const s = read();
      if (s.session) delete s.users[s.session];
      delete s.session;
      write(s);
      tell();
    },
  };
}
