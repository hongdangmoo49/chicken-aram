create unique index if not exists players_nickname_lower_key
  on public.players (lower(btrim(nickname)));
