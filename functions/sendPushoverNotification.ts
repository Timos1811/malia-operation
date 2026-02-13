import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const event = payload?.event;
        const data = payload?.data;

        // לוג לאבחון - יופיע בלשונית Logs ב-Base44
        console.log(`[LOG] Triggered by entity: ${event?.entity_name}, Event: ${event?.type}`);

        const userKey = Deno.env.get("PUSHOVER_USER_KEY");
        const token = Deno.env.get("PUSHOVER_API_TOKEN");

        if (!userKey || !token) {
            console.error("Missing Pushover secrets in Environment Variables");
            return Response.json({ error: "Missing secrets" }, { status: 500 });
        }

        const base44 = createClientFromRequest(req);
        let messagesToSend = [];

        // =========================================================
        // תרחיש 1: Watchdog (ריצה ידנית או מתוזמנת)
        // =========================================================
        if (!event) {
            console.log("Watchdog mode: Checking for unsent notifications...");
            
            // בדיקת כספרים שלא נשלחו
            const pendingCaspars = await base44.asServiceRole.entities.CasparFilling.filter({ notification_sent: false });
            for (const c of pendingCaspars) {
                messagesToSend.push({
                    title: "💰 כספר (גיבוי Watchdog)",
                    message: `שם: ${c.full_name}\nמלון: ${c.hotel}`,
                    priority: 0
                });
                await base44.asServiceRole.entities.CasparFilling.update(c.id, { notification_sent: true });
            }
        }

        // =========================================================
        // תרחיש 2: אירוע LIVE (יצירת משימה או כספר)
        // =========================================================
        else if (data && event.type === 'create') {
            
            // בדיקת כספר (תומך בשני שמות אופציונליים לישות)
            if (event.entity_name === 'CasparFilling' || event.entity_name === 'Caspar') {
                messagesToSend.push({
                    title: "💰 כספר חדש נקלט",
                    message: `שם: ${data.full_name || 'אורח'}\nמלון: ${data.hotel || 'לא צוין'}\nאנשים: ${data.people_count || 0}`,
                    priority: 0
                });
                // עדכון סטטוס שליחה בישות המתאימה
                const entityName = event.entity_name;
                await base44.asServiceRole.entities[entityName].update(event.entity_id, { notification_sent: true });
            }

            // בדיקת משימה (החזר או ספק)
            else if (event.entity_name === 'Task') {
                if (data.task_type === 'refund') {
                    const totalAmount = (data.amount || 0) * (data.people_count || 1);
                    messagesToSend.push({
                        title: "💸 בקשת החזר חדשה",
                        message: `סכום: ${totalAmount} ${data.currency}\nנציג: ${data.sales_rep}`,
                        priority: 1
                    });
                } else if (data.task_type === 'supplier_payment') {
                    messagesToSend.push({
                        title: "✅ דוח אירוע/ספק",
                        message: `אירוע: ${data.event_name}\nסכום: ${data.amount}`,
                        priority: 0
                    });
                }
                await base44.asServiceRole.entities.Task.update(event.entity_id, { notification_sent: true });
            }
        }

        // =========================================================
        // שליחה ל-Pushover
        // =========================================================
        const results = [];
        for (const msg of messagesToSend) {
            const pushRes = await fetch("https://api.pushover.net/1/messages.json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: token,
                    user: userKey,
                    title: msg.title,
                    message: msg.message,
                    priority: msg.priority || 0,
                    sound: "pushover"
                })
            });
            results.push(await pushRes.json());
        }

        console.log(`Sent ${results.length} notifications.`);
        return Response.json({ success: true, count: results.length });

    } catch (error) {
        console.error("Critical Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});