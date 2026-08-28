alter table public.profiles
  add column telegram_user_id bigint,
  add column telegram_username text;

create unique index profiles_telegram_user_id_key
  on public.profiles (telegram_user_id)
  where telegram_user_id is not null;

create index telegram_recruitment_votes_user_idx
  on public.telegram_recruitment_votes (telegram_user_id, created_at desc);

create table public.telegram_link_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.telegram_link_tokens enable row level security;
revoke all on table public.telegram_link_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.telegram_link_tokens to service_role;

create or replace function public.consume_telegram_link(
  p_token_hash text,
  p_telegram_user_id bigint,
  p_telegram_username text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  target_profile_id uuid;
  target_display_name text;
begin
  delete from public.telegram_link_tokens where expires_at <= now();

  select profile_id into target_profile_id
  from public.telegram_link_tokens
  where token_hash = p_token_hash and expires_at > now()
  for update;

  if not found or p_telegram_user_id <= 0 then
    return jsonb_build_object('status', 'invalid');
  end if;

  if exists (
    select 1 from public.profiles
    where telegram_user_id = p_telegram_user_id and id <> target_profile_id
  ) then
    return jsonb_build_object('status', 'already_linked');
  end if;

  update public.profiles
  set telegram_user_id = p_telegram_user_id,
      telegram_username = nullif(btrim(p_telegram_username), '')
  where id = target_profile_id
  returning display_name into target_display_name;

  delete from public.telegram_link_tokens where token_hash = p_token_hash;
  return jsonb_build_object('status', 'ok', 'displayName', coalesce(target_display_name, '치증 사용자'));
end;
$$;

revoke all on function public.consume_telegram_link(text, bigint, text) from public, anon, authenticated;
grant execute on function public.consume_telegram_link(text, bigint, text) to service_role;
