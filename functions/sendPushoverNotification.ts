import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        console.log("Pushover Function Triggered. Payload:", JSON.stringify(payload));
        
        const { event, data } = payload;
        
        const userKey = Deno.env.get("PUSHOVER_USER_KEY");
        const token = Deno.env.get("PUSHOVER_API_TOKEN");

        if (!userKey || !token) {
            console.error("Missing Pushover secrets");
            return Response.json({ error: "Missing Pushover secrets" }, { status: 500 });
        }

        const base44 = createClientFromRequest(req);
        
        let messagesToSend = [];

        // =========================================================
        // תרחיש 1: ריצה מתוזמנת (Watchdog + משימות קבועות)
        // =========================================================
        if (!event) {
            console.log("Running Scheduled Watchdog...");

            // --- 1.1: בדיקת כספרים שלא נשלחו עדיין (גיבוי) ---
            const pendingCaspars = await base44.asServiceRole.entities.CasparFilling.filter({ notification_sent: false });
            if (pendingCaspars.length > 0) console.log(`Found ${pendingCaspars.length} pending caspars`);
            
            for (const caspar of pendingCaspars) {
                messagesToSend.push({
                    title: "💰 כספר חדש נקלט (גיבוי)",
                    message: `שם: ${caspar.full_name}\nמלון: ${caspar.hotel}\nעזיבה: ${caspar.departure_date}\nאנשים: ${caspar.people_count}`,
                    priority: 0
                });
                // סימון שנשלח
                await base44.asServiceRole.entities.CasparFilling.update(caspar.id, { notification_sent: true });
            }

            // --- 1.2: בדיקת משימות (החזר/ספק) שלא נשלחו עדיין (גיבוי) ---
            // מסננים רק משימות רלוונטיות שעדיין לא נשלחו
            // נשלוף את כל המשימות שלא נשלחו ואז נסנן לפי סוג (כי אולי אין אפשרות ל-filter מורכב מדי)
            // או שפשוט נשלוף הכל ונבדוק ב-JS
            const pendingTasks = await base44.asServiceRole.entities.Task.filter({ notification_sent: false });
            
            for (const task of pendingTasks) {
                let msg = null;

                if (task.task_type === 'refund') {
                    const typeText = task.refund_type === 'full' ? 'מלא' : 'חלקי';
                    const totalAmount = (task.amount || 0) * (task.people_count || 1);
                    msg = {
                        title: "💸 בקשת החזר חדשה (גיבוי)",
                        message: `סוג: ${typeText}\nסכום: ${totalAmount} ${task.currency || 'EUR'}\nעבור: ${task.people_count} אנשים\nנציג: ${task.sales_rep || 'לא צוין'}`,
                        priority: 1
                    };
                } else if (task.task_type === 'supplier_payment') {
                    msg = {
                        title: "✅ דוח אירוע נשלח (גיבוי)",
                        message: `אירוע: ${task.event_name || task.title}\nסכום לתשלום: ${task.amount} ${task.currency}\nנכחו: ${task.scanned_count} נסרקים`,
                        priority: 0
                    };
                }

                if (msg) {
                    messagesToSend.push(msg);
                    await base44.asServiceRole.entities.Task.update(task.id, { notification_sent: true });
                }
            }


            // --- 1.3: משימות קבועות (רק בשעה 12:00 UTC) ---
            const now = new Date();
            const currentHour = now.getUTCHours(); 
            // בודקים דקות כדי שלא ירוץ פעמיים בטווח של השעה 12
            if (currentHour === 12 && now.getUTCMinutes() < 10) { 
                const dayOfWeek = now.getDay();
                const tasks = await base44.asServiceRole.entities.Task.filter({ is_recurring: true });
                
                const todaysTasks = tasks.filter(t => {
                    if (!t.recurring_days || t.recurring_days.length === 0) return true;
                    return t.recurring_days.includes(dayOfWeek);
                });

                if (todaysTasks.length > 0) {
                    const taskList = todaysTasks.map(t => `• ${t.title}`).join('\n');
                    messagesToSend.push({
                        title: "📋 משימות קבועות להיום",
                        message: `סה"כ ${todaysTasks.length} משימות לביצוע:\n\n${taskList}`,
                        priority: 0
                    });
                }
            }
        }

        // =========================================================
        // תרחיש 2: אירוע חדש בטבלת משימות (החזר או ספק)
        // =========================================================
        else if (event.entity_name === 'Task' && event.type === 'create' && data) {
            
            // התראה על החזר חדש
            if (data.task_type === 'refund') {
                const typeText = data.refund_type === 'full' ? 'מלא' : 'חלקי';
                const totalAmount = (data.amount || 0) * (data.people_count || 1);
                
                messagesToSend.push({
                    title: "💸 בקשת החזר חדשה",
                    message: `סוג: ${typeText}\nסכום: ${totalAmount} ${data.currency || 'EUR'}\nעבור: ${data.people_count} אנשים\nנציג: ${data.sales_rep || 'לא צוין'}`,
                    priority: 1 // High priority
                });
            }
            
            // התראה על תשלום לספק / דוח אירוע
            else if (data.task_type === 'supplier_payment') {
                messagesToSend.push({
                    title: "✅ דוח אירוע נשלח (תשלום ספק)",
                    message: `אירוע: ${data.event_name || data.title}\nסכום לתשלום: ${data.amount} ${data.currency}\nנכחו: ${data.scanned_count} נסרקים`,
                    priority: 0
                });
            }

            // עדכון שההתראה נשלחה (כדי שה-watchdog לא ישלח שוב)
            if (messagesToSend.length > 0) {
                await base44.asServiceRole.entities.Task.update(event.entity_id, { notification_sent: true });
            }
        }

        // =========================================================
        // תרחיש 3: כספר חדש
        // =========================================================
        else if ((event.entity_name === 'CasparFilling' || event.entity_name === 'Caspar') && event.type === 'create' && data) {
             console.log("Processing CasparFilling create event");
            messagesToSend.push({
                title: "💰 כספר חדש נקלט",
                message: `שם: ${data.full_name}\nמלון: ${data.hotel}\nעזיבה: ${data.departure_date}\nאנשים: ${data.people_count}`,
                priority: 0
            });

            // עדכון שההתראה נשלחה
            await base44.asServiceRole.entities.CasparFilling.update(event.entity_id, { notification_sent: true });
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
                    priority: msg.priority || 0
                })
            });
            results.push(await pushRes.json());
        }

        return Response.json({ success: true, sent_count: results.length, results });

    } catch (error) {
        console.error("Error sending Pushover notification:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});