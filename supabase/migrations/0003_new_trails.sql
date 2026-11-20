-- New trails: Haew Narok (Khao Yai, Central) and Khao Chamao (East).
-- The list of trail ids now lives in one place, public.trail_ids(); constraints and functions use it.
-- To add a trail later: replace this function with the longer list (the checks pick it up).

create or replace function public.trail_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['doi-inthanon-kew-mae-pan', 'phu-kradueng-summit', 'erawan-waterfall', 'khao-sok-ton-kloi',
               'khao-yai-haew-narok', 'khao-chamao-falls']::text[];
$$;
revoke all on function public.trail_ids() from public, anon, authenticated;

alter table public.scores drop constraint scores_trail_id_check;
alter table public.scores add constraint scores_trail_id_check check (trail_id = any (public.trail_ids()));
alter table public.runs drop constraint runs_trail_id_check;
alter table public.runs add constraint runs_trail_id_check check (trail_id = any (public.trail_ids()));

create or replace function public.start_run(p_trail text)
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
  if not (p_trail = any (public.trail_ids())) then raise exception 'unknown trail'; end if;
  update public.runs set finished_at = now(), accepted = false where user_id = uid and trail_id = p_trail and finished_at is null;
  if (select count(*) from public.runs where user_id = uid and started_at > now() - interval '1 hour') >= 30 then raise exception 'too many runs'; end if;
  insert into public.runs (user_id, trail_id) values (uid, p_trail) returning id into rid;
  return rid;
end;
$$;

-- still closed to players (see 0002); kept consistent in case it is used by an admin
create or replace function public.submit_score(p_trail text, p_sec integer, p_name text)
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
  if not (p_trail = any (public.trail_ids())) then raise exception 'unknown trail'; end if;
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
revoke all on function public.submit_score(text, integer, text) from public, anon, authenticated;
