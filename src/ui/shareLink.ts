/** Hand a link to the phone's share sheet (WhatsApp, Messages, email), or copy it where there's none. Given the
 *  words and the link apart, an iPhone's Copy in the share sheet kept the words and dropped the link, so a pasted
 *  reply or move link brought nothing (Cat, Nov 15). So with words, the link goes inside them, and every choice in
 *  the sheet (Copy too) carries it; with none, the link alone, which AirDrop opens as a link. */
export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share(text ? { text: `${text}\n${url}` } : { url });
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
