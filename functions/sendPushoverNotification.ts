import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        // לוג קריטי לדיבאג בלייב
        console.log("Pushover Triggered. Entity:", payload?.event?.entity_name, "Type:", payload?.event?.type);
        
        const event = payload?.event;
        const data = payload?.data;
        
        const userKey = Deno.env.get("PUSHOVER_USER_KEY");
        const token = Deno.env.get("PUSHOVER_API_TOKEN");

        if (!userKey || !token) {
            console.error("Missing Pushover secrets");
            return Response.json({ error: "Missing secrets" }, { status: 500 });
        }

        const base44 = createClientFromRequest(req);
        let messagesToSend = [];

        // --- תרחיש 1: Watchdog (ריצה ללא אירוע ספציפי) ---
        if (!event) {
            console.log("Running Watchdog Mode...");
            
            // בדיקת כספרים (CasparFilling)
            const pendingCaspars = await base44.asServiceRole.entities.CasparFilling.filter({ notification_sent: false });
            for (const caspar of pendingCaspars) {
                messagesToSend.push({
                    title: "💰 כספר חדש (גיבוי)",
                    message: `שם: ${caspar.full_name}\nמלון: ${caspar.hotel}\nעזיבה: ${caspar.departure_date}`,
                    priority: 0
                });
                await base44.asServiceRole.entities.CasparFilling.update(caspar.id, { notification_sent: true });
            }

            // בדיקת משימות (Tasks)
            const pendingTasks = await base44.asServiceRole.entities.Task.filter({ notification_sent: false });
            for (const task of pendingTasks) {
                if (task.task_type === 'refund' || task.task_type === 'supplier_payment') {
                    messagesToSend.push({
                        title: `💸 ${task.task_type === 'refund' ? 'החזר' : 'תשלום'} (גיבוי)`,
                        message: `כותרת: ${task.title}\nסכום: ${task.amount} ${task.currency}`,
                        priority: task.task_type === 'refund' ? 1 : 0
                    });
                    await base44.asServiceRole.entities.Task.update(task.id, { notification_sent: true });
                }
            }
        }

        // --- תרחיש 2: אירוע LIVE מ-Automation ---
        else if (data) {
            if (event.entity_name === 'Task' && event.type === 'create') {
                const totalAmount = (data.amount || 0) * (data.people_count || 1);
                
                if (data.task_type === 'refund') {
                    messagesToSend.push({
                        title: "💸 בקשת החזר חדשה",
                        message: `סוג: ${data.refund_type === 'full' ? 'מלא' : 'חלקי'}\nסכום כולל: ${totalAmount} ${data.currency}\nנציג: ${data.sales_rep}`,
                        priority: 1
                    });
                } else if (data.task_type === 'supplier_payment') {
                    messagesToSend.push({
                        title: "✅ דוח אירוע נשלח",
                        message: `אירוע: ${data.event_name || data.title}\nסכום: ${data.amount} ${data.currency}`,
                        priority: 0
                    });
                }
                // עדכון מיידי כדי למנוע מה-Watchdog לשלוח שוב
                await base44.asServiceRole.entities.Task.update(event.entity_id, { notification_sent: true });
            }

            else if ((event.entity_name === 'CasparFilling' || event.entity_name === 'Caspar') && event.type === 'create') {
                messagesToSend.push({
                    title: "💰 כספר חדש נקלט",
                    message: `שם: ${data.full_name}\nמלון: ${data.hotel}\nאנשים: ${data.people_count}`,
                    priority: 0
                });
                await base44.asServiceRole.entities.CasparFilling.update(event.entity_id, { notification_sent: true });
            }
        }

        // --- שליחה סופית ---
        const results = [];
        for (const msg of messagesToSend) {
            const res = await fetch("https://api.pushover.net/1/messages.json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: token,
                    user: userKey,
                    title: msg.title,
                    message: msg.message,
                    priority: msg.priority
                })
            });
            results.push(await res.json());
        }

        return Response.json({ success: true, sent: results.length });

    } catch (error) {
        console.error("Critical Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});