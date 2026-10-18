/** Hand a link to the phone's share sheet (WhatsApp, Messages, email), or copy it where there's none. */
export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
