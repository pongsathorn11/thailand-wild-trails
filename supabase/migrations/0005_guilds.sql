-- THAILAND WILD TRAILS: hiking clubs (guilds) and the weekly club ranking.
-- A club has a filtered name, an emblem from a fixed list and up to 20 members (one club per player).
-- Weekly points come only from server-timed hikes (public.runs, accepted): 10 points each, at most 3 counted
-- per member per day (Thai time), only after the member joined. Nothing can be bought.
-- Tables have RLS and no policies: everything goes through the functions below, which never return user ids.

create table public.guilds (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name       text not null check (char_length(name) between 3 and 20),
  name_key   text not null unique,
  emblem     text not null check (emblem in ('🌲', '⛰️', '🦅', '🐘', '🌊', '🔥', '🌸', '🦌')),
  open       boolean not null default true,
  leader     uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.guilds enable row level security;

create table public.guild_members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  guild_id     uuid not null references public.guilds (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  joined_at    timestamptz not null default now()
);
create index guild_members_guild on public.guild_members (guild_id);
alter table public.guild_members enable row level security;

-- ---------- helpers (not callable from the API) ----------
create function public.guild_clean_display(p text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]<>]', '', 'g')), 20), ''), 'Hiker');
$$;

-- 'ok' | 'short' | 'long' | 'chars' | 'banned' (same rules as src/core/guild.ts)
create function public.guild_name_problem(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  n   text := btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'));
  key text;
  w   text;
begin
  if char_length(n) < 3 then return 'short'; end if;
  if char_length(n) > 20 then return 'long'; end if;
  if n !~ ('^[A-Za-z0-9' || chr(3584) || '-' || chr(3711) || ' ._''-]+$') then return 'chars'; end if;
  key := lower(regexp_replace(n, '[ ._''-]+', '', 'g'));
  foreach w in array array[
    'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'porn', 'nazi', 'hitler', 'rape',
    'เหี้ย', 'สัส', 'ควย', 'เย็ด', 'มึง', 'ระยำ', 'ชาติหมา', 'แตด', 'สถุล', 'อีดอก', 'ส้นตีน'
  ] loop
    if position(w in key) > 0 then return 'banned'; end if;
  end loop;
  return 'ok';
end;
$$;

-- this week's points for one member (Monday 00:00 Thai time onwards, after they joined)
create function public.guild_member_points(p_user uuid, p_since timestamptz)
returns integer language sql stable security definer set search_path = '' as $$
  select (coalesce(sum(least(x.c, 3)), 0) * 10)::integer
  from (
    select (r.finished_at at time zone 'Asia/Bangkok')::date as d, count(*) as c
    from public.runs r
    where r.user_id = p_user and r.accepted
      and r.finished_at >= p_since
      and (r.finished_at at time zone 'Asia/Bangkok') >= date_trunc('week', now() at time zone 'Asia/Bangkok')
    group by 1
  ) x;
$$;

-- every club with this week's points and rank
create function public.guild_scores()
returns table (guild_id uuid, points integer, members integer, rank bigint)
language sql stable security definer set search_path = '' as $$
  with s as (
    select g.id, g.created_at,
           coalesce(sum(public.guild_member_points(m.user_id, m.joined_at)), 0)::integer as points,
           count(m.user_id)::integer as members
    from public.guilds g left join public.guild_members m on m.guild_id = g.id
    group by g.id
  )
  select s.id, s.points, s.members, rank() over (order by s.points desc, s.members desc, s.created_at) from s;
$$;

-- ---------- API ----------
-- result: 'ok' (code = the new club's code) | 'already' | 'short' | 'long' | 'chars' | 'banned' | 'taken' | 'emblem'
create function public.create_guild(p_name text, p_emblem text, p_display text)
returns table (result text, code text)
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  n    text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  prob text := public.guild_name_problem(p_name);
  c    text;
  gid  uuid;
  abc  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i    int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.guild_members where user_id = uid) then return query select 'already'::text, null::text; return; end if;
  if prob <> 'ok' then return query select prob, null::text; return; end if;
  if p_emblem not in ('🌲', '⛰️', '🦅', '🐘', '🌊', '🔥', '🌸', '🦌') then return query select 'emblem'::text, null::text; return; end if;
  if exists (select 1 from public.guilds where name_key = lower(regexp_replace(n, '[ ._''-]+', '', 'g'))) then return query select 'taken'::text, null::text; return; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.guilds where public.guilds.code = c);
  end loop;
  insert into public.guilds (code, name, name_key, emblem, leader)
  values (c, n, lower(regexp_replace(n, '[ ._''-]+', '', 'g')), p_emblem, uid) returning id into gid;
  insert into public.guild_members (user_id, guild_id, display_name) values (uid, gid, public.guild_clean_display(p_display));
  return query select 'ok'::text, c;
