update public.players as player
set preferred_positions = (
  select coalesce(array_agg(deduped.position order by deduped.first_index), '{}'::text[])
  from (
    select selected.position, min(selected.position_order) as first_index
    from unnest(player.preferred_positions) with ordinality as selected(position, position_order)
    group by selected.position
    order by min(selected.position_order)
    limit 2
  ) as deduped
)
where cardinality(player.preferred_positions) > 0;

alter table public.players
  drop constraint if exists players_preferred_positions_limit,
  add constraint players_preferred_positions_limit check (cardinality(preferred_positions) <= 2),
  add constraint players_preferred_positions_unique check (
    cardinality(preferred_positions) < 2 or preferred_positions[1] <> preferred_positions[2]
  );
