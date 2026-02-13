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
        // תרחיש 1: ריצה מתוזמנת (משימות קבועות + כספרים ממתינים)
        // ---------------------------------------------------------
        if (!event) {
            // --- בדיקת כספרים שלא נשלחו עדיין ---
            const pendingCaspars = await base44.asServiceRole.entities.CasparFilling.filter({ notification_sent: false });
            
            for (const caspar of pendingCaspars) {
                messagesToSend.push({
                    title: "💰 כספר חדש נקלט",
                    message: `שם: ${caspar.full_name}\nמלון: ${caspar.hotel}\nעזיבה: ${caspar.departure_date}\nאנשים: ${caspar.people_count}`,
                    priority: 0
                });
                // סימון שנשלח
                await base44.asServiceRole.entities.CasparFilling.update(caspar.id, { notification_sent: true });
            }


            // --- בדיקת משימות קבועות (רק אם זה "משימת בוקר") ---
            // מכיוון שהפונקציה רצה כל 5 דקות עכשיו, עלינו לוודא שאנחנו לא שולחים את המשימות הקבועות 200 פעמים ביום.
            // נשתמש בפרמטר שישלח מהאוטומציה או נבדוק שעה.
            // אבל האוטומציה הקיימת של המשימות היא נפרדת! אז הקוד הזה (בלוק המשימות) ירוץ רק באוטומציה היומית.
            
            // נבדוק האם הריצה הנוכחית היא חלק מאוטומציה יומית (נניח לפי שעה ספציפית או פרמטר)
            // מכיוון שאין לנו דרך קלה להבחין כרגע, נניח שהאוטומציה היומית מוגדרת לשעה ספציפית.
            // אבל אם ניצור אוטומציה של 5 דקות, היא תריץ את הבלוק הזה כל 5 דקות...
            // פתרון: בדיקת כספרים תהיה תמיד. בדיקת משימות תהיה רק אם השעה היא 14:00 (או השעה שנקבעה).
            
            const now = new Date();
            // התאמה לזמן ישראל בערך (UTC+2/3). נניח UTC.
            const currentHour = now.getUTCHours(); 
            // 12:00 UTC is 14:00 Israel (winter) or 15:00 (summer). 
            // האוטומציה היומית מוגדרת ל-12:00.
            
            // נבצע את בדיקת המשימות רק אם זו האוטומציה היומית.
            // הדרך הכי טובה: לפצל לפונקציות נפרדות או לבדוק ארגומנטים.
            // נשתמש בארגומנטים! אבל אי אפשר להוסיף ארגומנטים לאוטומציה קיימת בקלות.
            
            // פתרון פשוט: אם יש pendingCaspars, זה אומר שזה ה-catch-up.
            // אבל מה אם אין?
            
            // בוא נבדוק אם השעה היא בין 11:55 ל-12:05 UTC (זמן הריצה של המשימות הקבועות)
            // ורק אז נשלח את המשימות הקבועות.
            // זה קצת "מלוכלך" אבל יעבוד.
            
            // או יותר טוב: ניצור פונקציה נפרדת לבדיקת כספרים וזהו.
            // אבל אני רוצה לחסוך ביצירת קבצים.
            
            // בוא נניח שהקוד הזה רץ. 
            // אם אוסיף את בדיקת הכספרים כאן, היא תרוץ גם ב-12:00 יחד עם המשימות. זה בסדר.
            // אבל אם אצור אוטומציה שרצה כל 5 דקות, היא תריץ את בדיקת המשימות כל 5 דקות. זה רע.
            
            // לכן אני חייב להגן על בדיקת המשימות.
            // אבדוק אם השעה היא 12 (UTC).
            
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
        else if ((event.entity_name === 'CasparFilling' || event.entity_name === 'Caspar') && event.type === 'create' && data) {
             console.log("Processing CasparFilling create event");
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