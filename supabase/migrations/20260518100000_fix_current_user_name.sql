-- Fix current_user_name to source from auth.users metadata instead of public.users.full_name
-- (column may not exist yet on every install)

alter table public.users add column if not exists full_name text;

create or replace function public.current_user_name()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select raw_user_meta_data->>'full_name' from auth.users where id = auth.uid()),
    (select email from auth.users where id = auth.uid())
  );
$$;
