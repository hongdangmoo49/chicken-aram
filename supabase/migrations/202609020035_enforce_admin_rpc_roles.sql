create or replace function public.assert_actor_role(p_actor_id uuid, p_super_admin_only boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.app_role;
begin
  select role into actor_role from public.profiles where id = p_actor_id;
  if actor_role is null or (p_super_admin_only and actor_role <> 'super_admin'::public.app_role)
    or (not p_super_admin_only and actor_role not in ('admin'::public.app_role, 'super_admin'::public.app_role)) then
    raise exception 'required actor role is missing';
  end if;
end;
$$;

revoke all on function public.assert_actor_role(uuid, boolean) from public, anon, authenticated;
grant execute on function public.assert_actor_role(uuid, boolean) to service_role;

create or replace function public.set_member_roles(changes jsonb, p_actor_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  before_values jsonb;
  after_values jsonb;
  updated_count integer;
begin
  perform public.assert_actor_role(p_actor_id, true);

  select coalesce(jsonb_agg(jsonb_build_object('userId', profile.id, 'displayName', profile.display_name, 'role', profile.role) order by profile.id), '[]'::jsonb)
  into before_values
  from public.profiles as profile
  join jsonb_array_elements(changes) as change(value) on profile.id = (change.value ->> 'userId')::uuid
  where profile.role <> 'super_admin';
  if jsonb_array_length(before_values) <> jsonb_array_length(changes) then raise exception 'member role update count mismatch'; end if;

  update public.profiles as profile
  set role = (change.value ->> 'role')::public.app_role
  from jsonb_array_elements(changes) as change(value)
  where profile.id = (change.value ->> 'userId')::uuid and profile.role <> 'super_admin';
  get diagnostics updated_count = row_count;
  if updated_count <> jsonb_array_length(changes) then raise exception 'member role update count mismatch'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('userId', profile.id, 'displayName', profile.display_name, 'role', profile.role) order by profile.id), '[]'::jsonb)
  into after_values
  from public.profiles as profile
  join jsonb_array_elements(changes) as change(value) on profile.id = (change.value ->> 'userId')::uuid;
  insert into public.audit_logs (actor_id, actor_name, action, entity_type, before_data, after_data)
  values (p_actor_id, coalesce((select display_name from public.profiles where id = p_actor_id), '알 수 없음'), 'members.role.update', 'profile', before_values, after_values);
  return updated_count;
end;
$$;

revoke all on function public.set_member_roles(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.set_member_roles(jsonb, uuid) to service_role;

create or replace function public.create_balanced_schedule(p_scheduled_at timestamptz, p_map text, p_created_by uuid, p_assignments jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  new_match_id bigint;
  distinct_player_count integer;
  team_a_count integer;
  team_b_count integer;
  team_a_names text[];
  team_b_names text[];
begin
  if p_scheduled_at is null or btrim(p_map) = '' or jsonb_array_length(p_assignments) <> 10 then raise exception 'invalid schedule input'; end if;
  perform public.assert_actor_role(p_created_by, false);
  select count(distinct (item.value ->> 'playerId')::bigint), count(*) filter (where item.value ->> 'team' = 'A'), count(*) filter (where item.value ->> 'team' = 'B')
  into distinct_player_count, team_a_count, team_b_count from jsonb_array_elements(p_assignments) as item(value);
  if distinct_player_count <> 10 or team_a_count <> 5 or team_b_count <> 5 then raise exception 'invalid team assignments'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value) where item.value ->> 'separatedGroup' is not null
    group by (item.value ->> 'separatedGroup')::smallint having count(*) > 2
  ) then raise exception 'separated group has too many players'; end if;
  select array_agg(player.nickname order by item.position) filter (where item.value ->> 'team' = 'A'), array_agg(player.nickname order by item.position) filter (where item.value ->> 'team' = 'B')
  into team_a_names, team_b_names
  from jsonb_array_elements(p_assignments) with ordinality as item(value, position)
  join public.players as player on player.id = (item.value ->> 'playerId')::bigint and player.is_active = true and player.tier <> 6;
  if cardinality(team_a_names) <> 5 or cardinality(team_b_names) <> 5 then raise exception 'assigned player not found'; end if;
  insert into public.matches (scheduled_at, map, status, team_a, team_b, created_by)
  values (p_scheduled_at, btrim(p_map), 'scheduled', team_a_names, team_b_names, p_created_by) returning id into new_match_id;
  insert into public.match_players (match_id, player_id, team, separated_group)
  select new_match_id, (item.value ->> 'playerId')::bigint, (item.value ->> 'team')::public.match_team, (item.value ->> 'separatedGroup')::smallint
  from jsonb_array_elements(p_assignments) as item(value);
  return new_match_id;
end;
$$;

