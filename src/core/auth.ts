/**
 * Log in / register rules that don't need a server: form checks, password strength,
 * and reading the error an OAuth provider (Google) sends back in the redirect URL.
 * Every check returns an i18n key (or null when the input is fine).
 */

export const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export const validEmail = (email: string): boolean => EMAIL_RE.test(email.trim());

export function checkLogin(email: string, password: string): string | null {
  if (!validEmail(email)) return 'auth_err_email';
  if (!password) return 'auth_err_pw_empty';
  return null;
}

export function checkRegister(email: string, password: string, confirm: string): string | null {
  if (!validEmail(email)) return 'auth_err_email';
  if (password.length < PASSWORD_MIN) return 'auth_err_pw_short';
  if (password !== confirm) return 'auth_err_pw_match';
  return null;
}

export function checkNewPassword(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN) return 'auth_err_pw_short';
  if (password !== confirm) return 'auth_err_pw_match';
  return null;
}

/** 0 = too short, 1 = weak, 2 = fair, 3 = strong (length plus mixing letters, digits and symbols). */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < PASSWORD_MIN) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const score = kinds + (pw.length >= 12 ? 1 : 0);
  return score >= 4 ? 3 : score >= 3 ? 2 : 1;
}

/**
 * An OAuth redirect that failed comes back as ?error=…&error_description=… (or in the #hash).
 * Returns the readable description, or null when the URL carries no error.
 */
export function oauthError(href: string): string | null {
  const u = new URL(href);
  for (const part of [u.search.slice(1), u.hash.slice(1)]) {
    const q = new URLSearchParams(part);
    if (q.get('error') || q.get('error_description')) return (q.get('error_description') || q.get('error') || '').replace(/\+/g, ' ');
  }
  return null;
}

/** The same URL without OAuth error parameters, so a reload doesn't show the error again. */
export function stripOauthError(href: string): string {
  const u = new URL(href);
  for (const k of ['error', 'error_code', 'error_description']) u.searchParams.delete(k);
  if (/(^|&)error/.test(u.hash.slice(1))) u.hash = '';
  return u.toString();
}

/** Supabase error text → our own message key when we know it, else null (show the server's text). */
export function authErrorKey(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'auth_err_wrong';
  if (m.includes('email not confirmed')) return 'auth_err_unconfirmed';
  if (m.includes('already registered') || m.includes('already been registered')) return 'auth_err_exists';
  if (m.includes('rate limit') || m.includes('too many')) return 'auth_err_rate';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'auth_err_google_off';
  return null;
}
