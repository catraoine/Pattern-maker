import { describe, expect, it } from 'vitest';
import type { CountStore } from '../photo/limit';
import { EMAIL_CAPS } from './emailPdf';
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

async function run(batches: StoredCrash[][], alerts = memory(), email = memory()) {
  const sent: ReturnType<typeof crashAlertFor>[] = [];
  for (const b of batches) await alertCrashes(b, day, { alerts, email }, async (m) => void sent.push(m), 'owner@example.com');
  return { sent, alerts, email };
}

describe('crash alert emails', () => {
  it('sends on the 1st, 10th and 50th real crash of the day, and never more than three', async () => {
    const { sent, email } = await run(Array.from({ length: 80 }, () => [crash()]));
    expect(sent.map((m) => m.subject)).toEqual([`App crash alert: 1st today (${day})`, `App crash alert: 10th today (${day})`, `App crash alert: 50th today (${day})`]);
    expect(sent.length).toBe(ALERT_AT.length);
    expect(email.n[`${day}/all`]).toBe(3);
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
    expect(noise.every(isNoise)).toBe(true);
    expect(isNoise(crash())).toBe(false);
    const { sent, alerts } = await run([noise]);
    expect(sent).toEqual([]);
    expect(alerts.n[`${day}/real`]).toBeUndefined();
  });

  it('sends nothing once the site has used its emails for the day', async () => {
    const { sent } = await run([[crash()]], memory(), memory({ [`${day}/all`]: EMAIL_CAPS.all }));
    expect(sent).toEqual([]);
  });

  it('fails closed: a counter that cannot be reached sends nothing', async () => {
    const broken: CountStore = { get: async () => 0, take: async () => Promise.reject(new Error('store down')) };
    const sent: unknown[] = [];
    await expect(alertCrashes([crash()], day, { alerts: broken, email: memory() }, async (m) => void sent.push(m), 'owner@example.com')).rejects.toThrow();
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
