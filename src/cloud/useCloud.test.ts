import { describe, expect, it } from 'vitest';
import { isOffline, syncFault } from './useCloud';

// Every sync failure used to look like "offline" (engineering review, Nov 10): a refused save, a sign-in that ran out or
// the account service paused would quietly stop someone's work reaching their account. Now only the connection reads as
// offline; anything else is a fault, reported to us without any email address in it.
describe('telling a sync fault from being offline', () => {
  it('the browser offline, or a request that never got an answer, is offline', () => {
    expect(isOffline(new Error('anything'), false)).toBe(true);
    expect(isOffline(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(isOffline({ message: 'TypeError: Load failed' }, true)).toBe(true);
    expect(isOffline(new Error('The account is being saved from another device; try again in a moment.'), true)).toBe(true);
  });

  it('a refused save, an expired sign-in or a paused service is a fault', () => {
    expect(isOffline({ code: '42501', message: 'new row violates row-level security policy for table "backups"' }, true)).toBe(false);
    expect(isOffline({ code: 'PGRST301', message: 'JWT expired' }, true)).toBe(false);
    expect(isOffline({ status: 503, message: 'Service Unavailable' }, true)).toBe(false);
  });

  it('a reported fault names what failed, never an email address', () => {
    const e = syncFault({ code: 'PGRST301', message: 'JWT expired for sewist@example.com' });
    expect(e.message).toBe('Account sync: PGRST301 JWT expired for [email]');
    expect(e.message).not.toMatch(/@/);
  });
});
