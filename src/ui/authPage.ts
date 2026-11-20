/**
 * Log in / Register page: email + password, Google sign-in, forgotten password and choosing a new one.
 * Plain DOM over the canvas (real form fields, password managers, phone keyboards), styled as the
 * game's wood sign over notebook paper. Accounts stay optional: "Play without an account" keeps
 * the save on this device only. Server text is always set with textContent, never as HTML.
 */
import { checkLogin, checkNewPassword, checkRegister, passwordStrength, PASSWORD_MIN, validEmail } from '../core/auth';
import { t } from '../i18n';
import { cloud } from '../net/cloud';

type Mode = 'login' | 'register' | 'forgot' | 'recover' | 'done';
const SKIP_KEY = 'twt-auth-skip';

const CSS = `
#twt-auth{position:fixed;inset:0;z-index:21;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(15,23,12,.6);font-family:Mitr,"Noto Sans Thai",Tahoma,sans-serif;color:#3a2414;overflow:auto}
#twt-auth .card{width:min(440px,100%);max-height:100%;overflow:auto;box-sizing:border-box;background:#f2e2bc;border:4px solid #5c3a1e;box-shadow:inset 0 0 0 3px #fbf0d4,inset 0 -6px 0 3px #e3c98f}
#twt-auth .head{position:relative;background:#8b5a2b;border-bottom:4px solid #3a2213;box-shadow:inset 0 3px 0 #b47a42;padding:14px 56px 12px;text-align:center;color:#fff4dc}
#twt-auth .logo{font-family:"Pixelify Sans",Mitr,sans-serif;font-weight:700;font-size:clamp(18px,5.6vw,26px);line-height:1;text-shadow:0 3px 0 #3a2213;letter-spacing:1px}
#twt-auth .logo b{color:#a3dd7a;font-weight:700}
#twt-auth .tag{font-size:13px;color:#f2d9a8;margin-top:6px}
#twt-auth .x{position:absolute;right:10px;top:10px;background:#5f3b1c;border:3px solid #2b180c;color:#fff4dc;font:inherit;font-size:15px;min-width:40px;min-height:40px;cursor:pointer}
#twt-auth .body{padding:16px 20px 18px}
#twt-auth .tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px}
#twt-auth .tabs button{font:inherit;font-size:15px;min-height:44px;cursor:pointer;border:3px solid #2b180c;background:#8b5a2b;color:#fff4dc;box-shadow:inset 0 3px 0 #b47a42,inset 0 -3px 0 #5f3b1c}
#twt-auth .tabs button[aria-selected=true]{background:#f2c14e;color:#3a2213;font-weight:600;box-shadow:inset 0 3px 0 #f8dc8a,inset 0 -3px 0 #c99a2e}
#twt-auth h2{margin:0 0 10px;font-size:18px}
#twt-auth .google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;font:inherit;font-size:15px;font-weight:500;min-height:48px;cursor:pointer;background:#fff;color:#1f1f1f;border:3px solid #5c3a1e;box-shadow:inset 0 -3px 0 #e3dccb}
#twt-auth .google:disabled{opacity:.6;cursor:default}
#twt-auth .or{display:flex;align-items:center;gap:10px;margin:14px 0 8px;font-size:12.5px;color:#7a5a3a}
#twt-auth .or::before,#twt-auth .or::after{content:"";flex:1;height:3px;background:#d8bd84}
#twt-auth label{display:block;font-size:13px;color:#5c4a36;margin-top:8px}
#twt-auth .field{position:relative}
#twt-auth input{font:inherit;width:100%;box-sizing:border-box;margin:4px 0 0;padding:10px 12px;border-radius:0;border:3px solid #5c3a1e;background:#fbf0d4;color:#3a2414;outline:none;min-height:44px}
#twt-auth input:focus{border-color:#f2c14e;box-shadow:0 0 0 2px #f2c14e}
#twt-auth input[aria-invalid=true]{border-color:#b23a22}
#twt-auth .eye{position:absolute;right:4px;bottom:4px;min-width:40px;min-height:36px;background:none;border:0;cursor:pointer;font-size:16px}
#twt-auth .meter{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px}
#twt-auth .meter i{height:8px;background:#d8bd84}
#twt-auth .meter.s1 i:nth-child(1){background:#d9583b}
#twt-auth .meter.s2 i:nth-child(-n+2){background:#e39b3a}
#twt-auth .meter.s3 i{background:#5f9e3a}
#twt-auth .hint{font-size:12px;color:#7a5a3a;margin-top:4px}
#twt-auth .go{width:100%;margin-top:14px;font:inherit;font-size:17px;font-weight:600;min-height:50px;cursor:pointer;color:#fff;text-shadow:0 2px 0 #24461a;background:#5f9e3a;border:4px solid #24461a;box-shadow:inset 0 4px 0 #8cc65a,inset 0 -5px 0 #3d7326}
#twt-auth .go:disabled{background:#c9b48c;border-color:#8a7050;box-shadow:none;color:#7a6a50;text-shadow:none;cursor:default}
#twt-auth .link{background:none;border:0;padding:6px 0;font:inherit;font-size:13px;color:#1f6fa3;text-decoration:underline;cursor:pointer;min-height:32px}
#twt-auth .row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
#twt-auth .msg{font-size:13.5px;margin-top:10px;padding:8px 10px;background:#fbf0d4;border:3px solid #d8bd84;color:#3d7326}
#twt-auth .msg.err{color:#8a2412;border-color:#d9583b}
#twt-auth .skip{margin-top:16px;padding-top:10px;border-top:3px solid #d8bd84;text-align:center}
#twt-auth .skip .note{font-size:12px;color:#7a5a3a}
#twt-auth .who{font-size:15px;margin:4px 0 2px;word-break:break-all}
`;

