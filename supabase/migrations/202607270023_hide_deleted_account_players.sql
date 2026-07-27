alter table public.players
  add column is_active boolean not null default true;

update public.players as player
set is_active = false
where exists (
  select 1
  from public.audit_logs as log
  where log.action = 'members.account.delete'
    and log.before_data ->> 'playerId' = player.id::text
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_nickname text;
  linked_player_id bigint;
begin
  requested_nickname := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));

  select player.id into linked_player_id
  from public.players as player
  where lower(btrim(player.nickname)) = lower(requested_nickname)
  for update;

  if linked_player_id is null then
    insert into public.players (nickname, tier) values (requested_nickname, 4) returning id into linked_player_id;
  elsif exists (select 1 from public.profiles where player_id = linked_player_id) then
    raise exception 'nickname already claimed';
  end if;

  update public.players set is_active = true where id = linked_player_id;
  insert into public.profiles (id, display_name, player_id) values (new.id, requested_nickname, linked_player_id);
  return new;
end;
$$;
