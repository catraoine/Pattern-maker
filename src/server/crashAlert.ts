// Server side only: a same-day email to Cat when real people hit crashes on the live app (Cat's "apply", Nov 21, from
// the code quality review). Until now a crash at noon reached her only through the next morning's bug hunt. The email
// goes on the day's 1st, 10th and 50th real crash, so a bad day sends at most three, and noise from browsers, robots
// and app updates is left out (the nightly bug hunt still reads every report). Used by the report function.
import type { CountStore } from '../photo/limit';
import type { StoredCrash } from './reports';

/** The day's real-crash counts that send an email: the first tells Cat something broke, the others that it's spreading. */
export const ALERT_AT = [1, 10, 50] as const;

/**
 * Crash reports that aren't a fault a person can feel, seen in the live reports since October: the browser's own
 * ResizeObserver warning, link scanners in email apps, Android in-app browsers closing, the offline helper failing to
 * register, and a page left open across a release asking for a file the release replaced (the app reloads for that).
 */
const NOISE = [
  /ResizeObserver loop/i,
  /Object Not Found Matching Id/i,
  /Java object is gone/i,
  /Failed to register a ServiceWorker/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /is not a valid JavaScript MIME type|Failed to load module script/i,
];

export const isNoise = (c: Pick<StoredCrash, 'message'>) => NOISE.some((re) => re.test(c.message));

const ordinal = (n: number) => (n === 1 ? '1st' : `${n}th`);

/**
 * The email for a count in ALERT_AT (`at`), sent when the day's real crashes reached `n`, `latest` being the report that
 * reached it. Plain text: nothing to click.
 */
export function crashAlertFor(at: number, n: number, latest: StoredCrash, day: string, to: string) {
  const next = ALERT_AT.find((t) => t > at);
  const text = [
    n === 1
      ? 'Someone using the live app hit a crash today. This is the first one today.'
      : `The live app has had ${n} crashes today.`,
    next ? `The next email comes at ${next} crashes.` : 'This is the last crash email today.',
    '',
    `Latest: ${latest.message}`,
    `Screen: ${latest.view}`,
    `Browser: ${latest.browser}`,
    `App version: ${latest.version}`,
    `Time (UTC): ${latest.receivedAt}`,
    '',
    'No names, measurements or photos are in crash reports. The full list is in the next morning bug hunt.',
  ].join('\n');
  return {
    from: '"Maison Tracé app" <hello@maisontrace.co>',
    to: [to],
    subject: `App crash alert: ${ordinal(at)} today (${day})`,
    text,
  };
}

/** Tries at each count's email, so a send the email service turned away is tried again with the next crash. */
const TRIES = 3;

/**
 * Counts the day's real crashes and sends the email when a count in ALERT_AT is reached. A count's email is marked done
 * only once it has gone; until then each new crash tries again, up to TRIES times. The tries are claimed in the store
 * first, so reports arriving together rarely send it twice, and its own counters mean the visitors' daily email cap
 * never holds it back. Like every limit here it fails closed: if a counter can't be reached the error goes up and
 * nothing is sent. `send` throws when the email doesn't go. Returns the count it emailed about, if any.
 */
export async function alertCrashes(
  crashes: StoredCrash[],
  day: string,
  alerts: CountStore,
  send: (mail: ReturnType<typeof crashAlertFor>) => Promise<void>,
  to: string,
): Promise<number | undefined> {
  const real = crashes.filter((c) => !isNoise(c));
  if (!real.length) return undefined;
  // One take for each crash: a report carries at most five.
  for (let i = 0; i < real.length; i++) await alerts.take(`${day}/real`, Infinity);
  const n = await alerts.get(`${day}/real`);
  // Only the highest count reached and not yet emailed: a lower one missed (its email failed) is covered by it.
  const at = [...ALERT_AT].reverse().find((t) => t <= n);
  if (at === undefined || (await alerts.get(`${day}/done-${at}`)) > 0) return undefined;
  if (!(await alerts.take(`${day}/try-${at}`, TRIES))) return undefined;
  await send(crashAlertFor(at, n, real[real.length - 1], day, to));
  for (const t of ALERT_AT) if (t <= at) await alerts.take(`${day}/done-${t}`, 1);
  return at;
}
