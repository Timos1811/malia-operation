-- Enable RLS and create policies for all tables
-- Run this in Supabase SQL Editor.

-- Helper: is_admin() based on users table
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
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
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.current_user_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select full_name from public.users where id = auth.uid();
$$;

-- USERS table — special handling
alter table public.users enable row level security;

drop policy if exists "users select own or admin" on public.users;
create policy "users select own or admin" on public.users
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "users insert self pending" on public.users;
create policy "users insert self pending" on public.users
  for insert with check (
    id = auth.uid()
    and role = 'user'
    and status = 'pending'
  );

drop policy if exists "users update self limited" on public.users;
create policy "users update self limited" on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "users admin update any" on public.users;
create policy "users admin update any" on public.users
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "users admin delete" on public.users;
create policy "users admin delete" on public.users
  for delete using (public.is_admin());

-- Prevent regular users from elevating role or status via update
create or replace function public.protect_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select public.is_admin() into caller_is_admin;
  if not caller_is_admin then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change role';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Only admins can change status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_role_trg on public.users;
create trigger protect_user_role_trg
  before update on public.users
  for each row execute function public.protect_user_role();

-- Generic helper: approved users can SELECT/INSERT/UPDATE/DELETE on data tables.
-- Admin-only DELETE on financial tables.
do $$
declare
  t text;
  data_tables text[] := array[
    'table_data','pending_sales','wristbands','tasks','expenses',
    'attractions','combos','caspar_fillings','wristband_scan_logs',
    'app_settings','expense_events','money_locations','hotels'
  ];
begin
  foreach t in array data_tables loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "approved select" on public.%I;', t);
    execute format(
      'create policy "approved select" on public.%I for select using (public.is_approved());',
      t
    );

    execute format('drop policy if exists "approved insert" on public.%I;', t);
    execute format(
      'create policy "approved insert" on public.%I for insert with check (public.is_approved());',
      t
    );

    execute format('drop policy if exists "approved update" on public.%I;', t);
    execute format(
      'create policy "approved update" on public.%I for update using (public.is_approved()) with check (public.is_approved());',
      t
    );

    execute format('drop policy if exists "admin delete" on public.%I;', t);
    execute format(
      'create policy "admin delete" on public.%I for delete using (public.is_admin());',
      t
    );
  end loop;
end $$;

-- Tighter: financial tables — only owner or admin can update/delete
-- (Apply where sales_rep column exists)
drop policy if exists "approved update" on public.table_data;
create policy "table_data update own or admin" on public.table_data
  for update using (public.is_admin() or sales_rep = public.current_user_name())
  with check (public.is_admin() or sales_rep = public.current_user_name());

drop policy if exists "approved update" on public.expenses;
create policy "expenses update own or admin" on public.expenses
  for update using (public.is_admin() or sales_rep = public.current_user_name())
  with check (public.is_admin() or sales_rep = public.current_user_name());

drop policy if exists "approved update" on public.pending_sales;
create policy "pending_sales update own or admin" on public.pending_sales
  for update using (public.is_admin() or sales_rep = public.current_user_name())
  with check (public.is_admin() or sales_rep = public.current_user_name());

-- Indexes that the new searchGroups/EventStats/scanner rely on
create index if not exists table_data_sales_rep_created_at_idx
  on public.table_data (sales_rep, created_at desc);

create index if not exists table_data_order_number_idx
  on public.table_data (order_number);

create index if not exists pending_sales_order_number_idx
  on public.pending_sales (order_number);

create index if not exists pending_sales_sales_rep_idx
  on public.pending_sales (sales_rep);

create index if not exists wristbands_allowed_events_gin
  on public.wristbands using gin (allowed_events);

create index if not exists wristbands_order_number_idx
  on public.wristbands (order_number);

create index if not exists wristbands_nfc_id_lower_idx
  on public.wristbands ((lower(nfc_id)));

create index if not exists scan_logs_event_status_time_idx
  on public.wristband_scan_logs (event_name, status, scan_time desc);

create index if not exists expenses_sales_rep_idx
  on public.expenses (sales_rep);

create index if not exists expenses_expense_date_idx
  on public.expenses (expense_date desc);
