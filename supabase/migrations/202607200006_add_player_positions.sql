alter table public.players
  add column preferred_positions text[] not null default '{}',
  add constraint players_preferred_positions_allowed check (
    preferred_positions <@ array['올라운더', '탱커', '브루저', '암살자', '메이지', '원딜', '서포터']::text[]
  ),
  add constraint players_preferred_positions_limit check (cardinality(preferred_positions) <= 3),
  add constraint players_preferred_positions_allrounder check (
    not ('올라운더' = any(preferred_positions)) or cardinality(preferred_positions) = 1
  );
