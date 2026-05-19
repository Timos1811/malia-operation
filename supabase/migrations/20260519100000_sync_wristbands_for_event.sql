-- Returns the full set of wristbands valid for a specific event instance,
-- plus the set of nfc_ids that have already been scanned (success) for that event.
-- Client uses this to populate IndexedDB before going offline.

create or replace function public.sync_wristbands_for_event(p_event_name text)
returns jsonb
language sql
stable
security invoker
set search_path = public, auth
as $$
  select jsonb_build_object(
    'event_name', p_event_name,
    'synced_at', now(),
    'wristbands', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'nfc_id', lower(w.nfc_id),
          'order_number', w.order_number,
          'customer_name', w.customer_name,
          'status', w.status,
          'valid_until', w.valid_until,
          'allowed_events', w.allowed_events
        ))
        from public.wristbands w
        where w.allowed_events @> array[p_event_name]::text[]
          and w.status = 'active'
          and (w.valid_until is null or w.valid_until::date >= current_date)
      ),
      '[]'::jsonb
    ),
    'already_scanned_ids', coalesce(
      (
        select jsonb_agg(distinct lower(s.nfc_id))
        from public.wristband_scan_logs s
        where s.event_name = p_event_name
          and s.status = 'success'
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.sync_wristbands_for_event(text) to authenticated;

-- Bulk-insert offline scan logs (called when device comes back online).
-- Each entry: { nfc_id, event_name, scan_time, scanned_by, customer_name, order_number, status }
create or replace function public.bulk_insert_scan_logs(p_logs jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_inserted int := 0;
begin
  insert into public.wristband_scan_logs (
    nfc_id, event_name, scan_time, status, message, scanned_by, customer_name, order_number
  )
  select
    lower(coalesce(x->>'nfc_id', '')),
    x->>'event_name',
    coalesce((x->>'scan_time')::timestamptz, now()),
    coalesce(x->>'status', 'success'),
    coalesce(x->>'message', ''),
    coalesce(x->>'scanned_by', ''),
    coalesce(x->>'customer_name', ''),
    coalesce(x->>'order_number', '')
  from jsonb_array_elements(p_logs) as x
  where x->>'nfc_id' is not null and x->>'event_name' is not null;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('inserted', v_inserted);
end;
$$;

grant execute on function public.bulk_insert_scan_logs(jsonb) to authenticated;
