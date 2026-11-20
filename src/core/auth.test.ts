import { describe, expect, it } from 'vitest';
import { authErrorKey, checkLogin, checkNewPassword, checkRegister, oauthError, passwordStrength, stripOauthError, validEmail } from './auth';

describe('auth form checks', () => {
  it('accepts real-looking emails only', () => {
    expect(validEmail('hiker@gmail.com')).toBe(true);
    expect(validEmail('  hiker@mail.co.th ')).toBe(true);
    for (const bad of ['', 'hiker', 'hiker@', '@gmail.com', 'hi ker@gmail.com', 'hiker@gmail', 'hiker@gmail.c']) expect(validEmail(bad)).toBe(false);
  });
  it('checks the login form', () => {
    expect(checkLogin('x', 'pw')).toBe('auth_err_email');
    expect(checkLogin('a@b.co', '')).toBe('auth_err_pw_empty');
    expect(checkLogin('a@b.co', 'pw')).toBeNull();
  });
  it('checks the register form: email, length, then match', () => {
    expect(checkRegister('nope', 'longenough1', 'longenough1')).toBe('auth_err_email');
    expect(checkRegister('a@b.co', 'short', 'short')).toBe('auth_err_pw_short');
    expect(checkRegister('a@b.co', 'longenough1', 'longenough2')).toBe('auth_err_pw_match');
    expect(checkRegister('a@b.co', 'longenough1', 'longenough1')).toBeNull();
    expect(checkNewPassword('longenough1', 'longenough1')).toBeNull();
    expect(checkNewPassword('short', 'short')).toBe('auth_err_pw_short');
  });
  it('rates password strength', () => {
    expect(passwordStrength('abc')).toBe(0);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefg1')).toBe(1);
    expect(passwordStrength('Abcdefg1')).toBe(2);
    expect(passwordStrength('Abcdefg1!')).toBe(3);
    expect(passwordStrength('abcdefghij12!@')).toBe(3);
  });
});

describe('OAuth redirect errors', () => {
  it('reads the error from the query or the hash', () => {
    expect(oauthError('https://x.io/game/?error=access_denied&error_description=User+cancelled')).toBe('User cancelled');
    expect(oauthError('https://x.io/game/#error=server_error&error_description=Unable%20to%20exchange')).toBe('Unable to exchange');
    expect(oauthError('https://x.io/game/?trail=a')).toBeNull();
  });
  it('removes only the error parameters', () => {
    expect(stripOauthError('https://x.io/game/?trail=a&error=x&error_description=y')).toBe('https://x.io/game/?trail=a');
    expect(stripOauthError('https://x.io/game/#error=x')).toBe('https://x.io/game/');
  });
  it('maps known server messages to friendly keys', () => {
    expect(authErrorKey('Invalid login credentials')).toBe('auth_err_wrong');
    expect(authErrorKey('Email not confirmed')).toBe('auth_err_unconfirmed');
    expect(authErrorKey('User already registered')).toBe('auth_err_exists');
    expect(authErrorKey('Unsupported provider: provider is not enabled')).toBe('auth_err_google_off');
    expect(authErrorKey('something new')).toBeNull();
  });
});
