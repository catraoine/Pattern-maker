// Keeps the work on this device and the work in the signed-in account in step. On signing in (or opening the app
// already signed in) the two are joined (see merge.ts and sync.ts) and the result kept on both sides; after that each
// change is saved a moment after it's made, and the account is read again whenever the app comes back to the front,
// so a phone and a computer can both stay signed in. Signing out leaves the work on this device as it is.
import { useEffect, useRef, useState } from 'react';
import type { Backup } from '../account';
import { contentKey } from './merge';
import { syncOnce } from './sync';
import { cloud, cloudConfigured, type CloudUser } from './api';

type CloudStatus = 'off' | 'checking' | 'out' | 'syncing' | 'saved' | 'offline';

const CHANGED = 'pattern-maker:changed-at';
/** What this device and the account last agreed on, for the account it was signed in to. */
const BASE = 'pattern-maker:cloud-base';
const WAIT_MS = 1500;

const changedAt = () => {
  try {
    return localStorage.getItem(CHANGED) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
};

function readBase<S>(userId: string): Backup<S> | null {
  try {
    const raw = localStorage.getItem(BASE);
    const kept = raw ? (JSON.parse(raw) as { user: string; backup: Backup<S> }) : null;
    return kept?.user === userId ? kept.backup : null;
  } catch {
    return null;
  }
}

function writeBase<S>(userId: string, backup: Backup<S> | null) {
  try {
    if (backup) localStorage.setItem(BASE, JSON.stringify({ user: userId, backup }));
    else localStorage.removeItem(BASE);
  } catch {
    // Nothing to remember it in: the next join keeps everything from both sides, as a first sign-in does.
  }
}

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
  const key = contentKey(backup);
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

  // One round at a time: a round asked for while one runs follows it, so the last change is never left unsaved.
  const running = useRef<Promise<void>>();
  const again = useRef(false);
  const sync = (u: CloudUser): Promise<void> => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    setStatus('syncing');
    running.current = (async () => {
      try {
        const api = await cloud();
        const io = { load: () => api.load(u), save: (b: Backup<unknown>, seen: string | null) => api.save(u, b, seen) };
        const local = { ...latest.current, savedAt: changedAt() };
        const { base } = await syncOnce(local, readBase<S>(u.id), io, (b) => {
          // Taking in the joined work isn't a change made on this device.
          firstKey.current = contentKey(b);
          applyRef.current(b);
        });
        writeBase(u.id, base);
        setJoined(u.id);
        setStatus('saved');
      } catch {
        setStatus('offline');
      } finally {
        running.current = undefined;
        if (again.current) {
          again.current = false;
          void sync(u);
        }
      }
    })();
    return running.current;
  };

  // Signed in: join this device's work with the account's.
  useEffect(() => {
    if (!user) {
      setJoined(undefined);
      if (usable && status !== 'checking') setStatus('out');
      return;
    }
    if (joined === user.id) return;
    void sync(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // After that, each change goes up a moment after it's made.
  useEffect(() => {
    if (!user || joined !== user.id) return;
    if (key === firstKey.current) return;
    const t = setTimeout(() => void sync(user), WAIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, joined]);

  // Coming back to the app, or back online: read the account again, in case another device saved meanwhile.
  useEffect(() => {
    if (!user || joined !== user.id) return;
    const on = () => {
      if (document.visibilityState === 'visible') void sync(user);
    };
    document.addEventListener('visibilitychange', on);
    window.addEventListener('online', on);
    window.addEventListener('focus', on);
    return () => {
      document.removeEventListener('visibilitychange', on);
      window.removeEventListener('online', on);
      window.removeEventListener('focus', on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, joined]);

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
      writeBase('', null);
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
