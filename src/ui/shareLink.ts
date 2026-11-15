/** Hand a link to the phone's share sheet (WhatsApp, Messages, email), or copy it where there's none. With no text,
 *  only the link goes: the share sheet's Copy then copies the link itself (with a sentence beside it, an iPhone's Copy
 *  gave the sentence alone, and pasting it into the home-screen app's box brought nothing; Cat, Nov 15). */
export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share(text ? { text, url } : { url });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
