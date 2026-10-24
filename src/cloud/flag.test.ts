import { describe, expect, it } from 'vitest';
import { signinArriving } from './flag';

describe('signinArriving', () => {
  it('spots the sign-in link from the email', () => {
    expect(signinArriving('#access_token=abc&expires_in=3600&type=magiclink')).toBe(true);
    expect(signinArriving('#error=access_denied&error_description=Email+link+is+invalid')).toBe(true);
  });
  it('leaves other links alone', () => {
    expect(signinArriving('')).toBe(false);
    expect(signinArriving('#move=xyz')).toBe(false);
  });
});
