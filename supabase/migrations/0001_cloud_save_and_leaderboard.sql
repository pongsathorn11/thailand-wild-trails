-- THAILAND WILD TRAILS: cloud saves and per-trail leaderboard.
-- Row Level Security on everything. Players can read and write only their own save.
-- Scores can only be written through submit_score(), which validates the time and keeps the best one.
-- The public leaderboard is read through get_leaderboard(), which never exposes user ids.

-- ---------- saves ----------
create table public.saves (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;

create policy "read own save"   on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own save" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own save" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own save" on public.saves for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- scores ----------
create table public.scores (
  user_id       uuid not null references auth.users (id) on delete cascade,
  trail_id      text not null check (trail_id in ('doi-inthanon-kew-mae-pan', 'phu-kradueng-summit', 'erawan-waterfall', 'khao-sok-ton-kloi')),
  best_time_sec integer not null check (best_time_sec between 30 and 21600),
  display_name  text not null check (char_length(display_name) between 1 and 20),
  updated_at    timestamptz not null default now(),
  primary key (user_id, trail_id)
);
create index scores_trail_time on public.scores (trail_id, best_time_sec, updated_at);
alter table public.scores enable row level security;

-- players may see their own rows; nobody writes directly (no insert/update policies)
create policy "read own scores" on public.scores for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- functions ----------
create function public.submit_score(p_trail text, p_sec integer, p_name text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  name text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), 20);
  best integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_trail not in ('doi-inthanon-kew-mae-pan', 'phu-kradueng-summit', 'erawan-waterfall', 'khao-sok-ton-kloi') then raise exception 'unknown trail'; end if;
  if p_sec is null or p_sec < 30 or p_sec > 21600 then raise exception 'time out of range'; end if;
  if name = '' then name := 'Hiker'; end if;

  insert into public.scores as s (user_id, trail_id, best_time_sec, display_name)
  values (uid, p_trail, p_sec, name)
  on conflict (user_id, trail_id) do update
    set best_time_sec = least(s.best_time_sec, excluded.best_time_sec),
        display_name  = excluded.display_name,
        updated_at    = case when excluded.best_time_sec < s.best_time_sec then now() else s.updated_at end
  returning best_time_sec into best;
  return best;
end;
$$;

-- top N for a trail, plus the caller's own row if it is outside the top N
create function public.get_leaderboard(p_trail text, p_limit integer default 10)
returns table (rank bigint, display_name text, best_time_sec integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select rank() over (order by s.best_time_sec, s.updated_at) as rank,
           s.display_name, s.best_time_sec, (s.user_id = auth.uid()) as is_me
    from public.scores s
    where s.trail_id = p_trail
  )
  select * from ranked
  where rank <= greatest(1, least(coalesce(p_limit, 10), 50)) or is_me
  order by rank;
$$;

revoke all on function public.submit_score(text, integer, text) from public, anon;
grant execute on function public.submit_score(text, integer, text) to authenticated;
revoke all on function public.get_leaderboard(text, integer) from public;
grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;
