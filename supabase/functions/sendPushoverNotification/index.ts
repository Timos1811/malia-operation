import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

async function sendPushover(token: string, user: string, message: string, title: string, priority = 0) {
  const res = await fetch(PUSHOVER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, user, message, title, priority }),
  });
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const pushoverToken = Deno.env.get('PUSHOVER_TOKEN');
    const pushoverUser = Deno.env.get('PUSHOVER_USER');

    if (!pushoverToken || !pushoverUser) {
      return Response.json({ error: 'Pushover credentials not configured' }, { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const { event, entity, data } = body;

    const messages: { title: string; message: string; priority: number }[] = [];

    // Watchdog mode — scan for unsent CasparFilling notifications
    if (!event) {
      const { data: unsent } = await supabase
        .from('caspar_fillings')
        .select('*')
        .eq('notification_sent', false);

      for (const record of unsent || []) {
        messages.push({
          title: 'כספר חדש 🏨',
          message: `${record.full_name} | ${record.phone_number}\nמלון: ${record.hotel}\nעזיבה: ${record.departure_date}\nאנשים: ${record.people_count}`,
          priority: 0,
        });
        await supabase
          .from('caspar_fillings')
          .update({ notification_sent: true })
          .eq('id', record.id);
      }
    }

    // Live event — CasparFilling created
    if (entity === 'CasparFilling' && event === 'create' && data) {
      messages.push({
        title: 'כספר חדש 🏨',
        message: `${data.full_name} | ${data.phone_number}\nמלון: ${data.hotel}\nעזיבה: ${data.departure_date}\nאנשים: ${data.people_count}`,
        priority: 0,
      });
    }

    // Live event — Task created (refund or supplier payment)
    if (entity === 'Task' && event === 'create' && data) {
      if (data.task_type === 'refund') {
        messages.push({
          title: '💸 החזר כספי',
          message: `${data.title}\nסכום: ${data.amount} ${data.currency}\nהזמנה: ${data.order_number || '-'}`,
          priority: 1,
        });
      } else if (data.task_type === 'supplier_payment') {
        messages.push({
          title: '🏪 תשלום לספק',
          message: `${data.title}\nסכום: ${data.amount} ${data.currency}`,
          priority: 0,
        });
      }
    }

    let sent = 0;
    for (const msg of messages) {
      await sendPushover(pushoverToken, pushoverUser, msg.message, msg.title, msg.priority);
      sent++;
    }

    return Response.json({ success: true, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
