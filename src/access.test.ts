import { describe, expect, it } from 'vitest';
import { ACCESS_KEY, hasAccess, rememberAccess, testerFromLink, withoutTester } from './access';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('waitlist access', () => {
  it('lets in a device with a tester code or one let in before, and nobody else', () => {
    const store = memory();
    expect(hasAccess(undefined, store)).toBe(false);
    expect(hasAccess('TOILE-ONE', store)).toBe(true);
    rememberAccess(store);
    expect(store.getItem(ACCESS_KEY)).toBe('tester');
    expect(hasAccess(undefined, store)).toBe(true);
  });

  it('reads the code off a tester link', () => {
    expect(testerFromLink('?tester=TOILE-ONE')).toBe('TOILE-ONE');
    expect(testerFromLink('?src=ig&tester=%20toile-two%20')).toBe('toile-two');
    expect(testerFromLink('?src=ig')).toBeUndefined();
    expect(testerFromLink('?tester=')).toBeUndefined();
  });

  it('drops the code from the address but keeps where the visitor came from', () => {
    expect(withoutTester('/', '?tester=TOILE-ONE', '')).toBe('/');
    expect(withoutTester('/', '?src=ig&tester=TOILE-ONE', '#x')).toBe('/?src=ig#x');
  });
});
