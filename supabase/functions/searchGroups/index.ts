import { authenticate, errorResponse, handleOptions, jsonResponse, serviceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;

  try {
    const user = await authenticate(req);
    const supabase = serviceClient();

    const { sales_rep, event_name, event_status } = await req.json();

    let query = supabase
      .from('table_data')
      .select('*')
      .order('created_at', { ascending: false });

    // Non-admin: only see own data regardless of requested sales_rep
    if (user.role !== 'admin') {
      query = query.eq('sales_rep', user.full_name);
    } else if (sales_rep && sales_rep !== 'all') {
      query = query.eq('sales_rep', sales_rep);
    }

    // Event filter pushed to DB level via wristbands join
    if (event_name && event_name !== 'all') {
      const { data: wristbands, error: wbErr } = await supabase
        .from('wristbands')
        .select('order_number')
        .contains('allowed_events', [event_name]);
      if (wbErr) throw wbErr;

      const orderNumbers = Array.from(
        new Set((wristbands || []).map((w) => w.order_number).filter(Boolean))
      );

      if (event_status === 'bought') {
        if (orderNumbers.length === 0) return jsonResponse([]);
        query = query.in('order_number', orderNumbers);
      } else if (event_status === 'not_bought') {
        if (orderNumbers.length > 0) {
          query = query.not('order_number', 'in', `(${orderNumbers.map((o) => `"${o}"`).join(',')})`);
        }
      }
    }

    const { data, error } = await query.limit(5000);
    if (error) throw error;

    return jsonResponse(data || []);
  } catch (err) {
    return errorResponse(err);
  }
});