revoke all on function public.create_balanced_schedule(timestamptz, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_balanced_schedule(timestamptz, text, uuid, jsonb) to service_role;

create or replace function public.save_match_result(p_match_id bigint, p_played_at timestamptz, p_a_score smallint, p_b_score smallint, p_winner public.match_team, p_mvp_player_id bigint, p_actor_id uuid)
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
    or (p_winner = 'A' and p_a_score < p_b_score) or (p_winner = 'B' and p_b_score < p_a_score) then raise exception 'invalid match result'; end if;
  perform public.assert_actor_role(p_actor_id, false);
  select jsonb_build_object('status', status, 'playedAt', played_at, 'aScore', a_score, 'bScore', b_score, 'winner', winner, 'mvpPlayerId', mvp_player_id), status
  into before_value, current_status from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  select count(*) into participant_count from public.match_players where match_id = p_match_id;
  if participant_count <> 10 then raise exception 'match must have 10 participants'; end if;
  if p_mvp_player_id is not null then
    select player.nickname into mvp_name
    from public.match_players as member join public.players as player on player.id = member.player_id
    where member.match_id = p_match_id and member.player_id = p_mvp_player_id;
    if not found then raise exception 'mvp must be a match participant'; end if;
  end if;
  update public.matches set status = 'completed', played_at = p_played_at, a_score = p_a_score, b_score = p_b_score, winner = p_winner,
    mvp = case when p_mvp_player_id is null then mvp else mvp_name end,
    mvp_player_id = case when p_mvp_player_id is null then mvp_player_id else p_mvp_player_id end,
    mvp_voting_started_at = case when current_status = 'scheduled' then now() else mvp_voting_started_at end
  where id = p_match_id;
  perform public.recalculate_player_records();
  select jsonb_build_object('status', status, 'playedAt', played_at, 'aScore', a_score, 'bScore', b_score, 'winner', winner, 'mvpPlayerId', mvp_player_id)
  into after_value from public.matches where id = p_match_id;
  insert into public.audit_logs (actor_id, actor_name, action, entity_type, entity_id, before_data, after_data)
  values (p_actor_id, coalesce((select display_name from public.profiles where id = p_actor_id), '알 수 없음'), 'matches.result.save', 'match', p_match_id::text, before_value, after_value);
end;
$$;

revoke all on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint, uuid) from public, anon, authenticated;
grant execute on function public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint, uuid) to service_role;

create or replace function public.rebalance_scheduled_match(p_match_id bigint, p_scheduled_at timestamptz, p_map text, p_assignments jsonb, p_actor_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_status public.match_status;
  distinct_player_count integer;
  team_a_count integer;
  team_b_count integer;
  team_a_names text[];
  team_b_names text[];
begin
  perform public.assert_actor_role(p_actor_id, false);
  select status into current_status from public.matches where id = p_match_id for update;
  if not found or current_status <> 'scheduled' then raise exception 'scheduled match not found'; end if;
  if p_scheduled_at is null or btrim(p_map) = '' or jsonb_array_length(p_assignments) <> 10 then raise exception 'invalid schedule rebalancing input'; end if;
  select count(distinct (item.value ->> 'playerId')::bigint), count(*) filter (where item.value ->> 'team' = 'A'), count(*) filter (where item.value ->> 'team' = 'B')
  into distinct_player_count, team_a_count, team_b_count from jsonb_array_elements(p_assignments) as item(value);
  if distinct_player_count <> 10 or team_a_count <> 5 or team_b_count <> 5 then raise exception 'invalid team assignments'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value) where item.value ->> 'separatedGroup' is not null
    group by (item.value ->> 'separatedGroup')::smallint having count(*) > 2
  ) then raise exception 'separated group has too many players'; end if;
  select array_agg(player.nickname order by item.position) filter (where item.value ->> 'team' = 'A'), array_agg(player.nickname order by item.position) filter (where item.value ->> 'team' = 'B')
  into team_a_names, team_b_names
  from jsonb_array_elements(p_assignments) with ordinality as item(value, position)
  join public.players as player on player.id = (item.value ->> 'playerId')::bigint and player.is_active = true and player.tier <> 6;
  if cardinality(team_a_names) <> 5 or cardinality(team_b_names) <> 5 then raise exception 'assigned player not found'; end if;
  delete from public.match_players where match_id = p_match_id;
  insert into public.match_players (match_id, player_id, team, separated_group)
  select p_match_id, (item.value ->> 'playerId')::bigint, (item.value ->> 'team')::public.match_team, (item.value ->> 'separatedGroup')::smallint
  from jsonb_array_elements(p_assignments) as item(value);
  update public.matches set scheduled_at = p_scheduled_at, map = btrim(p_map), team_a = team_a_names, team_b = team_b_names where id = p_match_id;
end;
$$;

drop function if exists public.rebalance_scheduled_match(bigint, timestamptz, text, jsonb);
revoke all on function public.rebalance_scheduled_match(bigint, timestamptz, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.rebalance_scheduled_match(bigint, timestamptz, text, jsonb, uuid) to service_role;

create or replace function public.update_scheduled_match(p_match_id bigint, p_scheduled_at timestamptz, p_map text, p_actor_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform public.assert_actor_role(p_actor_id, false);
  if p_scheduled_at is null or btrim(coalesce(p_map, '')) = '' then raise exception 'invalid schedule input'; end if;
  update public.matches set scheduled_at = p_scheduled_at, map = btrim(p_map) where id = p_match_id and status = 'scheduled';
  if not found then raise exception 'scheduled match not found'; end if;
end;
$$;

create or replace function public.delete_scheduled_match(p_match_id bigint, p_actor_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform public.assert_actor_role(p_actor_id, false);
  delete from public.matches where id = p_match_id and status = 'scheduled';
  if not found then raise exception 'scheduled match not found'; end if;
end;
$$;

revoke all on function public.update_scheduled_match(bigint, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function public.delete_scheduled_match(bigint, uuid) from public, anon, authenticated;
grant execute on function public.update_scheduled_match(bigint, timestamptz, text, uuid) to service_role;
grant execute on function public.delete_scheduled_match(bigint, uuid) to service_role;
