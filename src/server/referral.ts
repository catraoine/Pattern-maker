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
}

/** Who brought friends, most first, for the read-out. A sign-up with their own code doesn't count. */
export function referrers(news: unknown[]): Referrer[] {
  const entries = news.flatMap((n) => {
    const e = n as { email?: unknown; ref?: unknown } | null;
    return e && typeof e.email === 'string' ? [{ email: e.email, ref: typeof e.ref === 'string' ? e.ref : undefined }] : [];
  });
  const byCode = new Map(entries.map((e) => [refCode(e.email), e.email]));
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.ref || e.ref === refCode(e.email) || !byCode.has(e.ref)) continue;
    counts.set(e.ref, (counts.get(e.ref) ?? 0) + 1);
  }
  return [...counts]
    .map(([code, joined]) => ({ email: byCode.get(code)!, code, joined }))
    .sort((a, b) => b.joined - a.joined || a.email.localeCompare(b.email));
}
