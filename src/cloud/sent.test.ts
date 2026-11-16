import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keepSigninSent, signinSent } from './sent';

describe('remembering who the sign-in email went to', () => {
  // The tests run without a browser, so a plain stand-in for the tab's storage.
  beforeEach(() => {
    const kept = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) });
  });

  it('brings the email back within the hour, and not after', () => {
    keepSigninSent('someone@example.com', 1_000);
    expect(signinSent(1_000 + 59 * 60 * 1000)).toBe('someone@example.com');
    expect(signinSent(1_000 + 61 * 60 * 1000)).toBe('');
  });

  it('forgets it when asked, and reads nothing from a muddled entry', () => {
    keepSigninSent('someone@example.com');
    keepSigninSent('');
    expect(signinSent()).toBe('');
    sessionStorage.setItem('pattern-maker:signin-sent', 'someone@example.com');
    expect(signinSent()).toBe('');
  });
});
