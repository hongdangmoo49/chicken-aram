create or replace function public.set_member_roles(changes jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.profiles as profile
  set role = (change.value ->> 'role')::public.app_role
  from jsonb_array_elements(changes) as change(value)
  where profile.id = (change.value ->> 'userId')::uuid
    and profile.role <> 'super_admin';

  get diagnostics updated_count = row_count;
  if updated_count <> jsonb_array_length(changes) then
    raise exception 'member role update count mismatch';
  end if;
  return updated_count;
end;
$$;

revoke all on function public.set_member_roles(jsonb) from public, anon, authenticated;
grant execute on function public.set_member_roles(jsonb) to service_role;
