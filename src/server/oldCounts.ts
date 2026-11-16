// Server side only: clears yesterday's and older daily counters. Each cap counts by a scrambled code made from the
// visitor's IP address, and the privacy policy says those are kept for one day; nothing cleared them, so they sat
// there for weeks (the Dec 7 rehearsal, Nov 16). The day's own counters, and yesterday's, are left: a day here is a UTC
// day, so yesterday's is still inside "one day" for someone who visited late.

/** Every store that keeps daily counters (the names the functions pass to blobCounts). */
export const COUNT_STORES = ['photo-limits', 'check-limits', 'describe-limits', 'tester-check-limits', 'founding-limits', 'email-limits', 'note-limits', 'fit-feedback-limits', 'body-scan-code-limits', 'body-scan-limits', 'signup-limits'] as const;

const DAY_KEY = /^(\d{4}-\d{2}-\d{2})\//;

/** The keys to delete: daily counters from before yesterday. A key that isn't a daily counter is never touched. */
export function oldCountKeys(keys: string[], now = new Date()): string[] {
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  return keys.filter((k) => {
    const day = DAY_KEY.exec(k)?.[1];
    return !!day && day < yesterday;
  });
}
