create or replace function public.set_player_tiers(changes jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.players as player
  set tier = (change.value ->> 'tier')::smallint
  from jsonb_array_elements(changes) as change(value)
  where player.id = (change.value ->> 'playerId')::bigint;

  get diagnostics updated_count = row_count;
  if updated_count <> jsonb_array_length(changes) then
    raise exception 'player tier update count mismatch';
  end if;
  return updated_count;
end;
$$;

revoke all on function public.set_player_tiers(jsonb) from public, anon, authenticated;
grant execute on function public.set_player_tiers(jsonb) to service_role;
