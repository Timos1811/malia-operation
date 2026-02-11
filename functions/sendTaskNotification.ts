import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Check if secrets are set
        const idInstance = Deno.env.get("GREEN_API_ID_INSTANCE");
        const apiTokenInstance = Deno.env.get("GREEN_API_API_TOKEN_INSTANCE");
        const targetPhone = Deno.env.get("GREEN_API_PHONE_NUMBER");

        if (!idInstance || !apiTokenInstance || !targetPhone) {
            console.error("Missing Green API secrets");
            return Response.json({ error: "Missing secrets" }, { status: 500 });
        }

        // Parse payload (Entity Automation payload)
        const payload = await req.json();
        const { event, data } = payload;

        // Verify it's the correct event type (just in case)
        if (event?.type !== 'create' && event?.type !== 'update') {
            return Response.json({ message: "Event type not handled" });
        }
        
        // For updates, we might want to be more selective, but for now let's focus on creation or status changes
        // The user specifically asked for "new task creation"
        if (event?.type === 'create') {
             const task = data;
             
             const message = `*משימה חדשה נוצרה*\n\n` +
                             `*כותרת:* ${task.title}\n` +
                             `*סוג:* ${task.task_type || 'כללי'}\n` +
                             `*תאריך יעד:* ${task.due_date || 'לא הוגדר'}\n` +
                             `*סטטוס:* ${task.status}\n` +
                             `*נוצר ע"י:* ${task.created_by}\n` +
                             (task.description ? `*תיאור:* ${task.description}` : '');

             // Send to Green API
             const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
             
             const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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