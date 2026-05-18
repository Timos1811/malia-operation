import { authenticate, errorResponse, handleOptions, jsonResponse, requireAdmin, serviceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;

  try {
    const user = await authenticate(req);
    requireAdmin(user);

    const supabase = serviceClient();
    const { event_name } = await req.json();
    if (!event_name) return jsonResponse({ error: 'Event name is required' }, 400);

    const { data: logs, error } = await supabase
      .from('wristband_scan_logs')
      .select('id')
      .eq('event_name', event_name)
      .eq('status', 'success');

    if (error) throw error;
    if (!logs || logs.length === 0) return jsonResponse({ message: 'No logs to reset', count: 0 });

    const ids = logs.map((l) => l.id);
    const batchSize = 50;
    let updatedCount = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error: updateError } = await supabase
        .from('wristband_scan_logs')
        .update({ status: 'processed' })
        .in('id', batch);
      if (updateError) throw updateError;
      updatedCount += batch.length;
    }

    console.log(`resetEventScans: ${user.id} reset ${updatedCount} logs for ${event_name}`);
    return jsonResponse({ success: true, count: updatedCount });
  } catch (err) {
    return errorResponse(err);
  }
});
