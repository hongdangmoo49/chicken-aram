create or replace function public.admin_finalize_match_mvp(
  p_match_id bigint,
  p_player_id bigint,
  p_actor_id uuid
)
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
  select role into actor_role
  from public.profiles
  where id = p_actor_id;
  if actor_role is distinct from 'super_admin'::public.app_role then
    raise exception 'super admin role required';
  end if;

  select status into match_state
  from public.matches
  where id = p_match_id and mvp_voting_started_at is not null
  for update;
  if not found or match_state <> 'completed' then
    raise exception 'MVP voting is not open';
  end if;

  select member.team, player.nickname, player.tier, player.rank_points
  into target_team, candidate_name, before_tier, before_points
  from public.match_players as member
  join public.players as player on player.id = member.player_id
  where member.match_id = p_match_id and member.player_id = p_player_id;
  if target_team is null then
    raise exception 'MVP candidate must be a match participant';
  end if;

  if exists (
    select 1 from public.match_mvp_awards as award
    where award.match_id = p_match_id and award.team = target_team
  ) then
    raise exception 'MVP voting is already finalized';
  end if;

  select greatest(coalesce(max(vote.round), 1), 1)::smallint into source_round
  from public.match_mvp_votes as vote
  where vote.match_id = p_match_id and vote.candidate_team = target_team;

  insert into public.match_mvp_awards (match_id, team, player_id, source_round)
  values (p_match_id, target_team, p_player_id, source_round);

  update public.players
  set rank_points = rank_points + 1
  where id = p_player_id;
  loop
    update public.players
    set tier = tier - 1, rank_points = rank_points - 25
    where id = p_player_id and tier between 2 and 5 and rank_points > 25;
    exit when not found;
  end loop;

  select tier, rank_points into after_tier, after_points
  from public.players
  where id = p_player_id;

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
