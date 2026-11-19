/**
 * Accounts, cloud save and leaderboard on Supabase. Everything here is optional:
 * without the VITE_SUPABASE_* settings (or offline) the game plays exactly as before.
 * The merge rules are in core/cloud.ts; the database rules in supabase/migrations.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { displayName, pickSave, readRemoteSave, saveFitsCloud } from '../core/cloud';
import { saveListeners, saveProfile, type Profile } from '../core/profile';
import { t } from '../i18n';

export type CloudStatus = 'off' | 'signedOut' | 'syncing' | 'synced' | 'error';
export interface BoardRow { rank: number; display_name: string; best_time_sec: number; is_me: boolean }

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const UPLOAD_DELAY_MS = 4000;

class Cloud {
  readonly client: SupabaseClient | null = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  status: CloudStatus = this.client ? 'signedOut' : 'off';
  email: string | null = null;
  guest = false;
  lastSync: Date | null = null;
  message = '';
  private userId: string | null = null;
  private getProfile: () => Profile = () => { throw new Error('cloud not started'); };
  private replaceProfile: (p: Profile) => void = () => {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private applying = false;
  /** UI re-renders when this fires. */
  onChange: () => void = () => {};

  get signedIn(): boolean { return !!this.userId; }

  /** Wires the cloud to the game's profile and restores a previous session if there is one. */
  async start(getProfile: () => Profile, replaceProfile: (p: Profile) => void): Promise<void> {
    this.getProfile = getProfile; this.replaceProfile = replaceProfile;
    if (!this.client) return;
    saveListeners.push(() => { if (!this.applying) this.scheduleUpload(); });
    this.client.auth.onAuthStateChange((event, session) => {
      const uid = session?.user.id ?? null, changed = uid !== this.userId;
      this.userId = uid;
      this.email = session?.user.email ?? null;
      this.guest = !!session?.user.is_anonymous;
      if (!uid) { this.status = 'signedOut'; this.emit(); return; }
      if (changed && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) void this.sync();
      else this.emit();
    });
  }

  private emit(): void { try { this.onChange(); } catch { /* UI closed */ } }
  private fail(e: unknown): void {
    this.status = 'error';
    this.message = t('on_err', { m: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
    this.emit();
  }

  // ---------- account ----------
  async signIn(email: string, password: string): Promise<void> {
    if (!this.client) return;
    this.message = '';
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) this.fail(error);
  }
  async signUp(email: string, password: string): Promise<void> {
    if (!this.client) return;
    this.message = '';
    const { data, error } = await this.client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) { this.fail(error); return; }
    if (!data.session) { this.message = t('on_checkMail'); this.emit(); }
  }
  async playAsGuest(): Promise<void> {
    if (!this.client) return;
    this.message = '';
    const { error } = await this.client.auth.signInAnonymously();
    if (error) { this.status = 'error'; this.message = /anonymous/i.test(error.message) ? t('on_guestOff') : t('on_err', { m: error.message }); this.emit(); }
  }
  async signOut(): Promise<void> {
    if (!this.client) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; await this.upload(); }
    await this.client.auth.signOut();
  }

  // ---------- save ----------
  /** Pulls the cloud save, keeps whichever got further, and pushes if this device is ahead. */
  async sync(): Promise<void> {
    if (!this.client || !this.userId) return;
    this.status = 'syncing'; this.message = ''; this.emit();
    try {
      const { data, error } = await this.client.from('saves').select('data').eq('user_id', this.userId).maybeSingle();
      if (error) throw error;
      const remote = data ? readRemoteSave(data.data) : null, local = this.getProfile();
      const pick = pickSave(local, remote);
      if (pick === 'remote' && remote) {
        this.applying = true;
        try { saveProfile(remote); this.replaceProfile(remote); } finally { this.applying = false; }
        this.message = t('on_pulled');
      } else if (pick === 'local') {
        await this.upload();
        this.message = t('on_pushed');
      }
      await this.submitScores();
      this.status = 'synced'; this.lastSync = new Date(); this.emit();
    } catch (e) { this.fail(e); }
  }

  private scheduleUpload(): void {
    if (!this.userId) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.upload().then(() => this.submitScores()).catch((e) => this.fail(e)); }, UPLOAD_DELAY_MS);
  }

  private async upload(): Promise<void> {
    if (!this.client || !this.userId) return;
    const p = this.getProfile();
    if (!saveFitsCloud(p)) throw new Error('save too large');
    const { error } = await this.client.from('saves').upsert({ user_id: this.userId, data: p, updated_at: new Date().toISOString() });
    if (error) throw error;
    this.status = 'synced'; this.lastSync = new Date(); this.emit();
  }

  // ---------- leaderboard ----------
  /** Leaderboard times are timed by the server: it stamps the start and checks the finish against real time. */
  private async submitScores(): Promise<void> { /* only verified runs count now (startRun / finishRun) */ }

  async startRun(trailId: string): Promise<string | null> {
    if (!this.client || !this.userId) return null;
    const { data, error } = await this.client.rpc('start_run', { p_trail: trailId });
    return error ? null : (data as string);
  }

  /** Returns the best verified time after this run, or null if not accepted / offline. */
  async finishRun(runId: string | null, sec: number): Promise<number | null> {
    if (!this.client || !this.userId || !runId) return null;
    const { data, error } = await this.client.rpc('finish_run', { p_run: runId, p_sec: Math.round(sec), p_name: displayName(this.getProfile(), t('on_hiker')) });
    return error ? null : (data as number | null);
  }
  /** The current session's access token (the co-op server checks it with Supabase). */
  async accessToken(): Promise<string | null> {
    if (!this.client || !this.userId) return null;
    const { data } = await this.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async leaderboard(trailId: string, limit = 10): Promise<BoardRow[]> {
    if (!this.client) return [];
    const { data, error } = await this.client.rpc('get_leaderboard', { p_trail: trailId, p_limit: limit });
    if (error) throw error;
    return (data ?? []) as BoardRow[];
  }
}

export const cloud = new Cloud();
