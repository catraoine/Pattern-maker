import { describe, expect, it } from 'vitest';
import { MAX_CRASHES_PER_VISIT, Reporter, browserFamily, cleanSource, rememberSource } from './report';
import { checkBeacon } from '../server/reports';

const make = (counting = true) => {
  const sent: string[] = [];
  const r = new Reporter({
    send: (b) => (sent.push(b), true),
    version: '0.1.0+abc1234',
    browser: 'Chrome 129 Android',
    counting,
    now: () => new Date('2026-10-17T10:00:00Z'),
  });
  return { r, sent, last: () => JSON.parse(sent[sent.length - 1]) };
};

describe('the report beacon', () => {
  it('sends the whole visit in one request the server accepts', () => {
    const { r, sent, last } = make();
    r.count('measured', 'skirt');
    r.count('measured', 'skirt');
    r.count('styled', 'skirt');
    r.view = 'export';
    r.crash(new TypeError('boom'), 'error');
    expect(r.flush()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(last().counts).toEqual({ visit: 1, 'measured:skirt': 1, 'styled:skirt': 1 });
    expect(last().crashes[0]).toMatchObject({ message: 'TypeError: boom', where: 'error', view: 'export', version: '0.1.0+abc1234' });
    expect(checkBeacon(sent[0])).not.toBeNull();
  });

  it('sends nothing twice, and makes no request when nothing is waiting', () => {
    const { r, sent, last } = make();
    r.flush();
    expect(r.flush()).toBe(false);
    r.count('printed', 'dress');
    r.count('visit');
    r.flush();
    expect(sent).toHaveLength(2);
    expect(last()).toEqual({ counts: { 'printed:dress': 1 } });
  });

  it('reports the same error once, and at most five a visit', () => {
    const { r, last } = make();
    const same = new Error('same');
    expect(r.crash(same, 'error')).toBe(true);
    expect(r.crash(same, 'render')).toBe(false);
    for (let i = 0; i < 10; i++) r.crash(new Error(`other ${i}`), 'promise');
    r.flush();
    expect(last().crashes).toHaveLength(MAX_CRASHES_PER_VISIT);
    expect(r.crash(new Error('later'), 'error')).toBe(false);
  });

  it('reports odd things thrown, trimmed', () => {
    const { r, last } = make();
    r.crash('plain text', 'promise');
    r.crash({ any: 'thing' }, 'promise');
    r.crash(new Error('x'.repeat(2000)), 'error');
    r.flush();
    expect(last().crashes.map((c: { message: string }) => c.message.length <= 500)).toEqual([true, true, true]);
    expect(last().crashes[1].message).toBe('[object Object]');
  });

  it('counts nothing when the browser asks not to be tracked, but still reports crashes', () => {
    const { r, sent, last } = make(false);
    r.count('styled', 'skirt');
    expect(r.flush()).toBe(false);
    r.crash(new Error('boom'), 'error');
    r.flush();
    expect(sent).toHaveLength(1);
    expect(last().counts).toBeUndefined();
  });
});

describe('browser family', () => {
  it('names the browser, its major version and the system, nothing more', () => {
    expect(browserFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe(
      'Safari 17 iOS',
    );
    expect(browserFamily('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36')).toBe(
      'Chrome 129 Android',
    );
    expect(browserFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0')).toBe(
      'Edge 129 Windows',
    );
    expect(browserFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox 131 Mac');
    expect(browserFamily('curl/8.0')).toBe('Other Other');
  });

  it("tells an iPad from a Mac, though the iPad's Safari says it is a Mac", () => {
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    expect(browserFamily(ipad, 5)).toBe('Safari 18 iPadOS');
    expect(browserFamily(ipad, 0)).toBe('Safari 18 Mac');
    expect(browserFamily('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1')).toBe('Safari 16 iPadOS');
  });
});

describe('where a visitor came from', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('keeps the first ?src= on the device, cleaned to plain words, and counts a sign-up against it', () => {
    const store = memory();
    expect(rememberSource('?src=Pinterest%20Board!', store)).toBe('pinterestboard');
    expect(rememberSource('?src=tiktok', store)).toBe('pinterestboard');
    expect(rememberSource('', memory())).toBeUndefined();
    expect(cleanSource('x')).toBeUndefined();
    const { r, last } = make();
    r.count('signup', 'pinterestboard');
    r.count('fit_reported', 'skirt');
    r.flush();
    expect(last().counts).toEqual({ visit: 1, 'signup:pinterestboard': 1, 'fit_reported:skirt': 1 });
    expect(checkBeacon(JSON.stringify(last()))).not.toBeNull();
  });
});
