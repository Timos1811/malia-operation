import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const idInstance = Deno.env.get("GREEN_API_ID_INSTANCE");
        const apiTokenInstance = Deno.env.get("GREEN_API_API_TOKEN_INSTANCE");
        const rawPhone = Deno.env.get("GREEN_API_PHONE_NUMBER");

        // לוג לבדיקת ה-Secrets
        console.log("Secrets check:", { 
            hasId: !!idInstance, 
            hasToken: !!apiTokenInstance, 
            phone: rawPhone 
        });

        if (!idInstance || !apiTokenInstance || !rawPhone) {
            return Response.json({ error: "Missing Green API secrets" }, { status: 500 });
        }

        // ניקוי המספר מכל תו שאינו ספרה
        const cleanPhone = rawPhone.replace(/\D/g, '');
        
        const payload = await req.json();
        const { event, data: task } = payload;

        if (event?.type !== 'create' || !task) {
            return Response.json({ message: "Not a create event or no data" });
        }

        // בניית ההודעה
        const typeDisplay = task.task_type === 'supplier_payment' ? 'תשלום לספק' : 'משימה חדשה';
        const message = `*${typeDisplay}*\n\n` +
                        `*כותרת:* ${task.title || task.event_name || 'ללא כותרת'}\n` +
                        `*יוצר:* ${task.created_by || 'מערכת'}\n` +
                        `*סכום:* ${task.amount || 0} ${task.currency || 'EUR'}`;

        const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
        
        console.log(`Sending to: ${cleanPhone}@c.us`);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: `${cleanPhone}@c.us`,
                message: message
            })
        });
        
        const result = await response.json();
        console.log("Green API response:", result);
        
        return Response.json(result);

    } catch (error) {
        console.error("Critical Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});