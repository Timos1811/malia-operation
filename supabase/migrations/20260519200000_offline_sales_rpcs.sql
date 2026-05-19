-- =========================================================================
-- 1. cache_data_for_new_sale()
--    Returns everything the client needs to operate NewSale offline:
--    - active wristband NFC ids (for duplicate scan check)
--    - recent order numbers (for duplicate order check)
--    - unclaimed pending sales (so a seller can still "claim" a caspar entry offline)
--    - attractions, hotels, combos, app_settings
-- =========================================================================
create or replace function public.cache_data_for_new_sale()
returns jsonb
language sql
stable
security invoker
set search_path = public, auth
as $$
  select jsonb_build_object(
    'cached_at', now(),
    'active_nfc_ids', coalesce((
      select jsonb_agg(distinct lower(nfc_id))
      from public.wristbands
      where status = 'active' and nfc_id is not null
    ), '[]'::jsonb),
    'order_numbers', coalesce((
      select jsonb_agg(distinct order_number)
      from (
        select order_number from public.table_data
        where order_number is not null
        union
        select order_number from public.pending_sales
        where order_number is not null
      ) o
    ), '[]'::jsonb),
    'unclaimed_pending_sales', coalesce((
      select jsonb_agg(to_jsonb(ps))
      from public.pending_sales ps
      where ps.sales_rep is null or ps.sales_rep = ''
    ), '[]'::jsonb),
    'attractions', coalesce((
      select jsonb_agg(to_jsonb(a)) from public.attractions a
    ), '[]'::jsonb),
    'hotels', coalesce((
      select jsonb_agg(to_jsonb(h)) from public.hotels h
    ), '[]'::jsonb),
    'combos', coalesce((
      select jsonb_agg(to_jsonb(c)) from public.combos c
    ), '[]'::jsonb),
    'app_settings', coalesce((
      select jsonb_agg(to_jsonb(s)) from public.app_settings s
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.cache_data_for_new_sale() to authenticated;


-- =========================================================================
-- 2. create_sale_atomic(payload)
--
--    Atomically:
--      - check duplicate order_number
--      - check duplicate wristband nfc_ids
--      - claim an unclaimed pending_sale OR create a new one
--      - insert all wristbands
--
--    Returns:
--      { status: 'created', pending_sale_id: uuid, created_wristbands: int }
--      { status: 'conflict_order', existing_in: 'pending_sales' | 'table_data' }
--      { status: 'conflict_wristbands', conflicting: [nfc_ids...] }
--
--    Payload shape:
--      {
--        order_number, departure_date, customer, nights, gender, hotel, company,
--        requested_amount, sales_rep, is_combo, timestamp,
--        wristbands: [{ nfc_id, customer_name, allowed_events, valid_until }, ...]
--      }
-- =========================================================================
create or replace function public.create_sale_atomic(p_sale jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_order_number text := p_sale->>'order_number';
  v_existing_table int;
  v_existing_pending_claimed int;
  v_unclaimed_id uuid;
  v_sale_id uuid;
  v_wb_payload jsonb := coalesce(p_sale->'wristbands', '[]'::jsonb);
  v_nfc_ids text[];
  v_conflicting_nfc text[];
  v_wb_count int;
begin
  if v_order_number is null or v_order_number = '' then
    return jsonb_build_object('status', 'error', 'message', 'missing order_number');
  end if;

  -- Already finalized in table_data?
  select count(*) into v_existing_table from public.table_data where order_number = v_order_number;
  if v_existing_table > 0 then
    return jsonb_build_object('status', 'conflict_order', 'existing_in', 'table_data');
  end if;

  -- Already claimed pending sale with same order_number? (claimed = has sales_rep)
  select count(*) into v_existing_pending_claimed
  from public.pending_sales
  where order_number = v_order_number
    and sales_rep is not null and sales_rep <> '';
  if v_existing_pending_claimed > 0 then
    return jsonb_build_object('status', 'conflict_order', 'existing_in', 'pending_sales');
  end if;

  -- Collect requested nfc_ids
  select coalesce(array_agg(lower(x->>'nfc_id')), '{}')
    into v_nfc_ids
    from jsonb_array_elements(v_wb_payload) as x
    where x->>'nfc_id' is not null and x->>'nfc_id' <> '';

  -- Check that none of these wristbands already exist (active means taken by another order)
  if v_nfc_ids is not null and array_length(v_nfc_ids, 1) > 0 then
    select array_agg(lower(w.nfc_id))
      into v_conflicting_nfc
      from public.wristbands w
      where lower(w.nfc_id) = any(v_nfc_ids)
        and w.status = 'active';
    if v_conflicting_nfc is not null and array_length(v_conflicting_nfc, 1) > 0 then
      return jsonb_build_object('status', 'conflict_wristbands', 'conflicting', to_jsonb(v_conflicting_nfc));
    end if;
  end if;

  -- Find an unclaimed pending sale to "claim" (preserves admin pre-filled money fields)
  select id into v_unclaimed_id
  from public.pending_sales
  where order_number = v_order_number
    and (sales_rep is null or sales_rep = '')
  limit 1;

  if v_unclaimed_id is not null then
    update public.pending_sales
    set departure_date = coalesce(p_sale->>'departure_date', departure_date),
        customer = coalesce(p_sale->>'customer', customer),
        nights = coalesce(p_sale->>'nights', nights),
        gender = coalesce(p_sale->>'gender', gender),
        hotel = coalesce(p_sale->>'hotel', hotel),
        company = coalesce(p_sale->>'company', company),
        requested_amount = coalesce(p_sale->>'requested_amount', requested_amount),
        sales_rep = coalesce(p_sale->>'sales_rep', sales_rep),
        is_combo = coalesce((p_sale->>'is_combo')::boolean, is_combo)
    where id = v_unclaimed_id
    returning id into v_sale_id;
  else
    insert into public.pending_sales (
      order_number, departure_date, customer, nights, gender, hotel, company,
      requested_amount, sales_rep, is_combo,
      eur_amount, shekel_amount, dollar_amount, bit_amount, eur_status
    )
    values (
      v_order_number,
      p_sale->>'departure_date',
      p_sale->>'customer',
      p_sale->>'nights',
      p_sale->>'gender',
      p_sale->>'hotel',
      p_sale->>'company',
      p_sale->>'requested_amount',
      p_sale->>'sales_rep',
      coalesce((p_sale->>'is_combo')::boolean, false),
      '', '', '', '', '0'
    )
    returning id into v_sale_id;
  end if;

  -- Insert wristbands
  insert into public.wristbands (
    nfc_id, order_number, customer_name, allowed_events, status, valid_until
  )
  select
    lower(x->>'nfc_id'),
    v_order_number,
    coalesce(x->>'customer_name', 'אורח'),
    case
      when jsonb_typeof(x->'allowed_events') = 'array'
      then array(select jsonb_array_elements_text(x->'allowed_events'))
      else '{}'::text[]
    end,
    'active',
    nullif(x->>'valid_until', '')
  from jsonb_array_elements(v_wb_payload) as x
  where x->>'nfc_id' is not null and x->>'nfc_id' <> '';

  get diagnostics v_wb_count = row_count;

  return jsonb_build_object(
    'status', 'created',
    'pending_sale_id', v_sale_id,
    'created_wristbands', v_wb_count
  );
end;
$$;

grant execute on function public.create_sale_atomic(jsonb) to authenticated;
