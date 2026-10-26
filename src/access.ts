// The waitlist (Cat, 2026-10-21): until launch, maisontrace.co shows strangers a waitlist page, and fit testers (and
// Cat) get the full app. A tester gets in by opening their tester link (maisontrace.co/?tester=CODE) or by typing
// the code under "Use your code"; the code is checked once against TESTER_CODES, then this device is let in for good.

/** Kept outside the app's own "pattern-maker:" keys, so a ?fresh review link doesn't lock Cat out again. */
export const ACCESS_KEY = 'maison-trace-access';

type Store = Pick<Storage, 'getItem' | 'setItem'> | undefined;

const local = (): Store => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

/** Whether this device has been let in: a checked tester link or code, now or before. */
export function hasAccess(testerCode: string | undefined, storage: Store = local()): boolean {
  if (testerCode) return true;
  try {
    return !!storage?.getItem(ACCESS_KEY);
  } catch {
    return false;
  }
}

/** Lets this device in from now on. */
export function rememberAccess(storage: Store = local()) {
  try {
    storage?.setItem(ACCESS_KEY, 'tester');
  } catch {
    // Storage off (a private window): in for this visit only.
  }
}

/** The code on a tester link (?tester=TOILE-ONE), if there is one. */
export function testerFromLink(search: string): string | undefined {
  const code = new URLSearchParams(search).get('tester')?.trim();
  return code && code.length <= 60 ? code : undefined;
}

/** The address without its tester code, so the code doesn't sit in the address bar or get shared on. */
export function withoutTester(path: string, search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.delete('tester');
  const rest = params.toString();
  return `${path}${rest ? `?${rest}` : ''}${hash}`;
}

type CodeCheck = 'tester' | 'wrong' | 'limit' | 'failed';

/** Asks the tester function whether a code is one of the tester codes. */
export async function checkCode(code: string): Promise<CodeCheck> {
  try {
    const res = await fetch('/.netlify/functions/tester', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; tester?: boolean; error?: string };
    if (data.ok) return data.tester ? 'tester' : 'wrong';
    return data.error === 'limit_reached' ? 'limit' : 'failed';
  } catch {
    return 'failed';
  }
}

/** What to say when a code didn't let someone in. */
export const CODE_MESSAGE: Record<Exclude<CodeCheck, 'tester'>, string> = {
  wrong: "That isn't a tester code. Check the email it came in.",
  limit: "That's a lot of tries today. Try again tomorrow.",
  failed: "The code couldn't be checked just now. Check you're online and try again.",
};
