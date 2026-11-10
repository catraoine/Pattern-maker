// Keeps the work on this device and the work in the signed-in account in step. On signing in (or opening the app
// already signed in) the two are joined (see merge.ts and sync.ts) and the result kept on both sides; after that each
// change is saved a moment after it's made, and the account is read again whenever the app comes back to the front,
// so a phone and a computer can both stay signed in. Signing out leaves the work on this device as it is.
//
// The engineering review (Nov 10) found three edges, each handled here: a device cleared with "Delete everything" (or
// filled from a backup or a move link) forgets what it last agreed with the account, so the next join removes nothing;
// a device that was last signed in to someone else's account asks before its work goes into this one (Cat's pick (a));
// and work typed while a sync was reading the account is joined in again, never replaced.
import { useEffect, useRef, useState } from 'react';
import type { Backup } from '../account';
import { reportCrash } from '../report/report';
import { contentKey, isEmpty, mergeBackups, type JoinOptions } from './merge';
import { syncOnce } from './sync';
import { cloud, cloudConfigured, type CloudUser } from './api';

/** 'ask': waiting for the person signing in to say what to do with another account's work on this device.
 *  'offline': the account couldn't be reached. 'fault': it answered with an error, which was reported to us. */
type CloudStatus = 'off' | 'checking' | 'out' | 'ask' | 'syncing' | 'saved' | 'offline' | 'fault';

/** What to do with work left on this device by another account: add it to this one, or start from this account only. */
export type DeviceAnswer = 'add' | 'account';

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

/** The account this device was last in step with, if any: the last account signed in here that saved or loaded. */
function lastAccount(): string | undefined {
  try {
    const raw = localStorage.getItem(BASE);
    return raw ? ((JSON.parse(raw) as { user?: string }).user ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

/** A failed sync that is only the connection: the browser says it's offline, or the request never got an answer. */
export function isOffline(e: unknown, online = typeof navigator === 'undefined' ? true : navigator.onLine): boolean {
  if (!online) return true;
  if (e instanceof TypeError) return true; // fetch's "Failed to fetch" / "Load failed" / "NetworkError"
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  return /failed to fetch|load failed|network ?error|network request failed|timed? ?out|being saved from another device/i.test(m);
}

/** A sync fault as reported to us: what failed, with any email address taken out (the report never carries one). */
export function syncFault(e: unknown): Error {
  const o = (typeof e === 'object' && e ? e : {}) as { message?: unknown; code?: unknown; status?: unknown; name?: unknown };
  const parts = [o.name, o.code, o.status, o.message ?? (typeof e === 'string' ? e : undefined)].filter((x) => x !== undefined && x !== '').map(String);
  const err = new Error(`Account sync: ${parts.join(' ').replace(/\S+@\S+/g, '[email]') || 'unknown error'}`);
  err.stack = undefined;
  return err;
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
export function useCloud<S>(backup: Backup<S>, apply: (b: Backup<S>) => void, enabled: boolean, blank: () => Backup<S>) {
  const usable = enabled && (cloudConfigured || (import.meta.env.DEV && hasFakeCloud()));
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<CloudStatus>(usable ? 'checking' : 'off');
  // The account whose work has been joined with this device's; saving waits for it, so nothing is overwritten.
  const [joined, setJoined] = useState<string>();
  // Whether to offer "Continue with Google": only once the account service says it's switched on.
  const [googleOn, setGoogleOn] = useState(false);
  const latest = useRef(backup);
  latest.current = backup;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const blankRef = useRef(blank);
  blankRef.current = blank;

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
      void api.googleOn().then((on) => !gone && setGoogleOn(on));
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
  const sync = (u: CloudUser, answer?: DeviceAnswer): Promise<void> => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    setStatus('syncing');
    running.current = (async () => {
      try {
        const api = await cloud();
        const io = { load: () => api.load(u), save: (b: Backup<unknown>, seen: string | null) => api.save(u, b, seen) };
        // "Start from my account only": this device's work is cleared first, and the account's taken as it is.
        if (answer === 'account') {
          const fresh = blankRef.current();
          firstKey.current = contentKey(fresh);
          applyRef.current(fresh);
        }
        const local = answer === 'account' ? { ...blankRef.current(), savedAt: new Date(0).toISOString() } : { ...latest.current, savedAt: changedAt() };
        const opts: JoinOptions = answer === 'add' ? { fromAnotherAccount: true } : {};
        const { base } = await syncOnce(
          local,
          readBase<S>(u.id),
          io,
          (b) => {
            // Taking in the joined work isn't a change made on this device. Anything typed while the account was being
            // read is joined in again (against what this round started from), never replaced; the next round saves it.
            firstKey.current = contentKey(b);
            const now = { ...latest.current, savedAt: changedAt() };
            if (answer !== 'account' && contentKey(now) !== contentKey(local)) {
              applyRef.current(mergeBackups(now, b, local));
              again.current = true;
            } else applyRef.current(b);
          },
          opts,
        );
        writeBase(u.id, base);
        setJoined(u.id);
        setStatus('saved');
      } catch (e) {
        // Being offline is expected and says so. Anything else (a refused save, a sign-in that ran out, the account
        // service paused) would otherwise stop the work reaching the account without anyone knowing: report it.
        if (isOffline(e)) setStatus('offline');
        else {
          reportCrash(syncFault(e), 'sync');
          setStatus('fault');
        }
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

  // Signed in: join this device's work with the account's. On a device last in step with another account, with work
  // still on it, ask first (Cat, Nov 10: on a shared computer, one person's work went into the next person's account).
  useEffect(() => {
    if (!user) {
      setJoined(undefined);
      if (usable && status !== 'checking') setStatus('out');
      return;
    }
    if (joined === user.id) return;
    const before = lastAccount();
    if (before && before !== user.id && !isEmpty(latest.current.account)) {
      setStatus('ask');
      return;
    }
    void sync(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per signed-in person: joining runs when the account changes, not on every status change
  }, [user?.id]);

  // After that, each change goes up a moment after it's made.
  useEffect(() => {
    if (!user || joined !== user.id) return;
    if (key === firstKey.current) return;
    const t = setTimeout(() => void sync(user), WAIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each saved change and the first join start a sync; user is read fresh inside it
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listeners set up once per signed-in person and joined account
  }, [user?.id, joined]);

  return {
    usable,
    user,
    status,
    sendLink: async (email: string) => (await cloud()).sendLink(email, window.location.origin + window.location.pathname),
    verifyCode: async (email: string, code: string) => setUser(await (await cloud()).verifyCode(email, code)),
    googleOn,
    google: async () => {
      const api = await cloud();
      await api.google(window.location.origin + window.location.pathname);
      // The stand-in signs in on the spot; the real service has already left for Google's page.
      setUser(await api.user());
    },
    /** The answer to "add what's on this device to your account, or start from your account only?". */
    answerDevice: (answer: DeviceAnswer) => {
      if (user && status === 'ask') void sync(user, answer);
    },
    /** This device's work was replaced (cleared, or filled from a backup or a move link): the next join removes nothing. */
    forget: () => writeBase('', null),
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
