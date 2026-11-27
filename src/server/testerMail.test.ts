import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkTesterMail, htmlFor, linkAllowed, linksIn, testerMailFor } from './testerMail';
// The function's own test sits here: a test file beside it would be deployed as a function of its own.

// The counters run in memory here; in production they are Netlify Blobs.
const counts = vi.hoisted(() => new Map<string, number>());
vi.mock('./blobCounts', () => ({
  blobCounts: (name: string) => ({
    get: async (k: string) => counts.get(`${name}:${k}`) ?? 0,
    take: async (k: string, cap: number) => {
      const n = counts.get(`${name}:${k}`) ?? 0;
      if (n >= cap) return false;
      counts.set(`${name}:${k}`, n + 1);
      return true;
    },
  }),
}));

// Made-up values only: none of these is a real key or inbox.
const KEY = 'example-key-0123456789-abcdefghijklmnop';
const env: Record<string, string | undefined> = { RESEND_API_KEY: 're_example', TESTER_MAIL_KEY: KEY, TESTER_MAIL_COPY_TO: 'owner@example.com' };
(globalThis as unknown as { Netlify: unknown }).Netlify = { env: { get: (n: string) => env[n] } };

const text = 'Hi Sam,\n\nHere is the app: https://maisontrace.co/?src=tester\nAnd the form: https://forms.gle/Example123.\n\nWarmly,\nThe team';
const ok = { to: 'sewist@example.com', subject: 'Re: Fit test', text, inReplyTo: '<abc123@mail.gmail.com>', references: ['<first1@mail.gmail.com>'], sendId: 'checkin-sam-nov19' };

describe('tester email: the request', () => {
  it('takes a well-formed request and turns away anything else', () => {
    expect(checkTesterMail(JSON.stringify(ok))).toEqual(ok);
    expect(checkTesterMail(JSON.stringify({ ...ok, to: ['a@example.com', 'b@example.com'] }))).toBeNull();
    expect(checkTesterMail(JSON.stringify({ ...ok, cc: 'a@example.com' }))).toBeNull();
    expect(checkTesterMail(JSON.stringify({ ...ok, html: '<b>hi</b>' }))).toBeNull();
    expect(checkTesterMail(JSON.stringify({ ...ok, subject: 'Hi\r\nBcc: x@example.com' }))).toBeNull();
    expect(checkTesterMail(JSON.stringify({ ...ok, inReplyTo: 'abc123@mail.gmail.com' }))).toBeNull();
    expect(checkTesterMail(JSON.stringify({ ...ok, inReplyTo: undefined }))).toBeNull();
    expect(checkTesterMail('not json')).toBeNull();
  });

  it('finds every link, leaving the full stop after one with the sentence', () => {
    expect(linksIn(text)).toEqual(['https://maisontrace.co/?src=tester', 'https://forms.gle/Example123']);
    expect(linksIn('Join at maisontrace.co/?src=threads. Or write to hello@maisontrace.co')).toEqual(['maisontrace.co/?src=threads']);
    // Bare addresses elsewhere are found too, so they can be turned away; sizes and dates are not addresses.
    expect(linksIn('Re-enter it at login-help.example/signin, then cut 1.5cm on Dec. 7')).toEqual(['login-help.example/signin']);
    expect(linksIn('(see https://maisontrace.co/a(b))')).toEqual(['https://maisontrace.co/a(b)']);
  });

  it('lets links go only to our app and our forms', () => {
    expect(linkAllowed('https://maisontrace.co/?code=x')).toBe(true);
    expect(linkAllowed('maisontrace.co')).toBe(true);
    expect(linkAllowed('https://docs.google.com/forms/d/e/abc/viewform')).toBe(true);
    expect(linkAllowed('https://docs.google.com/document/d/abc')).toBe(false);
    expect(linkAllowed('https://www.google.com/url?q=https://maisontrace.co')).toBe(false);
    expect(linkAllowed('http://maisontrace.co')).toBe(false);
    expect(linkAllowed('https://maisontrace.co.evil.example')).toBe(false);
    expect(linkAllowed('https://maisontrace.co@evil.example')).toBe(false);
  });

  it('writes each link as a real link showing exactly what was written, and nothing else as HTML', () => {
    const html = htmlFor('See maisontrace.co/?src=x.\n<script>');
    expect(html).toContain('<a href="https://maisontrace.co/?src=x">maisontrace.co/?src=x</a>.<br>');
    expect(html).toContain('&lt;script&gt;');
    expect(htmlFor('a&b https://forms.gle/A?x=1&y=2')).toContain('href="https://forms.gle/A?x=1&amp;y=2"');
  });

  it('copies Cat, sends replies to her and threads it with the tester’s earlier emails', () => {
    const e = testerMailFor(ok, 'owner@example.com', 'Cat at Maison Tracé');
    expect(e.from).toBe('"Cat at Maison Tracé" <hello@maisontrace.co>');
    expect(e.to).toEqual(['sewist@example.com']);
    expect(e.bcc).toEqual(['owner@example.com']);
    expect(e.reply_to).toEqual(['owner@example.com']);
    expect(e.headers).toEqual({ 'In-Reply-To': '<abc123@mail.gmail.com>', References: '<first1@mail.gmail.com> <abc123@mail.gmail.com>' });
    expect(e.text).toBe(text);
    expect(testerMailFor({ ...ok, inReplyTo: undefined }, 'owner@example.com', 'x')).not.toHaveProperty('headers');
    expect(testerMailFor(ok, 'owner@example.com', '"evil" <x@example.com>').from).toBe('"evil xexample.com" <hello@maisontrace.co>');
    // The email being answered goes last, even when it was also listed among the earlier ones.
    expect(testerMailFor({ ...ok, references: ['<abc123@mail.gmail.com>', '<b@mail.gmail.com>'] }, 'o@example.com', 'x').headers?.References).toBe('<b@mail.gmail.com> <abc123@mail.gmail.com>');
  });
});

