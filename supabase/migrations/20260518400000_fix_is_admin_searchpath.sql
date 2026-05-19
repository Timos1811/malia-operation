-- Fix is_admin/is_approved search path to include auth schema for auth.uid()
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.list_all_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
    select u.id, u.email, u.full_name, u.role, u.status, u.created_at
    from public.users u
    order by
      case when u.status = 'pending' then 0 else 1 end,
      u.created_at desc;
end;
$$;
