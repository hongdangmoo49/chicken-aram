alter table public.players
  add column rank_points integer not null default 0;

update public.players
set rank_points = (wins - losses) * 3
where tier between 1 and 5;

do $$
begin
  loop
    update public.players
    set tier = tier - 1, rank_points = rank_points - 25
    where tier between 2 and 5 and rank_points > 25;
    exit when not found;
  end loop;

  loop
    update public.players
    set tier = tier + 1, rank_points = rank_points + 15
    where tier between 1 and 4 and rank_points <= -15;
    exit when not found;
  end loop;
end;
$$;

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
    while new.tier > 1 and new.rank_points > 25 loop
      new.tier := new.tier - 1;
      new.rank_points := new.rank_points - 25;
    end loop;
    while new.tier < 5 and new.rank_points <= -15 loop
      new.tier := new.tier + 1;
      new.rank_points := new.rank_points + 15;
    end loop;
  end if;
  return new;
end;
$$;

create trigger apply_player_rank_progression
before update of wins, losses on public.players
for each row execute function public.apply_player_rank_progression();

create or replace function public.set_player_tiers(changes jsonb, p_actor_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.app_role;
  before_values jsonb;
  after_values jsonb;
  updated_count integer;
begin
  select role into actor_role from public.profiles where id = p_actor_id;
  if actor_role is null or actor_role not in ('admin'::public.app_role, 'super_admin'::public.app_role) then
    raise exception 'admin role required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId', player.id,
    'nickname', player.nickname,
    'tier', player.tier,
    'order', player.tier_order,
    'points', player.rank_points
  ) order by player.id), '[]'::jsonb)
  into before_values
  from public.players as player
  join jsonb_array_elements(changes) as change(value)
    on player.id = (change.value ->> 'playerId')::bigint;

  if jsonb_array_length(before_values) <> jsonb_array_length(changes) then
    raise exception 'player ranking update count mismatch';
  end if;

  update public.players as player
  set
    rank_points = case
      when actor_role = 'super_admin' and change.value ? 'points' then (change.value ->> 'points')::integer
      when actor_role = 'admin' and player.tier between 1 and 5 and (change.value ->> 'tier')::integer between 1 and 5 and (change.value ->> 'tier')::integer < player.tier
        then player.rank_points - (player.tier - (change.value ->> 'tier')::integer) * 25
      when actor_role = 'admin' and player.tier between 1 and 5 and (change.value ->> 'tier')::integer between 1 and 5 and (change.value ->> 'tier')::integer > player.tier
        then player.rank_points + ((change.value ->> 'tier')::integer - player.tier) * 15
      else player.rank_points
    end,
    tier = (change.value ->> 'tier')::smallint,
    tier_order = (change.value ->> 'order')::integer
  from jsonb_array_elements(changes) as change(value)
  where player.id = (change.value ->> 'playerId')::bigint;

  get diagnostics updated_count = row_count;
  if updated_count <> jsonb_array_length(changes) then
    raise exception 'player ranking update count mismatch';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId', player.id,
    'nickname', player.nickname,
    'tier', player.tier,
    'order', player.tier_order,
    'points', player.rank_points
  ) order by player.id), '[]'::jsonb)
  into after_values
  from public.players as player
  join jsonb_array_elements(changes) as change(value)
    on player.id = (change.value ->> 'playerId')::bigint;

  insert into public.audit_logs (actor_id, actor_name, action, entity_type, before_data, after_data)
  values (
    p_actor_id,
    coalesce((select display_name from public.profiles where id = p_actor_id), '알 수 없음'),
    'players.rank.update',
    'player',
    before_values,
    after_values
  );
  return updated_count;
end;
$$;

revoke all on function public.set_player_tiers(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.set_player_tiers(jsonb, uuid) to service_role;
