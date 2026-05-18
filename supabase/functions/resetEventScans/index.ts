import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { event_name } = await req.json();
    if (!event_name) {
      return Response.json({ error: 'Event name is required' }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from('wristband_scan_logs')
      .select('id')
      .eq('event_name', event_name)
      .eq('status', 'success');

    if (error) throw error;
    if (!logs || logs.length === 0) {
      return Response.json({ message: 'No logs to reset', count: 0 });
    }

    const ids = logs.map(l => l.id);
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

    return Response.json({ success: true, count: updatedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
