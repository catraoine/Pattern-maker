// Who the sign-in email went to, kept for this tab: a phone often reloads the page while its owner is in the mail app
// fetching the code, and the code box has to still be there when they come back (the Dec 7 rehearsal, Nov 16).
const SENT_KEY = 'pattern-maker:signin-sent';

/** An emailed code stops working after an hour, so the code box isn't brought back for an older email than that. */
const SENT_LASTS_MS = 60 * 60 * 1000;

/** The email a sign-in code was sent to in this tab within the hour, or '' if none. */
export function signinSent(now = Date.now()): string {
  try {
    const kept = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? 'null') as { to?: unknown; at?: unknown } | null;
    return typeof kept?.to === 'string' && typeof kept.at === 'number' && now - kept.at < SENT_LASTS_MS ? kept.to : '';
  } catch {
    return '';
  }
}

/** Remembers who the sign-in email went to; '' forgets it. */
export function keepSigninSent(to: string, now = Date.now()) {
  try {
    if (to) sessionStorage.setItem(SENT_KEY, JSON.stringify({ to, at: now }));
    else sessionStorage.removeItem(SENT_KEY);
  } catch {
    // Storage off: the code box just doesn't outlast a reload.
  }
}
