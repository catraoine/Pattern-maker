import { describe, expect, it } from 'vitest';
import { signinArriving, signinFailedIn } from './flag';

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

describe('signinFailedIn', () => {
  it('spots a refused sign-in in the address, however the service sends it back', () => {
    expect(signinFailedIn('?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange', '')).toBe(true);
    expect(signinFailedIn('', '#error=access_denied&error_description=Email+link+is+invalid')).toBe(true);
    expect(signinFailedIn('?signin=preview', '#access_token=abc')).toBe(false);
  });
});
