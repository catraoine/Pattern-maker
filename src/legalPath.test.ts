import { describe, expect, it } from 'vitest';
import { legalPath } from './legal';

// Google's sign-in setup asks for the privacy policy's own web address (Nov 6).
describe('legalPath', () => {
  it('opens the policy and terms from their own addresses', () => {
    expect(legalPath('/privacy')).toBe('privacy');
    expect(legalPath('/privacy/')).toBe('privacy');
    expect(legalPath('/Terms')).toBe('terms');
  });
  it('leaves every other address to the welcome', () => {
    expect(legalPath('/')).toBeUndefined();
    expect(legalPath('/privacy-policy')).toBeUndefined();
  });
});
