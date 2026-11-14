import { describe, expect, it } from 'vitest';
import { addJoiners, emailId, isFull, placeFor, readList, type FoundingList } from './founding';

const tester = (email: string, n: number) => ({ id: emailId(email), n, kind: 'tester' as const, joinedAt: '2026-11-20T00:00:00.000Z' });
const join = (email: string, at: string) => ({ id: emailId(email), receivedAt: at });

describe('founding list', () => {
  const base: FoundingList = { members: [tester('one@example.com', 1), tester('two@example.com', 2)] };

  it('numbers waitlist sign-ups after the testers, earliest first', () => {
    const list = addJoiners(base, [join('late@example.com', '2026-11-13T05:00:00Z'), join('early@example.com', '2026-11-12T23:43:00Z')]);
    expect(placeFor(list, 'early@example.com')).toEqual({ n: 3, kind: 'founding' });
    expect(placeFor(list, 'late@example.com')).toEqual({ n: 4, kind: 'founding' });
  });

  it('keeps a number when someone signs up again, and never numbers a tester twice', () => {
    const first = addJoiners(base, [join('early@example.com', '2026-11-12T23:43:00Z')]);
    const again = addJoiners(first, [join('early@example.com', '2026-12-01T00:00:00Z'), join('one@example.com', '2026-12-01T00:00:00Z')]);
    expect(again).toBe(first);
    expect(placeFor(again, 'one@example.com')).toEqual({ n: 1, kind: 'tester' });
  });

  it('matches the email however it was typed', () => {
    expect(placeFor(base, '  ONE@Example.com ')).toEqual({ n: 1, kind: 'tester' });
    expect(placeFor(base, 'nobody@example.com')).toBeNull();
  });

  it('stops at the last place', () => {
    const list = addJoiners(base, [join('a@example.com', '1'), join('b@example.com', '2'), join('c@example.com', '3')], 4);
    expect(list.members.map((m) => m.n)).toEqual([1, 2, 3, 4]);
    expect(placeFor(list, 'c@example.com')).toBeNull();
    expect(isFull(list, 4)).toBe(true);
  });

  it('opens for numbering only once marked open', () => {
    expect(readList({ members: [tester('one@example.com', 1)] })?.open).toBe(false);
    expect(readList({ members: [tester('one@example.com', 1)], open: true })?.open).toBe(true);
    expect(addJoiners({ ...base, open: true }, [join('a@example.com', '1')]).open).toBe(true);
  });

  it('numbers someone on the waitlist and the founding card once, by their earlier sign-up', () => {
    const list = addJoiners(base, [join('a@example.com', '2026-11-20'), join('b@example.com', '2026-11-15'), join('a@example.com', '2026-11-10')]);
    expect(placeFor(list, 'a@example.com')).toEqual({ n: 3, kind: 'founding' });
    expect(list.members).toHaveLength(4);
  });

  it('reads a damaged list as nobody', () => {
    expect(readList(null)).toBeNull();
    expect(readList({ members: [{ id: 'x', n: 1, kind: 'tester', joinedAt: '' }] })).toBeNull();
    expect(readList({ members: [tester('one@example.com', 1)] })?.members).toHaveLength(1);
  });

  it('files an email under the same hash as the sign-ups store', () => {
    // signup.mts: createHash('sha256').update(email).digest('hex').slice(0, 16), after the check lower-cases and trims.
    expect(emailId('One@Example.com ')).toBe(emailId('one@example.com'));
    expect(emailId('one@example.com')).toMatch(/^[0-9a-f]{16}$/);
  });
});
