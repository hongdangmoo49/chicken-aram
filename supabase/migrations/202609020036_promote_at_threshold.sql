create or replace function public.apply_player_rank_progression()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.wins = old.wins and new.losses = old.losses then
    return new;
  end if;
  if new.tier between 1 and 5 then
    new.rank_points := old.rank_points + ((new.wins - old.wins) - (new.losses - old.losses)) * 3;
    while new.tier > 1 and new.rank_points >= 15 loop
      new.tier := new.tier - 1;
      new.rank_points := new.rank_points - 15;
    end loop;
    while new.tier < 5 and new.rank_points <= -15 loop
      new.tier := new.tier + 1;
      new.rank_points := new.rank_points + 15;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.cast_match_mvp_vote(p_match_id bigint, p_candidate_player_id bigint, p_actor_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  target_team public.match_team;
  current_round smallint;
  current_vote_count integer;
  inserted_award_count integer;
  latest_round smallint;
  latest_vote_count integer;
  match_state public.match_status;
  top_candidate_count integer;
  top_vote_count integer;
  voter_id bigint;
  voter_team public.match_team;
  winner_player_id bigint;
begin
  select status into match_state from public.matches
  where id = p_match_id and mvp_voting_started_at is not null for update;
  if not found or match_state <> 'completed' then raise exception 'MVP voting is not open'; end if;

  select player_id into voter_id from public.profiles where id = p_actor_id;
  if voter_id is null then raise exception 'linked player is required'; end if;
  select team into voter_team from public.match_players where match_id = p_match_id and player_id = voter_id;
  if voter_team is null then raise exception 'voter must be a match participant'; end if;
  select team into target_team from public.match_players where match_id = p_match_id and player_id = p_candidate_player_id;
  if target_team is null or target_team = voter_team then raise exception 'candidate must be an opposing participant'; end if;
  if exists (select 1 from public.match_mvp_awards as award where award.match_id = p_match_id and award.team = target_team) then
    raise exception 'MVP voting is already finalized';
  end if;

  select coalesce(max(round), 0)::smallint into latest_round
  from public.match_mvp_votes as vote where vote.match_id = p_match_id and vote.candidate_team = target_team;
  if latest_round = 0 then
    current_round := 1;
  else
    select count(*) into latest_vote_count from public.match_mvp_votes as vote
    where vote.match_id = p_match_id and vote.candidate_team = target_team and vote.round = latest_round;
    current_round := case when latest_vote_count = 5 then latest_round + 1 else latest_round end;
  end if;

  if current_round > 1 then
    select max(vote_count), count(*) filter (where vote_count = max_vote_count)
    into top_vote_count, top_candidate_count
    from (
      select candidate_player_id, count(*)::integer as vote_count, max(count(*)) over ()::integer as max_vote_count
      from public.match_mvp_votes as vote
      where vote.match_id = p_match_id and vote.candidate_team = target_team and vote.round = current_round - 1
      group by candidate_player_id
    ) as previous_result;
    if top_candidate_count < 2 or not exists (
      select 1 from public.match_mvp_votes as vote
      where vote.match_id = p_match_id and vote.candidate_team = target_team and vote.round = current_round - 1 and vote.candidate_player_id = p_candidate_player_id
      group by vote.candidate_player_id having count(*) = top_vote_count
    ) then raise exception 'candidate is not in the runoff'; end if;
  end if;

  insert into public.match_mvp_votes (match_id, candidate_team, round, voter_player_id, candidate_player_id)
  values (p_match_id, target_team, current_round, voter_id, p_candidate_player_id)
  on conflict (match_id, candidate_team, round, voter_player_id)
  do update set candidate_player_id = excluded.candidate_player_id, updated_at = now();
  select count(*) into current_vote_count from public.match_mvp_votes as vote
  where vote.match_id = p_match_id and vote.candidate_team = target_team and vote.round = current_round;

  if current_vote_count = 5 then
    select max(vote_count), count(*) filter (where vote_count = max_vote_count)
    into top_vote_count, top_candidate_count
    from (
      select candidate_player_id, count(*)::integer as vote_count, max(count(*)) over ()::integer as max_vote_count
      from public.match_mvp_votes as vote
      where vote.match_id = p_match_id and vote.candidate_team = target_team and vote.round = current_round
      group by candidate_player_id
    ) as current_result;
    if top_candidate_count = 1 then
      select candidate_player_id into winner_player_id
      from public.match_mvp_votes as vote
      where vote.match_id = p_match_id and vote.candidate_team = target_team and vote.round = current_round
      group by vote.candidate_player_id order by count(*) desc limit 1;

      insert into public.match_mvp_awards (match_id, team, player_id, source_round)
      values (p_match_id, target_team, winner_player_id, current_round)
      on conflict (match_id, team) do nothing;
      get diagnostics inserted_award_count = row_count;
      if inserted_award_count = 1 then
        update public.players set rank_points = rank_points + 1 where id = winner_player_id;
        loop
          update public.players set tier = tier - 1, rank_points = rank_points - 15
          where id = winner_player_id and tier between 2 and 5 and rank_points >= 15;
          exit when not found;
        end loop;
      end if;
    end if;
  end if;

  return jsonb_build_object('candidateTeam', target_team, 'finalized', winner_player_id is not null, 'round', current_round, 'votesCast', current_vote_count);
end;
$$;

revoke all on function public.cast_match_mvp_vote(bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.cast_match_mvp_vote(bigint, bigint, uuid) to service_role;

create or replace function public.admin_finalize_match_mvp(p_match_id bigint, p_player_id bigint, p_actor_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.app_role;
  after_points integer;
  after_tier smallint;
  before_points integer;
  before_tier smallint;
  candidate_name text;
  target_team public.match_team;
  match_state public.match_status;
  source_round smallint;
begin
  select role into actor_role from public.profiles where id = p_actor_id;
  if actor_role is distinct from 'super_admin'::public.app_role then raise exception 'super admin role required'; end if;
  select status into match_state from public.matches
  where id = p_match_id and mvp_voting_started_at is not null for update;
  if not found or match_state <> 'completed' then raise exception 'MVP voting is not open'; end if;

  select member.team, player.nickname, player.tier, player.rank_points
  into target_team, candidate_name, before_tier, before_points
  from public.match_players as member join public.players as player on player.id = member.player_id
  where member.match_id = p_match_id and member.player_id = p_player_id;
  if target_team is null then raise exception 'MVP candidate must be a match participant'; end if;
  if exists (select 1 from public.match_mvp_awards as award where award.match_id = p_match_id and award.team = target_team) then
    raise exception 'MVP voting is already finalized';
  end if;

  select greatest(coalesce(max(vote.round), 1), 1)::smallint into source_round
  from public.match_mvp_votes as vote where vote.match_id = p_match_id and vote.candidate_team = target_team;
  insert into public.match_mvp_awards (match_id, team, player_id, source_round)
  values (p_match_id, target_team, p_player_id, source_round);
  update public.players set rank_points = rank_points + 1 where id = p_player_id;
  loop
    update public.players set tier = tier - 1, rank_points = rank_points - 15
    where id = p_player_id and tier between 2 and 5 and rank_points >= 15;
    exit when not found;
  end loop;

  select tier, rank_points into after_tier, after_points from public.players where id = p_player_id;
  insert into public.audit_logs (actor_id, actor_name, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id,
    coalesce((select display_name from public.profiles where id = p_actor_id), '알 수 없음'),
    'matches.mvp.manual_finalize',
    'match',
    p_match_id::text,
    jsonb_build_object('team', target_team, 'votesFinalized', false, 'playerId', p_player_id, 'tier', before_tier, 'points', before_points),
    jsonb_build_object('team', target_team, 'votesFinalized', true, 'playerId', p_player_id, 'nickname', candidate_name, 'tier', after_tier, 'points', after_points)
  );
end;
$$;

revoke all on function public.admin_finalize_match_mvp(bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.admin_finalize_match_mvp(bigint, bigint, uuid) to service_role;

do $$
begin
  loop
    update public.players set tier = tier - 1, rank_points = rank_points - 15
    where tier between 2 and 5 and rank_points >= 15;
    exit when not found;
  end loop;
end;
$$;
