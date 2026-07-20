update public.profiles
set role = 'super_admin'
where id = (
  select id
  from auth.users
  where lower(email) = 'ssh0611@gmail.com'
);
