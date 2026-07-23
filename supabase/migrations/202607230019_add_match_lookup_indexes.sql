create index if not exists match_players_player_id_idx
  on public.match_players (player_id);

create index if not exists matches_completed_played_at_idx
  on public.matches (played_at desc)
  where status = 'completed';
