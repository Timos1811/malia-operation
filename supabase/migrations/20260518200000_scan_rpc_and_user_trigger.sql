-- 1. Index on nfc_id for fast scanner lookups (regular btree)
create index if not exists wristbands_nfc_id_idx
  on public.wristbands (nfc_id);

-- 2. Auto-create public.users row when auth.users is inserted (signup)
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, role, status, full_name)
  values (
    new.id,
    'user',
    'pending',
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 3. Backfill: create public.users for any auth.users that don't have a profile
insert into public.users (id, role, status, full_name)
select
  au.id,
  'user',
  'pending',
  coalesce(au.raw_user_meta_data->>'full_name', au.email)
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do nothing;

-- 4. Scan RPC: one call replaces 3 client queries
-- Returns: status (success|already_scanned|warning|inactive|expired|not_found), wristband row, sales_rep
create or replace function public.scan_wristband(
  p_nfc_id text,
  p_event_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wristband public.wristbands%rowtype;
  v_today_str text := to_char(now(), 'YYYY-MM-DD');
  v_already_scanned boolean;
  v_status text;
  v_norm text := lower(p_nfc_id);
begin
  -- Lookup wristband by nfc_id (case-insensitive)
  select * into v_wristband
  from public.wristbands
  where lower(nfc_id) = v_norm
  limit 1;

  if v_wristband.id is null then
    return jsonb_build_object('status', 'not_found', 'nfc_id', p_nfc_id);
  end if;

  if v_wristband.status = 'inactive' then
    return jsonb_build_object('status', 'inactive', 'wristband', to_jsonb(v_wristband));
  end if;

  if v_wristband.valid_until is not null and v_today_str > v_wristband.valid_until then
    return jsonb_build_object('status', 'expired', 'wristband', to_jsonb(v_wristband));
  end if;

  if not (coalesce(v_wristband.allowed_events, '{}'::text[]) @> array[p_event_name]) then
    return jsonb_build_object('status', 'warning', 'wristband', to_jsonb(v_wristband));
  end if;

  select exists (
    select 1 from public.wristband_scan_logs
    where nfc_id = v_norm
      and event_name = p_event_name
      and status = 'success'
  ) into v_already_scanned;

  if v_already_scanned then
    v_status := 'already_scanned';
  else
    v_status := 'success';
  end if;

  return jsonb_build_object('status', v_status, 'wristband', to_jsonb(v_wristband));
end;
$$;

grant execute on function public.scan_wristband(text, text) to authenticated;
