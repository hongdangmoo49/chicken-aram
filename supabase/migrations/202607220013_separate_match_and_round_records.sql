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
      count(*) filter (where match.winner = member.team)::integer as wins,
      count(*) filter (where match.winner <> member.team)::integer as losses
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

select public.recalculate_player_records();
