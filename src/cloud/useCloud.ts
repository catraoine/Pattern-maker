// Keeps the work on this device and the work in the signed-in account in step. On signing in (or opening the app
// already signed in) the two are joined (see merge.ts) and the result kept on both sides; after that each change is
// saved to the account a moment after it's made. Signing out leaves the work on this device as it is.
import { useEffect, useRef, useState } from 'react';
import type { Backup } from '../account';
import { mergeBackups } from './merge';
import { cloud, cloudConfigured, type CloudUser } from './api';

export type CloudStatus = 'off' | 'checking' | 'out' | 'syncing' | 'saved' | 'offline';

const CHANGED = 'pattern-maker:changed-at';
const WAIT_MS = 1500;

const changedAt = () => {
  try {
    return localStorage.getItem(CHANGED) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
};

/**
 * `backup` is everything on this device now; `apply` replaces it. `enabled` is false until sign-in is shown, so a
 * guest's visit never loads the account code.
 */
export function useCloud<S>(backup: Backup<S>, apply: (b: Backup<S>) => void, enabled: boolean) {
  const usable = enabled && (cloudConfigured || (import.meta.env.DEV && hasFakeCloud()));
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<CloudStatus>(usable ? 'checking' : 'off');
  // The account whose work has been joined with this device's; saving waits for it, so nothing is overwritten.
  const [joined, setJoined] = useState<string>();
  const latest = useRef(backup);
  latest.current = backup;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // What changed, without the time stamp makeBackup puts on every copy.
  const key = JSON.stringify([backup.skirt, backup.account, backup.pointEdits]);
  const firstKey = useRef(key);
  useEffect(() => {
    if (key === firstKey.current) return;
    try {
      localStorage.setItem(CHANGED, new Date().toISOString());
    } catch {
      // Nothing to remember it in; the account copy still wins only when it's newer.
    }
  }, [key]);

  useEffect(() => {
    if (!usable) return;
    let gone = false;
    let off = () => {};
    cloud().then(async (api) => {
      if (gone) return;
      off = api.onChange((u) => setUser(u));
      const u = await api.user().catch(() => null);
      if (gone) return;
      setUser(u);
      if (!u) setStatus('out');
    });
    return () => {
      gone = true;
      off();
    };
  }, [usable]);

  // Signed in: join this device's work with the account's.
  useEffect(() => {
    if (!user) {
      setJoined(undefined);
      if (usable && status !== 'checking') setStatus('out');
      return;
    }
    if (joined === user.id) return;
    let gone = false;
    setStatus('syncing');
    (async () => {
      const api = await cloud();
      try {
        const remote = (await api.load(user)) as Backup<S> | null;
        if (gone) return;
        const local = { ...latest.current, savedAt: changedAt() };
        const merged = mergeBackups(local, remote);
        // Taking in the joined work isn't a change made on this device.
        firstKey.current = JSON.stringify([merged.skirt, merged.account, merged.pointEdits]);
        applyRef.current(merged);
        await api.save(user, { ...merged, savedAt: new Date().toISOString() });
        if (gone) return;
        setJoined(user.id);
        setStatus('saved');
      } catch {
        if (!gone) setStatus('offline');
      }
    })();
    return () => {
      gone = true;
    };
  }, [user?.id]);

  // After that, each change goes up a moment after it's made.
  useEffect(() => {
    if (!user || joined !== user.id) return;
    setStatus('syncing');
    const t = setTimeout(async () => {
      try {
        await (await cloud()).save(user, { ...latest.current, savedAt: new Date().toISOString() });
        setStatus('saved');
      } catch {
        setStatus('offline');
      }
    }, WAIT_MS);
    return () => clearTimeout(t);
  }, [key, joined]);

  return {
    usable,
    user,
    status,
    sendLink: async (email: string) => (await cloud()).sendLink(email, window.location.origin + window.location.pathname),
    verifyCode: async (email: string, code: string) => setUser(await (await cloud()).verifyCode(email, code)),
    signOut: async () => {
      await (await cloud()).signOut();
      setUser(null);
    },
    deleteAccount: async () => {
      await (await cloud()).deleteAccount();
      setUser(null);
    },
  };
}

export type Cloud = ReturnType<typeof useCloud>;

function hasFakeCloud() {
  try {
    return localStorage.getItem('pattern-maker:cloud-fake') !== null;
  } catch {
    return false;
  }
}
