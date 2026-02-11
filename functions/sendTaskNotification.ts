import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Secrets
        const idInstance = Deno.env.get("GREEN_API_ID_INSTANCE");
        const apiTokenInstance = Deno.env.get("GREEN_API_API_TOKEN_INSTANCE");
        const targetPhone = Deno.env.get("GREEN_API_PHONE_NUMBER");

        if (!idInstance || !apiTokenInstance || !targetPhone) {
            console.error("Missing Green API secrets");
            return Response.json({ error: "Missing secrets" }, { status: 500 });
        }

        // Parse payload
        const payload = await req.json();
        const { event, data } = payload;
        
        console.log("Received payload:", JSON.stringify(payload, null, 2));

        if (event?.type !== 'create' && event?.type !== 'update') {
            console.log("Ignored event type:", event?.type);
            return Response.json({ message: "Event type not handled" });
        }
        
        if (event?.type === 'create') {
             const task = data;
             
             if (!task) {
                 console.error("Task data is null/undefined");
                 return Response.json({ error: "No task data provided" });
             }

             // Determine Task Type Display
             let typeDisplay = 'כללי';
             if (task.is_recurring) {
                 typeDisplay = 'משימה קבועה';
             } else if (task.task_type === 'refund') {
                 typeDisplay = task.refund_type === 'full' ? 'החזר מלא' : 'החזר חלקי';
             } else if (task.task_type === 'supplier_payment') {
                 typeDisplay = 'תשלום לספק (סיום אירוע)';
             } else if (task.task_type === 'add_event') {
                 typeDisplay = 'הוספת אירוע';
             }

             let message = '';

             // Special formatting for Supplier Payment / Event Finished
             if (task.task_type === 'supplier_payment') {
                 message = `*סיום אירוע - דרישת תשלום*\n\n` +
                           `*אירוע:* ${task.event_name || 'לא צוין'}\n` +
                           `*לתשלום:* ${task.amount} ${task.currency || 'EUR'}\n` +
                           `*נסרקו:* ${task.scanned_count || 0}\n` +
                           `*כמות כרטיסים/חתימות:* ${task.people_count || 0}\n` +
                           `*נוצרה על ידי:* ${task.created_by || 'מערכת'}\n` +
                           (task.description ? `*הערות:* ${task.description}` : '');
             } else {
                 // Standard formatting
                 message = `*נוספה לך משימה חדשה*\n\n` +
                           `*כותרת:* ${task.title}\n` +
                           `*סוג:* ${typeDisplay}\n` +
                           `*נוצרה על ידי:* ${task.created_by || 'מערכת'}\n` +
                           `*תאריך יעד:* ${task.due_date || 'לא הוגדר'}\n` +
                           `*סטטוס:* ${task.status}\n` +
                           (task.amount ? `*סכום:* ${task.amount} ${task.currency || 'EUR'}\n` : '') +
                           (task.description ? `*תיאור:* ${task.description}` : '');
             }

             // Send to Green API
             const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
             
             console.log("Sending message to:", targetPhone);
             
             const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: `${targetPhone}@c.us`,
                    message: message
                })
             });
             
             const result = await response.json();
             console.log("Green API Response:", result);
             
             return Response.json(result);
        }

        return Response.json({ message: "No action taken" });

    } catch (error) {
        console.error("Error sending notification:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});