// Crash reports and anonymous visit counts. Everything waits in memory and goes in one small request when the visit
// ends or the tab is hidden, so a visit costs at most one or two requests. No cookies, no stored ids: a visit is a
// page load. Never measurements, names or photos: a crash report is the error's message and stack, the screen, the
// app version and the browser family.
import type { Garment } from '../measurements';

export const ENDPOINT = '/.netlify/functions/report';
export const MAX_CRASHES_PER_VISIT = 5;

/**
 * The steps of the way that are counted, once per visit each (per garment), and the four numbers the business
 * plan watches weekly: a sign-up (by where the visitor came from), a pattern printed, a fit reported, a payment.
 */
export type Step = 'measured' | 'styled' | 'printed' | 'photo' | 'signup' | 'fit_reported' | 'paid';

const SOURCE_KEY = 'maison-trace-source';

/** Only plain lower-case words, as the server accepts: "pinterest", "class-vancouver". */
export const cleanSource = (s: string | null | undefined) => {
  const v = (s ?? '').trim().toLowerCase().replace(/[^a-z-]/g, '').slice(0, 20);
  return v.length >= 2 ? v : undefined;
};

/**
 * Where this visitor first came from: the `?src=` on the link they arrived by (a creator's video, a Pinterest pin, a
 * class), kept on the device so a sign-up weeks later still counts against it. The first source wins.
 */
export function rememberSource(search: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined): string | undefined {
  const fromLink = cleanSource(new URLSearchParams(search).get('src'));
  try {
    const kept = cleanSource(storage?.getItem(SOURCE_KEY));
    if (kept) return kept;
    if (fromLink) storage?.setItem(SOURCE_KEY, fromLink);
  } catch {
    // Storage can be off (private windows); the source is then only this visit's.
  }
  return fromLink;
}

export const signupSource = (): string | undefined => {
  try {
    return cleanSource(typeof localStorage === 'undefined' ? undefined : localStorage.getItem(SOURCE_KEY));
  } catch {
    return undefined;
  }
};
export type Where = 'error' | 'promise' | 'render';

export interface CrashReport {
  message: string;
  stack?: string;
  where: Where;
  view: string;
  version: string;
  browser: string;
  at: string;
}

interface Options {
  /** Sends a body; false if it couldn't be handed over. */
  send: (body: string) => boolean;
  version: string;
  browser: string;
  /** False when the browser asks not to be tracked: crash reports still go, counts don't. */
  counting: boolean;
  now?: () => Date;
}

/** The family and major version of a browser, and its system, from the user agent: "Safari 17 iOS". */
export function browserFamily(ua: string): string {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /CrOS/.test(ua)
        ? 'ChromeOS'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Other';
  const names: [string, RegExp][] = [
    ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
    ['Samsung', /SamsungBrowser\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+).*Safari/],
  ];
  for (const [name, re] of names) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]} ${os}`;
  }
  return `Other ${os}`;
}

function describeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: `${err.name}: ${err.message}`, stack: err.stack };
  if (typeof err === 'string') return { message: err };
  return { message: Object.prototype.toString.call(err) };
}

export class Reporter {
  /** The screen on show, for crash reports. */
  view = 'start';
  private counts: Record<string, number> = {};
  private counted = new Set<string>();
  private crashes: CrashReport[] = [];
  private seen = new Set<string>();

  constructor(private opts: Options) {
    this.count('visit');
  }

  /** Counts a step of the way, once per visit. The suffix is the garment it was for, or a sign-up's source. */
  count(step: Step | 'visit', suffix?: Garment | string) {
    const key = suffix ? `${step}:${suffix}` : step;
    if (!this.opts.counting || this.counted.has(key)) return;
    this.counted.add(key);
    this.counts[key] = 1;
  }

  /** Queues a crash report. The same error is reported once, and at most five a visit. False if it was dropped. */
  crash(err: unknown, where: Where): boolean {
    const { message, stack } = describeError(err);
    const sig = `${message}\n${stack?.split('\n').slice(0, 2).join('\n') ?? ''}`;
    if (this.seen.has(sig) || this.seen.size >= MAX_CRASHES_PER_VISIT) return false;
    this.seen.add(sig);
    this.crashes.push({
      message: message.slice(0, 500),
      stack: stack?.split('\n').slice(0, 15).join('\n').slice(0, 2_000),
      where,
      view: this.view.slice(0, 30),
      version: this.opts.version.slice(0, 40),
      browser: this.opts.browser.slice(0, 40),
      at: (this.opts.now?.() ?? new Date()).toISOString(),
    });
    return true;
  }

  /** Sends whatever is waiting, in one request. Nothing waiting: no request. Nothing is sent twice. */
  flush(): boolean {
    const counts = Object.keys(this.counts).length ? this.counts : undefined;
    const crashes = this.crashes.length ? this.crashes : undefined;
    if (!counts && !crashes) return false;
    this.counts = {};
    this.crashes = [];
    return this.opts.send(JSON.stringify({ counts, crashes }));
  }
}

let reporter: Reporter | null = null;

/** Starts listening for crashes and sends the visit's reports when the tab is hidden or closed. */
export function startReports(version: string) {
  if (reporter || typeof window === 'undefined') return;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const source = rememberSource(window.location.search, (() => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  })());
  reporter = new Reporter({
    version,
    browser: browserFamily(nav.userAgent),
    counting: !(nav.doNotTrack === '1' || nav.globalPrivacyControl === true),
    send: (body) => {
      // The dev server has no functions: show what would go instead.
      if (import.meta.env.DEV) return console.info('[report]', JSON.parse(body)), true;
      try {
        if (nav.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return true;
        void fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
        return true;
      } catch {
        return false;
      }
    },
  });
  // A visit that arrived by a tracked link is counted against its source too, so sign-ups per source have a base.
  if (cleanSource(new URLSearchParams(window.location.search).get('src'))) reporter.count('visit', source);
  window.addEventListener('error', (e) => reporter?.crash(e.error ?? e.message, 'error'));
  window.addEventListener('unhandledrejection', (e) => reporter?.crash(e.reason, 'promise'));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && reporter?.flush());
  window.addEventListener('pagehide', () => reporter?.flush());
}

export const countStep = (step: Step, suffix?: Garment | string) => reporter?.count(step, suffix);
export const reportCrash = (err: unknown, where: Where) => reporter?.crash(err, where);
export const flushReports = () => reporter?.flush();
export const setReportView = (view: string) => {
  if (reporter) reporter.view = view;
};
