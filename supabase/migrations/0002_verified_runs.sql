-- Server-checked leaderboard times.
-- A hike is timed by the server: start_run() stamps the start, finish_run() accepts a time only if
-- real time has actually passed (the game clock can run slower than real time, never faster).
-- Direct score submission is closed; only verified runs reach the leaderboard.

create table public.runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trail_id    text not null check (trail_id in ('doi-inthanon-kew-mae-pan', 'phu-kradueng-summit', 'erawan-waterfall', 'khao-sok-ton-kloi')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  claimed_sec integer,
  accepted    boolean
);
create index runs_user_open on public.runs (user_id, trail_id) where finished_at is null;
alter table public.runs enable row level security;
create policy "read own runs" on public.runs for select to authenticated using ((select auth.uid()) = user_id);
-- no insert/update/delete policies: runs change only through the functions below

create function public.start_run(p_trail text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_trail not in ('doi-inthanon-kew-mae-pan', 'phu-kradueng-summit', 'erawan-waterfall', 'khao-sok-ton-kloi') then raise exception 'unknown trail'; end if;
  -- one open run per trail: starting again abandons the previous one
  update public.runs set finished_at = now(), accepted = false where user_id = uid and trail_id = p_trail and finished_at is null;
  -- light rate limit: at most 30 starts per hour
  if (select count(*) from public.runs where user_id = uid and started_at > now() - interval '1 hour') >= 30 then raise exception 'too many runs'; end if;
  insert into public.runs (user_id, trail_id) values (uid, p_trail) returning id into rid;
  return rid;
end;
$$;

-- returns the player's best time on the trail after this run, or null if the run was not accepted
create function public.finish_run(p_run uuid, p_sec integer, p_name text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  r    public.runs%rowtype;
  real_sec numeric;
  ok   boolean;
  name text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), 20);
  best integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from public.runs where id = p_run and user_id = uid for update;
  if not found then raise exception 'unknown run'; end if;
  if r.finished_at is not null then raise exception 'run already finished'; end if;
  real_sec := extract(epoch from (now() - r.started_at));
  -- 5 s grace for network delay; game time can never exceed real time
  ok := p_sec is not null and p_sec between 30 and 21600 and p_sec <= real_sec + 5;
  update public.runs set finished_at = now(), claimed_sec = p_sec, accepted = ok where id = p_run;
  if not ok then return null; end if;
  if name = '' then name := 'Hiker'; end if;
  insert into public.scores as s (user_id, trail_id, best_time_sec, display_name)
  values (uid, r.trail_id, p_sec, name)
  on conflict (user_id, trail_id) do update
    set best_time_sec = least(s.best_time_sec, excluded.best_time_sec),
        display_name  = excluded.display_name,
        updated_at    = case when excluded.best_time_sec < s.best_time_sec then now() else s.updated_at end
  returning best_time_sec into best;
  return best;
end;
$$;

revoke all on function public.start_run(text) from public, anon;
grant execute on function public.start_run(text) to authenticated;
revoke all on function public.finish_run(uuid, integer, text) from public, anon;
grant execute on function public.finish_run(uuid, integer, text) to authenticated;

-- unverified submissions are no longer accepted
revoke execute on function public.submit_score(text, integer, text) from authenticated;