const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

let root: HTMLDivElement | null = null, mode: Mode = 'login', localErr = '', busy = false, onClose: (() => void) | null = null, closeOnSignIn = true;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
};
const skipStored = (): boolean => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; } };
const storeSkip = (): void => { try { localStorage.setItem(SKIP_KEY, '1'); } catch { /* private mode */ } };

export const authPageOpen = (): boolean => !!root;

/** Opens the page. `start` picks the first tab; the game keeps running behind it. */
export function openAuthPage(start: Mode = 'login', close?: () => void): void {
  if (cloud.status === 'off') return;
  mode = cloud.recovering ? 'recover' : start; localErr = ''; onClose = close ?? null; closeOnSignIn = mode !== 'recover';
  if (root) { render(); return; }
  if (!document.getElementById('twt-auth-css')) document.head.append(el('style', { id: 'twt-auth-css', textContent: CSS }));
  root = el('div', { id: 'twt-auth' });
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'twt-auth-title');
  root.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && mode !== 'recover') closeAuthPage(); });
  document.body.append(root);
  cloud.onChange = render;
  render();
  (root.querySelector('input') as HTMLInputElement | null)?.focus();
}

export function closeAuthPage(): void {
  if (!root) return;
  root.remove(); root = null; cloud.onChange = () => {};
  onClose?.();
}

/**
 * Called once at start-up: shows the page to players who aren't signed in and haven't chosen to play
 * without an account, and always for a password-reset link or a failed Google redirect.
 */
export function initAuthPage(): void {
  cloud.authListeners.push((event) => {
    if (event === 'PASSWORD_RECOVERY') openAuthPage('recover');
    if (event === 'SIGNED_IN' && root && closeOnSignIn && mode !== 'recover') { mode = 'done'; render(); setTimeout(() => { if (mode === 'done') closeAuthPage(); }, 1400); }
  });
  const t0 = Date.now();
  const wait = setInterval(() => {
    if (!cloud.ready && Date.now() - t0 < 4000) return;
    clearInterval(wait);
    if (cloud.status === 'off' || root) return;
    if (cloud.recovering) openAuthPage('recover');
    else if (!cloud.signedIn && (cloud.message || !skipStored())) openAuthPage('login');
  }, 150);
}

// ---------- rendering ----------
function render(): void {
  if (!root) return;
  const keep = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
  const vals = { email: keep('auth-email'), pw: keep('auth-pw'), pw2: keep('auth-pw2') };
  const focusId = (document.activeElement as HTMLElement | null)?.id;

  const card = el('div', { className: 'card' });
  const head = el('div', { className: 'head' });
  const logo = el('div', { className: 'logo', id: 'twt-auth-title' }); logo.append('THAILAND ', el('b', { textContent: 'WILD TRAILS' }));
  head.append(logo, el('div', { className: 'tag', textContent: t('ui_tagline') }));
  if (mode !== 'recover') { const x = el('button', { className: 'x', type: 'button', textContent: '✕' }); x.setAttribute('aria-label', t('on_close')); x.onclick = closeAuthPage; head.append(x); }
  const body = el('div', { className: 'body' });
  card.append(head, body);

  if (mode === 'login' || mode === 'register') body.append(tabs());
  if (mode === 'login') loginView(body, vals);
  else if (mode === 'register') registerView(body, vals);
  else if (mode === 'forgot') forgotView(body, vals);
  else if (mode === 'recover') recoverView(body, vals);
  else doneView(body);

  const msg = localErr || cloud.message;
  if (msg) {
    const m = el('div', { className: 'msg' + (localErr || cloud.status === 'error' ? ' err' : ''), textContent: msg });
    m.setAttribute('role', localErr || cloud.status === 'error' ? 'alert' : 'status');
    body.append(m);
  }
  if (mode === 'login' || mode === 'register') {
    const skip = el('div', { className: 'skip' });
    const b = el('button', { className: 'link', type: 'button', textContent: t('auth_skip') });
    b.onclick = () => { storeSkip(); closeAuthPage(); };
    skip.append(b, el('div', { className: 'note', textContent: t('auth_skip_note') }));
    body.append(skip);
  }
  root.replaceChildren(card);
  if (focusId) document.getElementById(focusId)?.focus();
}

