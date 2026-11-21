-- THAILAND WILD TRAILS: visiting a friend's camp.
-- camp_cards: one public "camp card" per player (what visitors see), opened by a 6-character code.
-- camp_visits: guestbook stickers (fixed phrases only) and garden watering, one per visitor per host per day.
-- Nobody reads another player's row directly: get_camp() and leave_visit() never expose user ids.

-- ---------- camp cards ----------
create table public.camp_cards (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  card       jsonb not null check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 8000),
  updated_at timestamptz not null default now()
);
alter table public.camp_cards enable row level security;
-- owners read their own row; all writes go through publish_camp()
create policy "read own camp card" on public.camp_cards for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- visits ----------
create table public.camp_visits (
  id           bigint generated always as identity primary key,
  host         uuid not null references auth.users (id) on delete cascade,
  visitor      uuid not null references auth.users (id) on delete cascade,
  visitor_name text not null check (char_length(visitor_name) between 1 and 20),
  sticker      text not null check (sticker in ('nice_camp', 'hike_together', 'thanks', 'cozy', 'garden', 'wow', 'see_you', 'coffee')),
  watered      boolean not null default false,
  taken        boolean not null default false,
  day         date not null default (now() at time zone 'Asia/Bangkok')::date,
  created_at   timestamptz not null default now(),
  check (host <> visitor),
  unique (host, visitor, day)
);
create index camp_visits_host on public.camp_visits (host);
alter table public.camp_visits enable row level security;
-- no policies: only the functions below read or write visits

-- ---------- functions ----------
-- saves the caller's card and returns their camp code (made once, kept after)
create function public.publish_camp(p_card jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  c    text;
  abc  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i    int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_card is null or jsonb_typeof(p_card) <> 'object' or pg_column_size(p_card) >= 8000 then raise exception 'bad card'; end if;
  select code into c from public.camp_cards where user_id = uid;
  if c is not null then
    update public.camp_cards set card = p_card, updated_at = now() where user_id = uid;
    return c;
  end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    begin
      insert into public.camp_cards (user_id, code, card) values (uid, c, p_card);
      return c;
    exception when unique_violation then
      -- code taken: try another
    end;
  end loop;
end;
$$;

-- a friend's card by code (null when unknown); also says whether it is the caller's own camp
create function public.get_camp(p_code text)
returns table (card jsonb, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.card, (c.user_id = auth.uid()) from public.camp_cards c where c.code = upper(btrim(p_code));
$$;

-- leaves a sticker (and optional watering) at a friend's camp: 'ok' | 'none' | 'self' | 'already'
create function public.leave_visit(p_code text, p_sticker text, p_water boolean, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  h    uuid;
  name text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), 20);
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_sticker not in ('nice_camp', 'hike_together', 'thanks', 'cozy', 'garden', 'wow', 'see_you', 'coffee') then raise exception 'unknown sticker'; end if;
  select user_id into h from public.camp_cards where code = upper(btrim(p_code));
  if h is null then return 'none'; end if;
  if h = uid then return 'self'; end if;
  if name = '' then name := 'Hiker'; end if;
  insert into public.camp_visits (host, visitor, visitor_name, sticker, watered)
  values (h, uid, name, p_sticker, coalesce(p_water, false))
  on conflict (host, visitor, day) do nothing;
  if not found then return 'already'; end if;
  return 'ok';
end;
$$;

-- the caller collects the visits left at their camp (each is returned once). Collected rows stay a week
-- so the one-visit-a-day rule still holds after the host has read them.
create function public.take_visits()
returns table (visitor_name text, sticker text, watered boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.camp_visits v
  where v.host = auth.uid() and v.taken and v.day < (now() at time zone 'Asia/Bangkok')::date - 7;
  return query
    update public.camp_visits v set taken = true
    where v.host = auth.uid() and not v.taken
    returning v.visitor_name, v.sticker, v.watered, v.created_at;
end;
$$;

revoke all on function public.publish_camp(jsonb) from public, anon;
revoke all on function public.get_camp(text) from public, anon;
revoke all on function public.leave_visit(text, text, boolean, text) from public, anon;
revoke all on function public.take_visits() from public, anon;
grant execute on function public.publish_camp(jsonb) to authenticated;
grant execute on function public.get_camp(text) to authenticated;
grant execute on function public.leave_visit(text, text, boolean, text) to authenticated;
grant execute on function public.take_visits() to authenticated;
