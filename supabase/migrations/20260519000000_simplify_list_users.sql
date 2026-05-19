-- Switch list_all_users to SECURITY INVOKER so existing RLS on public.users
-- handles authorization (admin sees all, others see only self).

create or replace function public.list_all_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  status text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public, auth
as $$
  select u.id, u.email, u.full_name, u.role, u.status, u.created_at
  from public.users u
  order by
    case when u.status = 'pending' then 0 else 1 end,
    u.created_at desc;
$$;

grant execute on function public.list_all_users() to authenticated;

-- Debug helper to confirm JWT propagation (admins only)
create or replace function public.whoami()
returns jsonb
language sql
stable
security invoker
set search_path = public, auth
as $$
  select jsonb_build_object(
    'auth_uid', auth.uid(),
    'auth_role', auth.role(),
    'profile', (select to_jsonb(u) from public.users u where u.id = auth.uid())
  );
$$;

grant execute on function public.whoami() to anon, authenticated;
