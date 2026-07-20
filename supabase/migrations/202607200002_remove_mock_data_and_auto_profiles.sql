delete from public.matches;
delete from public.players;

alter table public.players drop constraint if exists players_nickname_key;

do $$
declare
  profile_record record;
  new_player_id bigint;
  nickname text;
begin
  for profile_record in select id, display_name from public.profiles loop
    nickname := coalesce(
      nullif(btrim(profile_record.display_name), ''),
      'player-' || left(profile_record.id::text, 8)
    );

    insert into public.players (nickname, tier)
    values (nickname, 4)
    returning id into new_player_id;

    update public.profiles
    set display_name = nickname, player_id = new_player_id
    where id = profile_record.id;
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  nickname text;
  new_player_id bigint;
begin
  nickname := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.players (nickname, tier)
  values (nickname, 4)
  returning id into new_player_id;

  insert into public.profiles (id, display_name, player_id)
  values (new.id, nickname, new_player_id);

  return new;
end;
$$;

create or replace function public.sync_profile_player_nickname()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.player_id is not null and new.display_name is distinct from old.display_name then
    update public.players
    set nickname = new.display_name
    where id = new.player_id;
  end if;
  return new;
end;
$$;

create trigger on_profile_nickname_updated
  after update of display_name on public.profiles
  for each row execute procedure public.sync_profile_player_nickname();