function tabs(): HTMLElement {
  const box = el('div', { className: 'tabs' }); box.setAttribute('role', 'tablist');
  for (const [m, key] of [['login', 'auth_login'], ['register', 'auth_register']] as const) {
    const b = el('button', { type: 'button', textContent: t(key) });
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(mode === m));
    b.onclick = () => { mode = m; localErr = ''; cloud.message = ''; render(); };
    box.append(b);
  }
  return box;
}

function googleButton(label: string): HTMLButtonElement {
  const b = el('button', { className: 'google', type: 'button', disabled: busy });
  b.innerHTML = GOOGLE_G; // static, trusted markup (logo only)
  b.append(el('span', { textContent: label }));
  b.onclick = () => run(() => cloud.signInWithGoogle());
  return b;
}

function input(id: string, type: string, value: string, autocomplete: AutoFill, labelKey: string, extra: Partial<HTMLInputElement> = {}): HTMLElement[] {
  const label = el('label', { htmlFor: id, textContent: t(labelKey) });
  const i = el('input', { id, type, value, autocomplete, ...extra });
  if (localErr && ((id === 'auth-email' && /email/.test(localErrKey)) || (id !== 'auth-email' && /pw/.test(localErrKey)))) i.setAttribute('aria-invalid', 'true');
  if (type !== 'password') return [label, i];
  const f = el('div', { className: 'field' }, [i]);
  const eye = el('button', { className: 'eye', type: 'button', textContent: '👁' });
  eye.setAttribute('aria-label', t('auth_show_pw'));
  eye.onclick = () => { i.type = i.type === 'password' ? 'text' : 'password'; i.focus(); };
  f.append(eye);
  return [label, f];
}

let localErrKey = '';
function setErr(key: string | null): boolean { localErrKey = key ?? ''; localErr = key ? t(key, { n: PASSWORD_MIN }) : ''; if (key) render(); return !key; }

async function run(fn: () => Promise<unknown>): Promise<void> {
  if (busy) return;
  busy = true; localErr = ''; localErrKey = ''; render();
  try { await fn(); } finally { busy = false; render(); }
}

function form(body: HTMLElement, submit: () => void, kids: (Node | string)[]): void {
  const f = el('form', {}, kids);
  f.noValidate = true;
  f.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  body.append(f);
}

function loginView(body: HTMLElement, v: { email: string; pw: string }): void {
  body.append(el('h2', { textContent: t('auth_login_title') }), googleButton(t('auth_google_login')), el('div', { className: 'or', textContent: t('auth_or_email') }));
  const forgot = el('button', { className: 'link', type: 'button', textContent: t('auth_forgot') });
  forgot.onclick = () => { mode = 'forgot'; localErr = ''; cloud.message = ''; render(); };
  form(body, () => {
    const email = (document.getElementById('auth-email') as HTMLInputElement).value, pw = (document.getElementById('auth-pw') as HTMLInputElement).value;
    if (setErr(checkLogin(email, pw))) void run(() => cloud.signIn(email, pw));
  }, [
    ...input('auth-email', 'email', v.email, 'email', 'on_email', { placeholder: 'you@gmail.com', inputMode: 'email' }),
    ...input('auth-pw', 'password', v.pw, 'current-password', 'auth_password'),
    el('div', { className: 'row' }, [forgot]),
    el('button', { className: 'go', type: 'submit', textContent: busy ? t('auth_wait') : t('auth_login_btn'), disabled: busy }),
  ]);
}

