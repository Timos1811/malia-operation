-- Add email column to public.users and keep it synced from auth.users via trigger
alter table public.users add column if not exists email text;

-- Backfill email from auth.users
update public.users pu
set email = au.email
from auth.users au
where pu.id = au.id and (pu.email is null or pu.email <> au.email);

-- Update the new-user trigger to populate email too
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, role, status, full_name, email)
  values (
    new.id,
    'user',
    'pending',
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.users.full_name, excluded.full_name);
  return new;
end;
$$;

-- Admin-only RPC to list all users (returns email + full_name + role + status)
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
set search_path = public
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

grant execute on function public.list_all_users() to authenticated;
