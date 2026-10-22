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
