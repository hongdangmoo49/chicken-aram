create or replace function public.create_balanced_schedule(
  p_scheduled_at timestamptz,
  p_map text,
  p_created_by uuid,
  p_assignments jsonb
)
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
  if p_scheduled_at is null or btrim(p_map) = '' or jsonb_array_length(p_assignments) <> 10 then
    raise exception 'invalid schedule input';
  end if;
  select
    count(distinct (item.value ->> 'playerId')::bigint),
    count(*) filter (where item.value ->> 'team' = 'A'),
    count(*) filter (where item.value ->> 'team' = 'B')
  into distinct_player_count, team_a_count, team_b_count
  from jsonb_array_elements(p_assignments) as item(value);
  if distinct_player_count <> 10 or team_a_count <> 5 or team_b_count <> 5 then
    raise exception 'invalid team assignments';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'separatedGroup' is not null
    group by (item.value ->> 'separatedGroup')::smallint
    having count(*) > 2
  ) then
    raise exception 'separated group has too many players';
  end if;

  select
    array_agg(player.nickname order by item.position) filter (where item.value ->> 'team' = 'A'),
    array_agg(player.nickname order by item.position) filter (where item.value ->> 'team' = 'B')
  into team_a_names, team_b_names
  from jsonb_array_elements(p_assignments) with ordinality as item(value, position)
  join public.players as player on player.id = (item.value ->> 'playerId')::bigint;
  if cardinality(team_a_names) <> 5 or cardinality(team_b_names) <> 5 then
    raise exception 'assigned player not found';
  end if;

  insert into public.matches (scheduled_at, map, status, team_a, team_b, created_by)
  values (p_scheduled_at, btrim(p_map), 'scheduled', team_a_names, team_b_names, p_created_by)
  returning id into new_match_id;

  insert into public.match_players (match_id, player_id, team, separated_group)
  select
    new_match_id,
    (item.value ->> 'playerId')::bigint,
    (item.value ->> 'team')::public.match_team,
    (item.value ->> 'separatedGroup')::smallint
  from jsonb_array_elements(p_assignments) as item(value);

  return new_match_id;
end;
$$;

revoke all on function public.create_balanced_schedule(timestamptz, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_balanced_schedule(timestamptz, text, uuid, jsonb) to service_role;
