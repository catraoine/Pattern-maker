// Referral links (Cat's "apply", Nov 11 2026): everyone who joins the waitlist gets their own link,
// maisontrace.co/?ref=<code>. A friend who joins through it is counted for them, and anyone who brings three gets their
// first year of Premium free (Cat's pick, Nov 12; given when charging starts). The code is a short hash of the email, so it needs no extra store
// and the same person always gets the same link; nothing extra goes to Kit.
import { createHash } from 'node:crypto';

export const REF_PATTERN = /^[a-z0-9]{8}$/;

/** The person's own referral code: 8 letters and digits from a hash of their email. */
export function refCode(email: string): string {
  const hex = createHash('sha256').update(`ref:${email.trim().toLowerCase()}`).digest('hex');
  // Base 36 reads shorter and has no confusing symbols.
  return BigInt(`0x${hex.slice(0, 16)}`).toString(36).padStart(8, '0').slice(-8);
}

interface Referrer {
  email: string;
  code: string;
  /** Friends on the waitlist who joined through their link. */
  joined: number;
  /** Of those, the ones who have since signed in with that email (null when accounts couldn't be read). Only these
   *  count towards the free year (Cat's "apply" pending, Nov 16): a made-up address can never sign in. */
  confirmed: number | null;
}

/** Who brought friends, most confirmed first, for the read-out. A sign-up with their own code doesn't count.
 *  `confirmed` holds the emails with a confirmed account, lower case; null when that couldn't be read. */
export function referrers(news: unknown[], confirmed: Set<string> | null = null): Referrer[] {
  const entries = news.flatMap((n) => {
    const e = n as { email?: unknown; ref?: unknown } | null;
    return e && typeof e.email === 'string' ? [{ email: e.email, ref: typeof e.ref === 'string' ? e.ref : undefined }] : [];
  });
  const byCode = new Map(entries.map((e) => [refCode(e.email), e.email]));
  const counts = new Map<string, { joined: number; confirmed: number }>();
  for (const e of entries) {
    if (!e.ref || e.ref === refCode(e.email) || !byCode.has(e.ref)) continue;
    const c = counts.get(e.ref) ?? { joined: 0, confirmed: 0 };
    c.joined += 1;
    if (confirmed?.has(e.email.trim().toLowerCase())) c.confirmed += 1;
    counts.set(e.ref, c);
  }
  return [...counts]
    .map(([code, c]) => ({ email: byCode.get(code)!, code, joined: c.joined, confirmed: confirmed ? c.confirmed : null }))
    .sort((a, b) => (b.confirmed ?? 0) - (a.confirmed ?? 0) || b.joined - a.joined || a.email.localeCompare(b.email));
}

type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** Every email with a confirmed account (sign-in proves the person owns the inbox), lower case, or null when the account
 *  service isn't set up or can't be read. Read from Supabase rather than Kit: Kit's API needs a paid plan, and the free
 *  year is only given when charging starts, after accounts open, so a friend who signed in is the one that counts. */
export async function confirmedAccounts(url: string | undefined, serviceKey: string | undefined, fetcher: Fetch = fetch, maxPages = 50): Promise<Set<string> | null> {
  if (!url || !serviceKey) return null;
  const out = new Set<string>();
  try {
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetcher(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!res.ok) return null;
      const body = (await res.json()) as { users?: { email?: unknown; email_confirmed_at?: unknown }[] };
      const users = body.users ?? [];
      for (const u of users) if (typeof u.email === 'string' && u.email_confirmed_at) out.add(u.email.trim().toLowerCase());
      if (users.length < 1000) return out;
    }
    return out;
  } catch {
    return null;
  }
}
