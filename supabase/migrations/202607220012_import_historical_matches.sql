create or replace function public.recalculate_player_records()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(20260722);
  update public.players set wins = 0, losses = 0;

  with totals as (
    select
      member.player_id,
      sum(case when member.team = 'A' then match.a_score else match.b_score end)::integer as wins,
      sum(case when member.team = 'A' then match.b_score else match.a_score end)::integer as losses
    from public.match_players as member
    join public.matches as match on match.id = member.match_id
    where match.status = 'completed'
    group by member.player_id
  )
  update public.players as player
  set wins = totals.wins, losses = totals.losses
  from totals
  where player.id = totals.player_id;
end;
$$;

revoke all on function public.recalculate_player_records() from public, anon, authenticated;
grant execute on function public.recalculate_player_records() to service_role;

create or replace function public.save_match_result(
  p_match_id bigint,
  p_played_at timestamptz,
  p_a_score smallint,
  p_b_score smallint,
  p_winner public.match_team,
  p_mvp_player_id bigint
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  mvp_name text;
  participant_count integer;
begin
  if p_played_at is null or p_a_score is null or p_b_score is null or p_winner is null or p_a_score < 0 or p_b_score < 0 or p_a_score = p_b_score
    or (p_winner = 'A' and p_a_score < p_b_score) or (p_winner = 'B' and p_b_score < p_a_score) then
    raise exception 'invalid match result';
  end if;

  perform 1 from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;

  select count(*) into participant_count from public.match_players where match_id = p_match_id;
  if participant_count <> 10 then raise exception 'match must have 10 participants'; end if;

  select player.nickname into mvp_name
  from public.match_players as member
  join public.players as player on player.id = member.player_id
  where member.match_id = p_match_id and member.player_id = p_mvp_player_id;
  if not found then raise exception 'mvp must be a match participant'; end if;

  update public.matches
  set status = 'completed', played_at = p_played_at, a_score = p_a_score, b_score = p_b_score, winner = p_winner, mvp = mvp_name, mvp_player_id = p_mvp_player_id
  where id = p_match_id;

  perform public.recalculate_player_records();
end;
$$;

revoke all on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint) from public, anon, authenticated;
grant execute on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  nickname text;
  linked_player_id bigint;
begin
  nickname := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));

  select player.id into linked_player_id
  from public.players as player
  where lower(btrim(player.nickname)) = lower(nickname)
  for update;

  if linked_player_id is null then
    insert into public.players (nickname, tier) values (nickname, 4) returning id into linked_player_id;
  elsif exists (select 1 from public.profiles where player_id = linked_player_id) then
    raise exception 'nickname already claimed';
  end if;

  insert into public.profiles (id, display_name, player_id) values (new.id, nickname, linked_player_id);
  return new;
end;
$$;

insert into public.players (nickname, tier)
select nickname, 4
from (values ('무사시'), ('협지')) as pending(nickname)
where not exists (select 1 from public.players where lower(btrim(players.nickname)) = lower(pending.nickname));

do $$
declare
  historical record;
  historical_match_id bigint;
  mapped_player_count integer;
begin
  for historical in
    select * from (values
      ('2026-07-19 22:30:00+09'::timestamptz, 3::smallint, 0::smallint, 'A'::public.match_team,
        array['bono', '타골(닌자프로기)', '이창헌', '재미', '신사']::text[],
        array['onnozea', '망주', '증일이', '부처', 'kotether']::text[]),
      ('2026-07-18 22:30:00+09'::timestamptz, 3::smallint, 2::smallint, 'A'::public.match_team,
        array['bono', '증일이', '빛', 'kotether', '신사']::text[],
        array['잼민 / @songb2', '이창헌', '부처', '재미', 'shud']::text[]),
      ('2026-07-16 23:00:00+09'::timestamptz, 2::smallint, 3::smallint, 'B'::public.match_team,
        array['bono', '협지', '증일이', 'kotether', '신사']::text[],
        array['잼민 / @songb2', '타골(닌자프로기)', '망주', '재미', '무사시']::text[])
    ) as history(played_at, a_score, b_score, winner, team_a, team_b)
  loop
    continue when exists (select 1 from public.matches where matches.played_at = historical.played_at and matches.map = '증강 칼바람 협곡');

    select count(*) into mapped_player_count
    from public.players
    where nickname = any(historical.team_a || historical.team_b);
    if mapped_player_count <> 10 then raise exception 'historical player mapping is incomplete for %', historical.played_at; end if;

    insert into public.matches (scheduled_at, played_at, map, status, team_a, team_b, a_score, b_score, winner)
    values (historical.played_at, historical.played_at, '증강 칼바람 협곡', 'completed', historical.team_a, historical.team_b, historical.a_score, historical.b_score, historical.winner)
    returning id into historical_match_id;

    insert into public.match_players (match_id, player_id, team)
    select historical_match_id, player.id, 'A'::public.match_team from public.players as player where player.nickname = any(historical.team_a)
    union all
    select historical_match_id, player.id, 'B'::public.match_team from public.players as player where player.nickname = any(historical.team_b);
  end loop;

  perform public.recalculate_player_records();
end;
$$;
