// Waitlist and news sign-ups also go to the newsletter list in Kit (kit.com, free up to its plan's limit), so Cat can
// read the list, send a welcome email and write to everyone, with an unsubscribe link in every email. The sign-up is
// kept in Netlify Blobs first either way; Kit is only told when KIT_API_KEY and KIT_FORM_ID are set in Netlify.

export const KIT_API = 'https://api.kit.com/v4';

export interface KitSettings {
  apiKey?: string;
  formId?: string;
}

type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status'>>;

/**
 * Adds an email to the Kit form: creates (or finds) the subscriber, then subscribes them to the form, which starts
 * the form's own emails (its confirmation or welcome). The source rides in the referrer, so Kit shows where they came
 * from. Returns 'off' when Kit isn't set up, 'sent', or 'failed' (which never fails the sign-up itself).
 */
export async function addToKit(email: string, src: string | undefined, kit: KitSettings, site: string, fetcher: Fetch = fetch): Promise<'off' | 'sent' | 'failed'> {
  if (!kit.apiKey || !kit.formId) return 'off';
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Kit-Api-Key': kit.apiKey };
  const referrer = src ? `${site}/?utm_source=${encodeURIComponent(src)}` : site;
  try {
    const made = await fetcher(`${KIT_API}/subscribers`, { method: 'POST', headers, body: JSON.stringify({ email_address: email }) });
    if (!made.ok) return 'failed';
    const added = await fetcher(`${KIT_API}/forms/${encodeURIComponent(kit.formId)}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email_address: email, referrer }),
    });
    return added.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

/** A sign-up Kit didn't take (a rush past Kit's rate limit, or Kit down), kept so the hourly catch-up can send it. */
export interface KitRetry {
  email: string;
  src?: string;
  tries: number;
}

export interface RetryStore {
  list(): Promise<string[]>;
  get(key: string): Promise<KitRetry | undefined>;
  set(key: string, value: KitRetry): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Kit allows roughly 120 calls a minute per key and each sign-up takes two, so a catch-up sends at most 50. */
export const RETRY_BATCH = 50;
/** After a day of hourly tries something else is wrong (a bad key, a deleted form); the entry stays in the sign-ups store. */
export const MAX_TRIES = 24;

/** Sends sign-ups Kit missed. Returns how many went through; the rest wait for the next run. */
export async function retryKit(store: RetryStore, kit: KitSettings, site: string, fetcher: Fetch = fetch, batch = RETRY_BATCH): Promise<number> {
  if (!kit.apiKey || !kit.formId) return 0;
  let sent = 0;
  for (const key of (await store.list()).slice(0, batch)) {
    const entry = await store.get(key);
    if (!entry) continue;
    if ((await addToKit(entry.email, entry.src, kit, site, fetcher)) === 'sent') {
      await store.delete(key);
      sent++;
    } else if (entry.tries + 1 >= MAX_TRIES) {
      console.error('sign-up never reached Kit, left in the sign-ups store');
      await store.delete(key);
    } else {
      await store.set(key, { ...entry, tries: entry.tries + 1 });
    }
  }
  return sent;
}
