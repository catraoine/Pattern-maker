// Server side only: a same-day email to Cat when real people hit crashes on the live app (Cat's "apply", Nov 21, from
// the code quality review). Until now a crash at noon reached her only through the next morning's bug hunt. The email
// goes on the day's 1st, 10th and 50th real crash, so a bad day sends at most three, and noise from browsers, robots
// and app updates is left out (the nightly bug hunt still reads every report). Used by the report function.
import type { CountStore } from '../photo/limit';
import { EMAIL_CAPS } from './emailPdf';
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
  /is not a valid JavaScript MIME type|'text\/html'/i,
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

/**
 * Counts the day's real crashes and sends the email when a count in ALERT_AT is reached. Each count's email is claimed
 * once in the store first, so two reports arriving together can't both send it. Like every limit here it fails closed:
 * if a counter can't be reached, the error goes up and nothing is sent. Returns the count it emailed about, if any.
 */
export async function alertCrashes(
  crashes: StoredCrash[],
  day: string,
  stores: { alerts: CountStore; email: CountStore },
  send: (mail: ReturnType<typeof crashAlertFor>) => Promise<void>,
  to: string,
): Promise<number | undefined> {
  const real = crashes.filter((c) => !isNoise(c));
  if (!real.length) return undefined;
  for (let i = 0; i < real.length; i++) await stores.alerts.take(`${day}/real`, Infinity);
  const n = await stores.alerts.get(`${day}/real`);
  // A count passed without its email (a send that failed) is claimed with the next, so only one email goes out.
  let due: number | undefined;
  for (const t of ALERT_AT) if (t <= n && (await stores.alerts.take(`${day}/sent-${t}`, 1))) due = t;
  if (due === undefined) return undefined;
  // Counted with every other email the site sends, under the same daily cap.
  if (!(await stores.email.take(`${day}/all`, EMAIL_CAPS.all))) return undefined;
  await send(crashAlertFor(due, n, real[real.length - 1], day, to));
  return due;
}
