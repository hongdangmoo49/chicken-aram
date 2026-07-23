create or replace function public.recalculate_player_records()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(20260722);

  update public.players as player
  set (wins, losses) = (
    select
      count(*) filter (where match.winner = member.team)::integer,
      count(*) filter (where match.winner <> member.team)::integer
    from public.match_players as member
    join public.matches as match on match.id = member.match_id
    where member.player_id = player.id and match.status = 'completed'
  )
  where player.id > 0;
end;
$$;

select public.recalculate_player_records();
