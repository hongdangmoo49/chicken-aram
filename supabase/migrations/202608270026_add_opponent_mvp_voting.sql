alter table public.matches
  add column mvp_voting_started_at timestamptz;

create table public.match_mvp_votes (
  match_id bigint not null references public.matches(id) on delete cascade,
  candidate_team public.match_team not null,
  round smallint not null check (round > 0),
  voter_player_id bigint not null references public.players(id) on delete restrict,
  candidate_player_id bigint not null references public.players(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, candidate_team, round, voter_player_id),
  check (voter_player_id <> candidate_player_id)
);

create index match_mvp_votes_result_idx
  on public.match_mvp_votes (match_id, candidate_team, round, candidate_player_id);

create table public.match_mvp_awards (
  match_id bigint not null references public.matches(id) on delete cascade,
  team public.match_team not null,
  player_id bigint not null references public.players(id) on delete restrict,
  source_round smallint not null check (source_round > 0),
  awarded_at timestamptz not null default now(),
  primary key (match_id, team)
);

alter table public.match_mvp_votes enable row level security;
alter table public.match_mvp_awards enable row level security;
revoke all on table public.match_mvp_votes from public, anon, authenticated;
grant select, insert, update on table public.match_mvp_votes to service_role;
grant select, insert on table public.match_mvp_awards to service_role;
grant select on table public.match_mvp_awards to anon, authenticated;

create policy "MVP awards are publicly readable"
  on public.match_mvp_awards for select
  to anon, authenticated
  using (true);

create or replace function public.cast_match_mvp_vote(
  p_match_id bigint,
  p_candidate_player_id bigint,
  p_actor_id uuid
)
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
  select status into match_state
  from public.matches
  where id = p_match_id and mvp_voting_started_at is not null
  for update;
  if not found or match_state <> 'completed' then
    raise exception 'MVP voting is not open';
  end if;

  select player_id into voter_id
  from public.profiles
  where id = p_actor_id;
  if voter_id is null then
    raise exception 'linked player is required';
  end if;

  select team into voter_team
  from public.match_players
  where match_id = p_match_id and player_id = voter_id;
  if voter_team is null then
    raise exception 'voter must be a match participant';
  end if;

  select team into target_team
  from public.match_players
  where match_id = p_match_id and player_id = p_candidate_player_id;
  if target_team is null or target_team = voter_team then
    raise exception 'candidate must be an opposing participant';
  end if;

  if exists (select 1 from public.match_mvp_awards as award where award.match_id = p_match_id and award.team = target_team) then
    raise exception 'MVP voting is already finalized';
  end if;

  select coalesce(max(round), 0)::smallint into latest_round
  from public.match_mvp_votes as vote
  where vote.match_id = p_match_id and vote.candidate_team = target_team;

  if latest_round = 0 then
    current_round := 1;
  else
    select count(*) into latest_vote_count
    from public.match_mvp_votes as vote
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
      select 1
      from public.match_mvp_votes as vote
      where vote.match_id = p_match_id
        and vote.candidate_team = target_team
        and vote.round = current_round - 1
        and vote.candidate_player_id = p_candidate_player_id
      group by vote.candidate_player_id
      having count(*) = top_vote_count
    ) then
      raise exception 'candidate is not in the runoff';
    end if;
  end if;

  insert into public.match_mvp_votes (match_id, candidate_team, round, voter_player_id, candidate_player_id)
  values (p_match_id, target_team, current_round, voter_id, p_candidate_player_id)
  on conflict (match_id, candidate_team, round, voter_player_id)
  do update set candidate_player_id = excluded.candidate_player_id, updated_at = now();

  select count(*) into current_vote_count
  from public.match_mvp_votes as vote
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
      group by vote.candidate_player_id
      order by count(*) desc
      limit 1;

      insert into public.match_mvp_awards (match_id, team, player_id, source_round)
      values (p_match_id, target_team, winner_player_id, current_round)
      on conflict (match_id, team) do nothing;
      get diagnostics inserted_award_count = row_count;

      if inserted_award_count = 1 then
        update public.players set rank_points = rank_points + 1 where id = winner_player_id;
        loop
          update public.players
          set tier = tier - 1, rank_points = rank_points - 25
          where id = winner_player_id and tier between 2 and 5 and rank_points > 25;
          exit when not found;
        end loop;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'candidateTeam', target_team,
    'finalized', winner_player_id is not null,
    'round', current_round,
    'votesCast', current_vote_count
  );
end;
$$;

revoke all on function public.cast_match_mvp_vote(bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.cast_match_mvp_vote(bigint, bigint, uuid) to service_role;

create or replace function public.save_match_result(
  p_match_id bigint,
  p_played_at timestamptz,
  p_a_score smallint,
  p_b_score smallint,
  p_winner public.match_team,
  p_mvp_player_id bigint,
  p_actor_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  before_value jsonb;
  after_value jsonb;
  current_status public.match_status;
  mvp_name text;
  participant_count integer;
begin
  if p_played_at is null or p_a_score is null or p_b_score is null or p_winner is null or p_a_score < 0 or p_b_score < 0 or p_a_score = p_b_score
    or (p_winner = 'A' and p_a_score < p_b_score) or (p_winner = 'B' and p_b_score < p_a_score) then
    raise exception 'invalid match result';
  end if;

  select jsonb_build_object(
    'status', status,
    'playedAt', played_at,
    'aScore', a_score,
    'bScore', b_score,
    'winner', winner,
    'mvpPlayerId', mvp_player_id
  ), status
  into before_value, current_status
  from public.matches
  where id = p_match_id
  for update;
  if not found then raise exception 'match not found'; end if;

  select count(*) into participant_count from public.match_players where match_id = p_match_id;
  if participant_count <> 10 then raise exception 'match must have 10 participants'; end if;

  if p_mvp_player_id is not null then
    select player.nickname into mvp_name
    from public.match_players as member
    join public.players as player on player.id = member.player_id
    where member.match_id = p_match_id and member.player_id = p_mvp_player_id;
    if not found then raise exception 'mvp must be a match participant'; end if;
  end if;

  update public.matches
  set
    status = 'completed',
    played_at = p_played_at,
    a_score = p_a_score,
    b_score = p_b_score,
    winner = p_winner,
    mvp = case when p_mvp_player_id is null then mvp else mvp_name end,
    mvp_player_id = case when p_mvp_player_id is null then mvp_player_id else p_mvp_player_id end,
    mvp_voting_started_at = case when current_status = 'scheduled' then now() else mvp_voting_started_at end
  where id = p_match_id;

  perform public.recalculate_player_records();

  select jsonb_build_object(
    'status', status,
    'playedAt', played_at,
    'aScore', a_score,
    'bScore', b_score,
    'winner', winner,
    'mvpPlayerId', mvp_player_id
  )
  into after_value
  from public.matches
  where id = p_match_id;

  insert into public.audit_logs (actor_id, actor_name, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id,
    coalesce((select display_name from public.profiles where id = p_actor_id), '알 수 없음'),
    'matches.result.save',
    'match',
    p_match_id::text,
    before_value,
    after_value
  );
end;
$$;

revoke all on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint, uuid) from public, anon, authenticated;
grant execute on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint, uuid) to service_role;
