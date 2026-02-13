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
        // payload already read above
        
        let messagesToSend = [];

        // ---------------------------------------------------------
        // תרחיש 1: ריצה מתוזמנת (משימות קבועות)
        // ---------------------------------------------------------
        if (!event) {
            // זיהוי היום בשבוע (0=ראשון, 6=שבת) לפי שעון ישראל
            // מכיוון שהשרתים ב-UTC, נוסיף 2/3 שעות או נשתמש ב-Locale
            const today = new Date();
            const dayOfWeek = today.getDay(); // תלוי בשרת, לרוב UTC. 
            // אם האוטומציה רצה בבוקר, ה-UTC דיי קרוב.
            
            // שליפת כל המשימות
            const tasks = await base44.asServiceRole.entities.Task.filter({ is_recurring: true });
            
            const todaysTasks = tasks.filter(t => {
                // אם אין מערך ימים או שהוא ריק, מניחים שזה כל יום
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

        // ---------------------------------------------------------
        // תרחיש 2: אירוע חדש בטבלת משימות (החזר או ספק)
        // ---------------------------------------------------------
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
            // זה נוצר כאשר שולחים דוח מהסורק
            else if (data.task_type === 'supplier_payment') {
                messagesToSend.push({
                    title: "✅ דוח אירוע נשלח (תשלום ספק)",
                    message: `אירוע: ${data.event_name || data.title}\nסכום לתשלום: ${data.amount} ${data.currency}\nנכחו: ${data.scanned_count} נסרקים`,
                    priority: 0
                });
            }
        }

        // ---------------------------------------------------------
        // תרחיש 3: כספר חדש
        // ---------------------------------------------------------
        else if (event.entity_name === 'CasparFilling' && event.type === 'create' && data) {
            messagesToSend.push({
                title: "💰 כספר חדש נקלט",
                message: `שם: ${data.full_name}\nמלון: ${data.hotel}\nעזיבה: ${data.departure_date}\nאנשים: ${data.people_count}`,
                priority: 0
            });
        }


        // ---------------------------------------------------------
        // שליחה ל-Pushover
        // ---------------------------------------------------------
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