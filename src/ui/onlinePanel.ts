/**
 * "Online" panel: account (sign in / sign up / guest / sync) and the per-trail leaderboard.
 * Plain DOM over the canvas so phones get real text fields and password managers work.
 * All text from the server is set with textContent, never as HTML.
 */
import { fmtTime } from '../core/cloud';
import { TRAILS } from '../data/trails';
import { t } from '../i18n';
import { cloud, type BoardRow } from '../net/cloud';
import { COOP_URL, coopPlan } from '../net/coop';
import { cleanRoomCode, newRoomCode } from '../core/coop';

const CSS = `
#twt-online{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(10,20,14,.55);font-family:Mitr,"Noto Sans Thai",Tahoma,sans-serif;color:#f4ecd8}
#twt-online .card{width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;background:rgba(30,36,43,.97);border:2px solid #59626e;border-radius:14px;padding:16px 18px}
#twt-online h2{margin:0 0 10px;font-size:19px;color:#ffe9a8;display:flex;justify-content:space-between;align-items:center}
#twt-online .x{background:none;border:0;color:#cfc3a6;font-size:20px;cursor:pointer;padding:4px 8px}
#twt-online .tabs,#twt-online .trails{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
#twt-online button{font:inherit;border-radius:9px;border:1px solid #59626e;background:#3a4450;color:#f4ecd8;padding:8px 12px;cursor:pointer;min-height:40px}
#twt-online button.on{background:#5a4f2c;border-color:#ffe9a8;color:#ffe9a8}
#twt-online button.go{background:#3f8a2a;border-color:#7cc04a;color:#fff}
#twt-online button:disabled{opacity:.5;cursor:default}
#twt-online input{font:inherit;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:9px 11px;border-radius:8px;border:2px solid #59626e;background:#1b2026;color:#f4ecd8;outline:none}
#twt-online input:focus{border-color:#ffe9a8}
#twt-online label{font-size:13px;color:#cfd6dd}
#twt-online .row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
#twt-online .status{font-size:14px;margin:4px 0 8px}
#twt-online .msg{font-size:13px;color:#cfe3b8;min-height:18px;margin:6px 0}
#twt-online .note{font-size:12px;color:#9aa3ad;margin-top:10px}
#twt-online table{width:100%;border-collapse:collapse;font-size:14px}
#twt-online td,#twt-online th{padding:7px 6px;border-bottom:1px solid #3a4450;text-align:left}
#twt-online th{color:#cfd6dd;font-weight:600;font-size:12.5px}
#twt-online tr.me td{color:#ffe9a8;font-weight:600}
#twt-online .code{font-size:38px;letter-spacing:8px;color:#ffe9a8;text-align:center;margin:8px 0}
#twt-online input.codeIn{text-transform:uppercase;letter-spacing:6px;font-size:20px;text-align:center}
#twt-online td.num{text-align:right;font-variant-numeric:tabular-nums}
`;

let root: HTMLDivElement | null = null, tab: 'account' | 'board' | 'coop' = 'account', trailId = TRAILS[0].id, onClose: (() => void) | null = null;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
};

export const onlinePanelOpen = (): boolean => !!root;

export function openOnlinePanel(close?: () => void): void {
  if (root) return;
  onClose = close ?? null;
  if (!document.getElementById('twt-online-css')) document.head.append(el('style', { id: 'twt-online-css', textContent: CSS }));
  root = el('div', { id: 'twt-online' });
  // keep game keys (WASD, E, Esc…) out of the game while the panel is open
  root.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') closeOnlinePanel(); });
  root.addEventListener('pointerdown', (e) => { if (e.target === root) closeOnlinePanel(); });
  document.body.append(root);
  cloud.onChange = render;
  render();
}

export function closeOnlinePanel(): void {
  if (!root) return;
  root.remove(); root = null; cloud.onChange = () => {};
  onClose?.();
}

function render(): void {
  if (!root) return;
  const focusId = (document.activeElement as HTMLElement | null)?.id;
  const keep = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
  const email = keep('twt-email'), pw = keep('twt-pw');
  const card = el('div', { className: 'card' });
  const close = el('button', { className: 'x', textContent: '✕', title: t('on_close') }); close.onclick = closeOnlinePanel;
  card.append(el('h2', {}, [t('on_title'), close]));
  const tabs = el('div', { className: 'tabs' });
  for (const [id, key] of [['account', 'on_tab_account'], ['board', 'on_tab_board'], ['coop', 'coop_tab']] as const) {
    const b = el('button', { textContent: t(key), className: tab === id ? 'on' : '' });
    b.onclick = () => { tab = id; render(); };
    tabs.append(b);
  }
  card.append(tabs);
  if (tab === 'account') accountView(card, email, pw); else if (tab === 'board') boardView(card); else coopView(card);
  root.replaceChildren(card);
  if (focusId) document.getElementById(focusId)?.focus();
}

