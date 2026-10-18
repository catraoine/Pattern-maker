import { describe, expect, it } from 'vitest';
import { NEW_ACCOUNT, addPerson, withPeople } from './account';
import { addReply, askIds, askLink, readLink, readPasted, redoFlags, rememberAsk, replyLink, type MeasureAsk } from './measureLink';

const ASK: MeasureAsk = { id: 'abc123', from: 'Anya', studio: 'Atelier Noor', note: 'Wear something close-fitting.', client: 'Jo Marsh', garment: 'dress' };
const hash = (url: string) => url.slice(url.indexOf('#'));

describe('measure-me links', () => {
  it('carries the ask after the #, so no server sees it', () => {
    const url = askLink('https://maisontrace.app', ASK);
    expect(url.startsWith('https://maisontrace.app/#measure=')).toBe(true);
    expect(readLink(hash(url))).toEqual({ kind: 'ask', ask: ASK });
  });

  it('round-trips a reply, with accents and to one decimal place', () => {
    const url = replyLink('https://x.app', { id: 'abc123', client: 'Zoë Brontë', garment: 'skirt', date: '2026-10-18', values: { waist: 74.04, full_hip: 99 } });
    const got = readLink(hash(url));
    expect(got).toEqual({ kind: 'reply', reply: { id: 'abc123', client: 'Zoë Brontë', garment: 'skirt', date: '2026-10-18', values: { waist: 74, full_hip: 99 } } });
  });

  it('drops numbers outside what a body can be, and unknown measurements', () => {
    const url = replyLink('https://x.app', { id: 'a', client: 'Jo', garment: 'skirt', date: '2026-10-18', values: { waist: 74, full_hip: 9000, nose: 3 } as never });
    const got = readLink(hash(url));
    expect(got?.kind === 'reply' && got.reply.values).toEqual({ waist: 74 });
  });

  it('calls a damaged link broken, and ignores other hashes', () => {
    expect(readLink('#measured=not-json')).toEqual({ kind: 'broken' });
    expect(readLink('#measure=' + btoa('{"v":1,"id":"a","garment":"cape"}'))).toEqual({ kind: 'broken' });
    expect(readLink('#plans')).toBeNull();
  });

  it('finds a link inside a pasted message', () => {
    const url = askLink('https://x.app', ASK);
    expect(readPasted(`Hi Jo, could you measure? ${url} Thanks!`)).toEqual({ kind: 'ask', ask: ASK });
  });

  it('asks the base set plus what the garment needs, or just the redo', () => {
    const dress = askIds(ASK);
    expect(dress.slice(0, 4)).toEqual(['full_bust', 'waist', 'full_hip', 'waist_to_floor']);
    expect(new Set(dress).size).toBe(dress.length);
    expect(askIds({ ...ASK, redo: ['full_hip'] })).toEqual(['full_hip']);
  });
});

describe('redo flags', () => {
  it('flags a hip taken at the waist', () => {
    const flags = redoFlags({ full_bust: 92, waist: 74, full_hip: 81 }, 'dress');
    expect(flags[0].id).toBe('full_hip');
    expect(flags[0].message).toMatch(/11 cm under bust/);
  });

  it("words the app's checks for the dressmaker", () => {
    const flags = redoFlags({ waist_to_hip: 20, waist_to_knee: 58, waist_to_floor: 50 }, 'skirt');
    expect(flags.map((f) => f.id)).toContain('waist_to_knee');
    expect(flags.every((f) => !/\byour\b/i.test(f.message))).toBe(true);
  });

  it('says nothing about measurements that look right, or were not asked', () => {
    expect(redoFlags({ full_bust: 92, waist: 74, full_hip: 99, waist_to_floor: 104 }, 'dress')).toEqual([]);
  });
});

describe('adding a reply to the client book', () => {
  it('finds the client the ask went to, notes what changed and dates it', () => {
    let account = addPerson({ ...NEW_ACCOUNT, name: 'Anya' }, 'Jo');
    const jo = withPeople(account).people.find((p) => p.name === 'Jo')!;
    account = { ...withPeople(account), people: withPeople(account).people.map((p) => (p.id === jo.id ? rememberAsk({ ...p, name: 'Jo M', values: { full_hip: 81 } }, ASK, '2026-10-18') : p)) };
    const got = addReply(account, { id: ASK.id, client: 'Jo Marsh', garment: 'dress', date: '2026-10-19', values: { full_hip: 99, waist: 74 } });
    const now = got.account.people!.find((p) => p.id === got.personId)!;
    expect(got.personId).toBe(jo.id);
    expect(now.values).toEqual({ full_hip: 99, waist: 74 });
    expect(got.changed).toContainEqual({ id: 'full_hip', was: 81, now: 99 });
    expect(now.history?.[now.history.length - 1]).toEqual({ date: '2026-10-19', values: { full_hip: 99, waist: 74 } });
    expect(now.asks).toEqual([]);
  });

  it('starts a new client when nobody matches', () => {
    const got = addReply({ ...NEW_ACCOUNT, name: 'Anya' }, { id: 'zzz', client: 'Priya', garment: 'skirt', date: '2026-10-18', values: { waist: 70 } });
    const priya = got.account.people!.find((p) => p.id === got.personId)!;
    expect(priya.name).toBe('Priya');
    expect(got.account.people).toHaveLength(2);
  });
});
