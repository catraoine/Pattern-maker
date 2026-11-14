// Server side only: the body scan for fit testers (Cat, Nov 14). A tester taps Body scan in Your account, our server
// asks Bodygram for a one-scan pass, and the tester opens Bodygram's own scanner with it in a new tab. The scan's
// photos go to Bodygram, never to us; the tester screenshots the numbers and emails them. Our server sends Bodygram
// nothing about the tester: no name, no measurements, no address.
import type { CountStore } from '../photo/limit';

/** Our Bodygram organisation. It shows in every scan address, so it isn't a secret; the API key is (BODYGRAM_API_KEY). */
export const BODYGRAM_ORG = 'org_4kb7r84L6UUKKmJxCcQbKn';
const BODYGRAM = 'https://platform.bodygram.com';

/**
 * Caps on scan passes. One shared tester code covers every tester, and the free Bodygram plan allows only so many
 * scans a month, so a tester gets 3 passes a day (one scan plus two retries), and the whole site 30 a month: about
 * four each for the 7 testers who asked to scan, with room for a redo.
 */
export const SCAN_CAPS = { visitor: 3, month: 30 };

type ScanAllowance = 'ok' | 'limit_reached' | 'busy';

/** Use up one scan pass, unless this tester is at today's cap or the site at this month's. */
export async function takeScanPass(store: CountStore, visitor: string, now = new Date(), caps = SCAN_CAPS): Promise<ScanAllowance> {
  const day = now.toISOString().slice(0, 10);
  const monthKey = `${day.slice(0, 7)}/all`;
  // A quick look first, so nobody's own count goes up in a month that's already full.
  if ((await store.get(monthKey)) >= caps.month) return 'busy';
  if (!(await store.take(`${day}/visitor/${visitor}`, caps.visitor))) return 'limit_reached';
  return (await store.take(monthKey, caps.month)) ? 'ok' : 'busy';
}

/** The scanner's address for a pass, in the tester's own units. */
export function scanUrl(token: string, unit: 'cm' | 'in'): string {
  const q = new URLSearchParams({ token, system: unit === 'in' ? 'imperial' : 'metric' });
  return `${BODYGRAM}/en/${BODYGRAM_ORG}/scan?${q}`;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Asks Bodygram for a pass good for one scan (create it, then read its results). Null if Bodygram says no. */
export async function newScanToken(apiKey: string, fetcher: Fetch = fetch): Promise<string | null> {
  const res = await fetcher(`${BODYGRAM}/api/orgs/${BODYGRAM_ORG}/scan-tokens`, {
    method: 'POST',
    // The key goes in a header, never in the address, so it can't end up in a log.
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ scope: ['api.platform.bodygram.com/scans:create', 'api.platform.bodygram.com/scans:read'] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { token?: unknown };
  return typeof data.token === 'string' && data.token.length > 0 && data.token.length < 4000 ? data.token : null;
}
