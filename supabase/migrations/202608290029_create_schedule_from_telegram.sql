alter table public.telegram_recruitments
  add column match_id bigint unique references public.matches(id) on delete set null;

create or replace function public.create_telegram_schedule(
  p_recruitment_id bigint,
  p_scheduled_at timestamptz,
  p_map text,
  p_created_by uuid,
  p_assignments jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  existing_match_id bigint;
  new_match_id bigint;
begin
  select match_id into existing_match_id
  from public.telegram_recruitments
  where id = p_recruitment_id and status = 'full'
  for update;

  if not found then
    raise exception 'full recruitment not found';
  end if;
  if existing_match_id is not null then
    return jsonb_build_object('matchId', existing_match_id, 'created', false);
  end if;

  new_match_id := public.create_balanced_schedule(p_scheduled_at, p_map, p_created_by, p_assignments);
  update public.telegram_recruitments set match_id = new_match_id where id = p_recruitment_id;
  return jsonb_build_object('matchId', new_match_id, 'created', true);
end;
$$;

revoke all on function public.create_telegram_schedule(bigint, timestamptz, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_telegram_schedule(bigint, timestamptz, text, uuid, jsonb) to service_role;