function accountView(card: HTMLElement, email: string, pw: string): void {
  if (cloud.status === 'off') { card.append(el('div', { className: 'status', textContent: t('on_off') })); return; }
  const status = cloud.signedIn ? (cloud.guest ? t('on_guest') : t('on_signedIn', { e: cloud.email ?? '' })) : t('on_signedOut');
  card.append(el('div', { className: 'status', textContent: status }));
  if (cloud.status === 'syncing') card.append(el('div', { className: 'msg', textContent: t('on_syncing') }));
  else if (cloud.lastSync && cloud.signedIn) card.append(el('div', { className: 'msg', textContent: t('on_synced', { t: cloud.lastSync.toLocaleTimeString() }) }));
  const busy = (b: HTMLButtonElement, fn: () => Promise<void>) => { b.onclick = async () => { b.disabled = true; try { await fn(); } finally { if (b.isConnected) b.disabled = false; render(); } }; return b; };

  if (cloud.signedIn) {
    card.append(el('div', { className: 'row' }, [
      busy(el('button', { className: 'go', textContent: t('on_syncNow') }), () => cloud.sync()),
      busy(el('button', { textContent: t('on_signOut') }), () => cloud.signOut()),
    ]));
  } else {
    const e = el('input', { id: 'twt-email', type: 'email', autocomplete: 'email', value: email, placeholder: 'you@example.com' });
    const p = el('input', { id: 'twt-pw', type: 'password', autocomplete: 'current-password', value: pw, minLength: 6 });
    p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') void cloud.signIn(e.value, p.value).then(render); });
    card.append(el('label', { htmlFor: 'twt-email', textContent: t('on_email') }), e, el('label', { htmlFor: 'twt-pw', textContent: t('on_password') }), p);
    card.append(el('div', { className: 'row' }, [
      busy(el('button', { className: 'go', textContent: t('on_signIn') }), () => cloud.signIn(e.value, p.value)),
      busy(el('button', { textContent: t('on_signUp') }), () => cloud.signUp(e.value, p.value)),
      busy(el('button', { textContent: t('on_guestBtn') }), () => cloud.playAsGuest()),
    ]));
  }
  if (cloud.message) card.append(el('div', { className: 'msg', textContent: cloud.message }));
  card.append(el('div', { className: 'note', textContent: t('on_note') }));
}

let boardReq = 0;
function boardView(card: HTMLElement): void {
  const trails = el('div', { className: 'trails' });
  for (const tr of TRAILS) {
    const b = el('button', { textContent: t(tr.trailKey), className: tr.id === trailId ? 'on' : '' });
    b.onclick = () => { trailId = tr.id; render(); };
    trails.append(b);
  }
  card.append(trails, el('div', { className: 'note', textContent: t('on_boardHint') }));
  const box = el('div', { className: 'msg', textContent: t('on_loading') });
  card.append(box);
  if (cloud.status === 'off') { box.textContent = t('on_off'); return; }
  const req = ++boardReq, want = trailId;
  cloud.leaderboard(want).then((rows: BoardRow[]) => {
    if (req !== boardReq || !box.isConnected) return;
    if (!rows.length) { box.textContent = t('on_boardEmpty'); return; }
    const table = el('table', {}, [el('tr', {}, [el('th', { textContent: t('on_rank') }), el('th', { textContent: t('on_name') }), el('th', { textContent: t('on_time'), className: 'num' })])]);
    for (const r of rows) {
      const tr = el('tr', { className: r.is_me ? 'me' : '' }, [
        el('td', { textContent: `#${r.rank}` }),
        el('td', { textContent: r.display_name + (r.is_me ? ` (${t('on_boardMe')})` : '') }),
        el('td', { textContent: fmtTime(r.best_time_sec), className: 'num' }),
      ]);
      table.append(tr);
    }
    box.replaceWith(table);
  }).catch((e: Error) => { if (box.isConnected) box.textContent = t('on_err', { m: e.message }); });
}

function coopView(card: HTMLElement): void {
  if (!COOP_URL) { card.append(el('div', { className: 'status', textContent: t('coop_noServer') })); return; }
  if (coopPlan.room) {
    card.append(el('div', { className: 'status', textContent: t('coop_inPlan') }));
    card.append(el('div', { className: 'code', textContent: coopPlan.room }));
    const leave = el('button', { textContent: t('coop_leavePlan') }); leave.onclick = () => { coopPlan.room = null; render(); };
    card.append(el('div', { className: 'row' }, [leave]));
  } else {
    const create = el('button', { className: 'go', textContent: t('coop_create') }); create.onclick = () => { coopPlan.room = newRoomCode(); render(); };
    const code = el('input', { id: 'twt-room', className: 'codeIn', maxLength: 4, placeholder: 'ABCD', autocomplete: 'off' });
    const join = el('button', { textContent: t('coop_join') });
    const msg = el('div', { className: 'msg' });
    join.onclick = () => { const c = cleanRoomCode(code.value); if (c) { coopPlan.room = c; render(); } else msg.textContent = t('coop_badCode'); };
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') join.click(); });
    card.append(el('div', { className: 'row' }, [create]), el('label', { htmlFor: 'twt-room', textContent: t('coop_code') }), code, el('div', { className: 'row' }, [join]), msg);
  }
  card.append(el('div', { className: 'note', textContent: t('coop_how') }));
  if (!cloud.signedIn) card.append(el('div', { className: 'note', textContent: t('coop_needSignIn') }));
}