describe('tester-mail function, end to end', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    counts.clear();
    env.TESTER_MAIL_KEY = KEY;
  });

  const call = async (body: unknown, key: string | null = KEY) => {
    const { default: handler } = await import('../../netlify/functions/tester-mail.mjs');
    const req = new Request('https://example.test/.netlify/functions/tester-mail', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'x-tester-mail-key': key } : {}) }, body: JSON.stringify(body) });
    const res = await handler(req);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const resendOk = () => {
    const sent: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent.push({ headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
      return Response.json({ id: 'email-1' });
    });
    return sent;
  };

  it('sends a good request, once, with the copy and the thread headers', async () => {
    const sent = resendOk();
    expect(await call(ok)).toEqual({ status: 200, body: { ok: true, id: 'email-1' } });
    expect(sent).toHaveLength(1);
    expect(sent[0].headers['Idempotency-Key']).toBe('tester-mail-checkin-sam-nov19');
    expect(sent[0].body.bcc).toEqual(['owner@example.com']);
    expect(sent[0].body.html).toContain('<a href="https://forms.gle/Example123">');
  });

  it('turns away a missing or wrong key, and sends nothing', async () => {
    const sent = resendOk();
    expect((await call(ok, null)).status).toBe(403);
    expect((await call(ok, KEY + 'x')).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it('fails closed when it is not set up', async () => {
    const sent = resendOk();
    env.TESTER_MAIL_KEY = 'short';
    expect(await call(ok, 'short')).toEqual({ status: 503, body: { ok: false, error: 'not_configured' } });
    expect(sent).toHaveLength(0);
  });

  it('names a link it won’t send, and sends nothing', async () => {
    const sent = resendOk();
    expect(await call({ ...ok, text: 'Click https://www.google.com/url?q=x' })).toEqual({ status: 400, body: { ok: false, error: 'link_not_allowed', links: ['https://www.google.com/url?q=x'] } });
    expect(sent).toHaveLength(0);
  });

  it('stops at the daily cap, counting a repeated send only once', async () => {
    resendOk();
    for (let i = 0; i < 3; i++) expect((await call(ok)).status).toBe(200);
    for (let i = 1; i < 25; i++) expect((await call({ ...ok, sendId: `checkin-${i}-nov19` })).status).toBe(200);
    expect((await call({ ...ok, sendId: 'checkin-25-nov19' })).body.error).toBe('limit_reached');
  });

  it('refuses without using up a send when the shared day is nearly full', async () => {
    const sent = resendOk();
    const day = new Date().toISOString().slice(0, 10);
    counts.set(`email-limits:${day}/all`, 89);
    expect((await call(ok)).body.error).toBe('busy');
    expect(counts.get(`email-limits:${day}/all`)).toBe(89);
    expect(sent).toHaveLength(0);
  });

  it('keeps the day’s tester sends when a PDF email fills the shared day in between', async () => {
    const sent = resendOk();
    const day = new Date().toISOString().slice(0, 10);
    const sharedKey = `email-limits:${day}/all`;
    counts.set(sharedKey, 88);
    // Another visitor's PDF email takes the last place just after this send's first shared take.
    const set = counts.set.bind(counts);
    counts.set = (k: string, v: number) => set(k, k === sharedKey && v === 89 ? 90 : v);
    expect((await call(ok)).body.error).toBe('busy');
    expect(counts.get(`tester-mail-limits:${day}/all`) ?? 0).toBe(0);
    expect(sent).toHaveLength(0);
    delete (counts as { set?: unknown }).set;
  });

  it('says no when the counter can’t be reached', async () => {
    const sent = resendOk();
    counts.set = () => {
      throw new Error('store down');
    };
    expect((await call(ok)).status).toBe(502);
    expect(sent).toHaveLength(0);
    delete (counts as { set?: unknown }).set;
  });
});