function registerView(body: HTMLElement, v: { email: string; pw: string; pw2: string }): void {
  body.append(el('h2', { textContent: t('auth_register_title') }), googleButton(t('auth_google_register')), el('div', { className: 'or', textContent: t('auth_or_email') }));
  const meter = el('div', { className: 'meter s' + passwordStrength(v.pw) }, [el('i'), el('i'), el('i')]);
  meter.setAttribute('aria-hidden', 'true');
  const hint = el('div', { className: 'hint', id: 'auth-pw-hint', textContent: t('auth_pw_hint', { n: PASSWORD_MIN }) + (v.pw ? ' · ' + t('auth_strength_' + passwordStrength(v.pw)) : '') });
  const pwFields = input('auth-pw', 'password', v.pw, 'new-password', 'auth_password', { minLength: PASSWORD_MIN });
  const pwInput = (pwFields[1] as HTMLElement).querySelector('input')!;
  pwInput.setAttribute('aria-describedby', 'auth-pw-hint');
  pwInput.addEventListener('input', () => {
    const s = passwordStrength(pwInput.value);
    meter.className = 'meter s' + s;
    hint.textContent = t('auth_pw_hint', { n: PASSWORD_MIN }) + (pwInput.value ? ' · ' + t('auth_strength_' + s) : '');
  });
  form(body, () => {
    const email = (document.getElementById('auth-email') as HTMLInputElement).value, pw = pwInput.value, pw2 = (document.getElementById('auth-pw2') as HTMLInputElement).value;
    if (setErr(checkRegister(email, pw, pw2))) void run(() => cloud.signUp(email, pw));
  }, [
    ...input('auth-email', 'email', v.email, 'email', 'on_email', { placeholder: 'you@gmail.com', inputMode: 'email' }),
    ...pwFields, meter, hint,
    ...input('auth-pw2', 'password', v.pw2, 'new-password', 'auth_password2'),
    el('button', { className: 'go', type: 'submit', textContent: busy ? t('auth_wait') : t('auth_register_btn'), disabled: busy }),
    el('div', { className: 'hint', textContent: t('auth_register_note') }),
  ]);
}

function forgotView(body: HTMLElement, v: { email: string }): void {
  body.append(el('h2', { textContent: t('auth_forgot_title') }), el('div', { className: 'hint', textContent: t('auth_forgot_note') }));
  const back = el('button', { className: 'link', type: 'button', textContent: '← ' + t('auth_back_login') });
  back.onclick = () => { mode = 'login'; localErr = ''; cloud.message = ''; render(); };
  form(body, () => {
    const email = (document.getElementById('auth-email') as HTMLInputElement).value;
    if (setErr(validEmail(email) ? null : 'auth_err_email')) void run(() => cloud.resetPassword(email));
  }, [
    ...input('auth-email', 'email', v.email, 'email', 'on_email', { placeholder: 'you@gmail.com', inputMode: 'email' }),
    el('button', { className: 'go', type: 'submit', textContent: busy ? t('auth_wait') : t('auth_send_link'), disabled: busy }),
    el('div', { className: 'row' }, [back]),
  ]);
}

function recoverView(body: HTMLElement, v: { pw: string; pw2: string }): void {
  body.append(el('h2', { textContent: t('auth_new_pw_title') }), el('div', { className: 'hint', textContent: t('auth_pw_hint', { n: PASSWORD_MIN }) }));
  form(body, () => {
    const pw = (document.getElementById('auth-pw') as HTMLInputElement).value, pw2 = (document.getElementById('auth-pw2') as HTMLInputElement).value;
    if (setErr(checkNewPassword(pw, pw2))) void run(async () => { if (await cloud.updatePassword(pw)) { mode = 'done'; closeOnSignIn = true; } });
  }, [
    ...input('auth-pw', 'password', v.pw, 'new-password', 'auth_password'),
    ...input('auth-pw2', 'password', v.pw2, 'new-password', 'auth_password2'),
    el('button', { className: 'go', type: 'submit', textContent: busy ? t('auth_wait') : t('auth_save_pw'), disabled: busy }),
  ]);
}

function doneView(body: HTMLElement): void {
  const via = cloud.provider === 'google' ? ' (Google)' : '';
  body.append(el('h2', { textContent: '✓ ' + t('auth_done') }), el('div', { className: 'who', textContent: (cloud.email ?? '') + via }),
    el('div', { className: 'hint', textContent: t('on_note') }));
  const go = el('button', { className: 'go', type: 'button', textContent: t('auth_continue') });
  go.onclick = closeAuthPage;
  body.append(go);
}