end;
$$;

-- 'ok' | 'none' | 'closed' | 'full' | 'already'
create function public.join_guild(p_code text, p_display text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g   public.guilds%rowtype;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.guild_members where user_id = uid) then return 'already'; end if;
  select * into g from public.guilds where code = upper(btrim(p_code)) for update;
  if not found then return 'none'; end if;
  if not g.open then return 'closed'; end if;
  if (select count(*) from public.guild_members where guild_id = g.id) >= 20 then return 'full'; end if;
  insert into public.guild_members (user_id, guild_id, display_name) values (uid, g.id, public.guild_clean_display(p_display));
  return 'ok';
end;
$$;

-- leaving passes the lead to the longest-standing member; the last one out closes the club. 'ok' | 'none'
create function public.leave_guild()
returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  nxt uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.guild_members where user_id = uid returning guild_id into gid;
  if gid is null then return 'none'; end if;
  select user_id into nxt from public.guild_members where guild_id = gid order by joined_at limit 1;
  if nxt is null then delete from public.guilds where id = gid;
  else update public.guilds set leader = nxt where id = gid and (leader = uid or leader is null);
  end if;
  return 'ok';
end;
$$;

-- the leader opens or closes the club to new members. 'ok' | 'none' | 'notLeader'
create function public.set_guild_open(p_open boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g   public.guilds%rowtype;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select gg.* into g from public.guilds gg join public.guild_members m on m.guild_id = gg.id where m.user_id = uid;
  if not found then return 'none'; end if;
  if g.leader is distinct from uid then return 'notLeader'; end if;
  update public.guilds set open = coalesce(p_open, true) where id = g.id;
  return 'ok';
end;
$$;

-- the caller's club (null when not in one); also refreshes the caller's shown name
create function public.my_guild(p_display text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g   public.guilds%rowtype;
  sc  record;
  mem jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select gg.* into g from public.guilds gg join public.guild_members m on m.guild_id = gg.id where m.user_id = uid;
  if not found then return null; end if;
  update public.guild_members set display_name = public.guild_clean_display(p_display) where user_id = uid;
  select * into sc from public.guild_scores() s where s.guild_id = g.id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', m.display_name,
           'points', public.guild_member_points(m.user_id, m.joined_at),
           'isMe', m.user_id = uid,
           'isLeader', m.user_id = g.leader
         ) order by public.guild_member_points(m.user_id, m.joined_at) desc, m.joined_at), '[]'::jsonb)
    into mem from public.guild_members m where m.guild_id = g.id;
  return jsonb_build_object('code', g.code, 'name', g.name, 'emblem', g.emblem, 'open', g.open, 'isLeader', g.leader = uid,
                            'points', sc.points, 'rank', sc.rank, 'members', mem);
end;
$$;

-- weekly ranking: top N plus the caller's club; codes only for clubs that are open and not full
create function public.guild_board(p_limit integer default 10)
returns table (rank bigint, name text, emblem text, members integer, points integer, is_mine boolean, code text)
language sql stable security definer set search_path = '' as $$
  select s.rank, g.name, g.emblem, s.members, s.points,
         exists (select 1 from public.guild_members m where m.guild_id = g.id and m.user_id = auth.uid()),
         case when g.open and s.members < 20 then g.code end
  from public.guild_scores() s join public.guilds g on g.id = s.guild_id
  where s.rank <= greatest(1, least(coalesce(p_limit, 10), 50))
     or exists (select 1 from public.guild_members m where m.guild_id = g.id and m.user_id = auth.uid())
  order by s.rank;
$$;

revoke all on function public.guild_clean_display(text) from public, anon, authenticated;
revoke all on function public.guild_name_problem(text) from public, anon, authenticated;
revoke all on function public.guild_member_points(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.guild_scores() from public, anon, authenticated;
revoke all on function public.create_guild(text, text, text) from public, anon;
revoke all on function public.join_guild(text, text) from public, anon;
revoke all on function public.leave_guild() from public, anon;
revoke all on function public.set_guild_open(boolean) from public, anon;
revoke all on function public.my_guild(text) from public, anon;
revoke all on function public.guild_board(integer) from public, anon;
grant execute on function public.create_guild(text, text, text) to authenticated;
grant execute on function public.join_guild(text, text) to authenticated;
grant execute on function public.leave_guild() to authenticated;
grant execute on function public.set_guild_open(boolean) to authenticated;
grant execute on function public.my_guild(text) to authenticated;
grant execute on function public.guild_board(integer) to authenticated;
