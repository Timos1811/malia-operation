import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { sales_rep, event_name, event_status } = await req.json();

    let query = supabase.from('table_data').select('*').order('created_at', { ascending: false }).limit(1000);
    if (sales_rep && sales_rep !== 'all') {
      query = query.eq('sales_rep', sales_rep);
    }

    const { data: groups, error } = await query;
    if (error) throw error;

    if (!event_name || event_name === 'all' || !event_status || event_status === 'all') {
      return Response.json(groups);
    }

    // Filter by event — check wristbands.allowed_events
    const { data: wristbands } = await supabase
      .from('wristbands')
      .select('order_number, allowed_events')
      .order('created_at', { ascending: false })
      .limit(3000);

    const ordersWithEvent = new Set<string>();
    for (const wb of wristbands || []) {
      if (Array.isArray(wb.allowed_events) && wb.allowed_events.includes(event_name)) {
        if (wb.order_number) ordersWithEvent.add(wb.order_number);
      }
    }

    const filtered = (groups || []).filter(group => {
      if (!group.order_number) return false;
      const hasEvent = ordersWithEvent.has(group.order_number);
      if (event_status === 'bought') return hasEvent;
      if (event_status === 'not_bought') return !hasEvent;
      return true;
    });

    return Response.json(filtered);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
