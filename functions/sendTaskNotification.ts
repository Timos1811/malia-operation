import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const idInstance = Deno.env.get("GREEN_API_ID_INSTANCE");
        const apiTokenInstance = Deno.env.get("GREEN_API_API_TOKEN_INSTANCE");
        const targetPhone = Deno.env.get("GREEN_API_PHONE_NUMBER");

        if (!idInstance || !apiTokenInstance || !targetPhone) {
            console.error("Missing Green API secrets");
            return Response.json({ error: "Missing secrets" }, { status: 500 });
        }

        const payload = await req.json();
        const { event, data } = payload;
        
        if (event?.type !== 'create') {
            return Response.json({ message: "Event type not handled" });
        }
        
        const task = data;
        if (!task) {
            return Response.json({ error: "No task data" });
        }

        // Logic to construct message...
        let typeDisplay = 'כללי';
        if (task.is_recurring) typeDisplay = 'משימה קבועה';
        else if (task.task_type === 'refund') typeDisplay = task.refund_type === 'full' ? 'החזר מלא' : 'החזר חלקי';
        else if (task.task_type === 'supplier_payment') typeDisplay = 'תשלום לספק (סיום אירוע)';
        else if (task.task_type === 'add_event') typeDisplay = 'הוספת אירוע';

        let message = '';
        if (task.task_type === 'supplier_payment') {
             message = `*סיום אירוע - דרישת תשלום*\n\n` +
                       `*אירוע:* ${task.event_name || 'לא צוין'}\n` +
                       `*לתשלום:* ${task.amount} ${task.currency || 'EUR'}\n` +
                       `*נסרקו:* ${task.scanned_count || 0}\n` +
                       `*כמות כרטיסים/חתימות:* ${task.people_count || 0}\n` +
                       `*נוצרה על ידי:* ${task.created_by || 'מערכת'}\n` +
                       (task.description ? `*הערות:* ${task.description}` : '');
        } else {
             message = `*נוספה לך משימה חדשה*\n\n` +
                       `*כותרת:* ${task.title}\n` +
                       `*סוג:* ${typeDisplay}\n` +
                       `*נוצרה על ידי:* ${task.created_by || 'מערכת'}\n` +
                       `*תאריך יעד:* ${task.due_date || 'לא הוגדר'}\n` +
                       `*סטטוס:* ${task.status}\n` +
                       (task.amount ? `*סכום:* ${task.amount} ${task.currency || 'EUR'}\n` : '') +
                       (task.description ? `*תיאור:* ${task.description}` : '');
        }

        const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); 

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: `${targetPhone}@c.us`,
                message: message
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const result = await response.json();
        console.log("Green API result:", result);
        
        return Response.json(result);

    } catch (error) {
        console.error("Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
