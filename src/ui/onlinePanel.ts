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
import { authPageOpen, openAuthPage } from './authPage';

const CSS = `
#twt-online{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(15,23,12,.55);font-family:Mitr,"Noto Sans Thai",Tahoma,sans-serif;color:#3a2414}
#twt-online .card{width:min(540px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;background:#f2e2bc;border:4px solid #5c3a1e;box-shadow:inset 0 0 0 3px #fbf0d4,inset 0 -6px 0 3px #e3c98f;padding:0 18px 16px}
#twt-online h2{margin:0 -18px 14px;padding:10px 14px 10px 18px;font-size:19px;color:#fff4dc;text-shadow:0 2px 0 #3a2213;background:#8b5a2b;border-bottom:4px solid #3a2213;box-shadow:inset 0 3px 0 #b47a42;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0}
#twt-online .x{background:#5f3b1c;border:3px solid #2b180c;color:#fff4dc;font-size:16px;cursor:pointer;padding:2px 10px;min-height:36px;border-radius:0}
#twt-online .tabs,#twt-online .trails{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
#twt-online button{font:inherit;border-radius:0;border:3px solid #2b180c;background:#8b5a2b;box-shadow:inset 0 3px 0 #b47a42,inset 0 -3px 0 #5f3b1c;color:#fff4dc;padding:8px 12px;cursor:pointer;min-height:44px}
#twt-online button.on{background:#f2c14e;box-shadow:inset 0 3px 0 #f8dc8a,inset 0 -3px 0 #c99a2e;color:#3a2213;font-weight:600}
#twt-online button.go{background:#5f9e3a;border-color:#24461a;box-shadow:inset 0 4px 0 #8cc65a,inset 0 -5px 0 #3d7326;color:#fff;font-weight:600;text-shadow:0 2px 0 #24461a}
#twt-online button:disabled{background:#c9b48c;border-color:#8a7050;box-shadow:none;color:#7a6a50;cursor:default}
#twt-online input{font:inherit;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:9px 11px;border-radius:0;border:3px solid #5c3a1e;background:#fbf0d4;color:#3a2414;outline:none}
#twt-online input:focus{border-color:#f2c14e;box-shadow:0 0 0 2px #f2c14e}
#twt-online label{font-size:13px;color:#5c4a36}
#twt-online .row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
#twt-online .status{font-size:14px;margin:4px 0 8px}
#twt-online .msg{font-size:13px;color:#3d7326;min-height:18px;margin:6px 0}
#twt-online .note{font-size:12px;color:#7a5a3a;margin-top:10px}
#twt-online table{width:100%;border-collapse:collapse;font-size:14px}
#twt-online td,#twt-online th{padding:7px 6px;border-bottom:3px solid #d8bd84;text-align:left}
#twt-online th{color:#7a5a3a;font-weight:600;font-size:12.5px}
#twt-online tr.me td{color:#3d7326;font-weight:600;background:#fbf0d4}
#twt-online .code{font-family:"Pixelify Sans",Mitr,sans-serif;font-size:42px;letter-spacing:8px;color:#3a2213;text-align:center;margin:8px auto;background:#f2c14e;border:4px solid #3a2213;max-width:260px}
#twt-online input.codeIn{text-transform:uppercase;letter-spacing:6px;font-size:20px;text-align:center}
#twt-online td.num{text-align:right;font-variant-numeric:tabular-nums}
`;

let root: HTMLDivElement | null = null, tab: 'account' | 'board' | 'coop' = 'account', trailId = TRAILS[0].id, onClose: (() => void) | null = null;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
};

/** True while the Online panel or the Log in page is open (game keys pause). */
export const onlinePanelOpen = (): boolean => !!root || authPageOpen();

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
  if (tab === 'account') accountView(card); else if (tab === 'board') boardView(card); else coopView(card);
  root.replaceChildren(card);
  if (focusId) document.getElementById(focusId)?.focus();
}

function accountView(card: HTMLElement): void {
  if (cloud.status === 'off') { card.append(el('div', { className: 'status', textContent: t('on_off') })); return; }
  const status = cloud.signedIn ? (cloud.guest ? t('on_guest') : t('on_signedIn', { e: (cloud.email ?? '') + (cloud.provider === 'google' ? ' (Google)' : '') })) : t('on_signedOut');
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
    // signing in and registering live on their own page (email, Google, forgotten password)
    const open = el('button', { className: 'go', textContent: t('auth_open') });
    open.onclick = () => { const back = onClose; root?.remove(); root = null; cloud.onChange = () => {}; openAuthPage('login', back ?? undefined); };
    card.append(el('div', { className: 'row' }, [open, busy(el('button', { textContent: t('on_guestBtn') }), () => cloud.playAsGuest())]));
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
