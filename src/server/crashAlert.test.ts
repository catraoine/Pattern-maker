import { describe, expect, it } from 'vitest';
import type { CountStore } from '../photo/limit';
import { ALERT_AT, alertCrashes, crashAlertFor, isNoise } from './crashAlert';
import type { StoredCrash } from './reports';

const crash = (message = "TypeError: Cannot read properties of undefined (reading 'waist')"): StoredCrash => ({
  message,
  where: 'render',
  view: 'style',
  version: '0.1.0+abc1234',
  browser: 'Safari 17 iOS',
  at: '2026-11-21T19:00:00.000Z',
  receivedAt: '2026-11-21T19:00:01.000Z',
});

/** An in-memory counter store, as blobCounts keeps them. */
function memory(start: Record<string, number> = {}): CountStore & { n: Record<string, number> } {
  const n = { ...start };
  return {
    n,
    get: async (k) => n[k] ?? 0,
    take: async (k, cap) => {
      if ((n[k] ?? 0) >= cap) return false;
      n[k] = (n[k] ?? 0) + 1;
      return true;
    },
  };
}

const day = '2026-11-21';

async function run(batches: StoredCrash[][], alerts = memory(), fails = 0) {
  const sent: ReturnType<typeof crashAlertFor>[] = [];
  let failed = 0;
  const send = async (m: ReturnType<typeof crashAlertFor>) => {
    if (failed < fails) {
      failed++;
      throw new Error('email service answered 500');
    }
    sent.push(m);
  };
  for (const b of batches) await alertCrashes(b, day, alerts, send, 'owner@example.com').catch(() => undefined);
  return { sent, alerts };
}

describe('crash alert emails', () => {
  it('sends on the 1st, 10th and 50th real crash of the day, and never more than three', async () => {
    const { sent } = await run(Array.from({ length: 80 }, () => [crash()]));
    expect(sent.map((m) => m.subject)).toEqual([`App crash alert: 1st today (${day})`, `App crash alert: 10th today (${day})`, `App crash alert: 50th today (${day})`]);
    expect(sent.length).toBe(ALERT_AT.length);
  });

  it('sends one email when a single report carries several crashes past a count', async () => {
    const { sent } = await run([[crash(), crash(), crash()], [crash()]]);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('3 crashes today');
    expect(sent[0].text).toContain('next email comes at 10');
  });

  it('leaves out browser, robot and app-update noise', async () => {
    const noise = [
      'ResizeObserver loop completed with undelivered notifications.',
      'Object Not Found Matching Id:#, MethodName:update, ParamCount:#',
      'Error: Error invoking postMessage: Java object is gone',
      "TypeError: Failed to register a ServiceWorker for scope ('/'…'/sw.js'): A bad HTTP response code (#) was received when fetching the script.",
      'TypeError: Failed to fetch dynamically imported module: /assets/pdf-CyQXGLqP.js',
    ].map(crash);
    // A real fault that happens to name a page type is still counted.
    expect(isNoise(crash("SyntaxError: Unexpected token '<', content-type 'text/html' is not JSON"))).toBe(false);
    expect(noise.every(isNoise)).toBe(true);
    expect(isNoise(crash())).toBe(false);
    const { sent, alerts } = await run([noise]);
    expect(sent).toEqual([]);
    expect(alerts.n[`${day}/real`]).toBeUndefined();
  });

  it('tries a failed email again with the next crash, up to three times', async () => {
    const twice = await run([[crash()], [crash()], [crash()]], memory(), 2);
    expect(twice.sent.map((m) => m.subject)).toEqual([`App crash alert: 1st today (${day})`]);
    expect(twice.sent[0].text).toContain('3 crashes today');
    const always = await run(Array.from({ length: 9 }, () => [crash()]), memory(), 99);
    expect(always.sent).toEqual([]);
    expect(always.alerts.n[`${day}/try-1`]).toBe(3);
  });

  it('a missed count is covered by the next one, in one email', async () => {
    const { sent, alerts } = await run(Array.from({ length: 12 }, () => [crash()]), memory(), 3);
    expect(sent.map((m) => m.subject)).toEqual([`App crash alert: 10th today (${day})`]);
    expect(alerts.n[`${day}/done-1`]).toBe(1);
  });

  it('fails closed: a counter that cannot be reached sends nothing', async () => {
    const broken: CountStore = { get: async () => 0, take: async () => Promise.reject(new Error('store down')) };
    const sent: unknown[] = [];
    await expect(alertCrashes([crash()], day, broken, async (m) => void sent.push(m), 'owner@example.com')).rejects.toThrow();
    expect(sent).toEqual([]);
  });

  it('says what the crash was and where, without anything to click', () => {
    const m = crashAlertFor(1, 1, crash(), day, 'owner@example.com');
    expect(m.to).toEqual(['owner@example.com']);
    expect(m.text).toContain('first one today');
    expect(m.text).toContain('Screen: style');
    expect(m.text).toContain('Browser: Safari 17 iOS');
    expect(m.text).not.toMatch(/https?:/);
    expect(crashAlertFor(50, 52, crash(), day, 'x@example.com').text).toContain('last crash email today');
  });
});
