alter table public.matches
  add column played_at timestamptz,
  add column winner public.match_team,
  add column mvp_player_id bigint references public.players(id) on delete set null;

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
  current_status public.match_status;
  current_winner public.match_team;
  current_a_score smallint;
  current_b_score smallint;
  old_winner public.match_team;
  mvp_name text;
  participant_count integer;
  updated_count integer;
begin
  if p_played_at is null or p_a_score is null or p_b_score is null or p_a_score < 0 or p_b_score < 0 or p_a_score = p_b_score
    or (p_winner = 'A' and p_a_score < p_b_score) or (p_winner = 'B' and p_b_score < p_a_score) then
    raise exception 'invalid match result';
  end if;

  select status, winner, a_score, b_score
  into current_status, current_winner, current_a_score, current_b_score
  from public.matches
  where id = p_match_id
  for update;
  if not found then raise exception 'match not found'; end if;

  select count(*) into participant_count from public.match_players where match_id = p_match_id;
  if participant_count <> 10 then raise exception 'match must have 10 participants'; end if;

  select player.nickname into mvp_name
  from public.match_players as member
  join public.players as player on player.id = member.player_id
  where member.match_id = p_match_id and member.player_id = p_mvp_player_id;
  if not found then raise exception 'mvp must be a match participant'; end if;

  if current_status = 'completed' then
    old_winner := coalesce(current_winner, case when current_a_score > current_b_score then 'A'::public.match_team when current_b_score > current_a_score then 'B'::public.match_team end);
    if old_winner is null then raise exception 'previous match result is invalid'; end if;
  end if;

  update public.players as player
  set
    wins = player.wins - case when current_status = 'completed' and member.team = old_winner then 1 else 0 end + case when member.team = p_winner then 1 else 0 end,
    losses = player.losses - case when current_status = 'completed' and member.team <> old_winner then 1 else 0 end + case when member.team <> p_winner then 1 else 0 end
  from public.match_players as member
  where member.match_id = p_match_id and player.id = member.player_id;

  get diagnostics updated_count = row_count;
  if updated_count <> participant_count then raise exception 'player result update count mismatch'; end if;

  update public.matches
  set status = 'completed', played_at = p_played_at, a_score = p_a_score, b_score = p_b_score, winner = p_winner, mvp = mvp_name, mvp_player_id = p_mvp_player_id
  where id = p_match_id;
end;
$$;

revoke all on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint) from public, anon, authenticated;
grant execute on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint) to service_role;
