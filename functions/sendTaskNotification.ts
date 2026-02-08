import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { event, data } = payload;

        // Only process create events
        if (event.type !== 'create') {
            return Response.json({ message: 'Ignored' });
        }

        const task = data;
        const targetEmail = 'kishreytim@gmail.com';
        const appHost = req.headers.get("host");

        await base44.asServiceRole.integrations.Core.SendEmail({
            to: targetEmail,
            subject: `משימה חדשה: ${task.title}`,
            body: `
                <div dir="rtl" style="font-family: Arial, sans-serif;">
                    <h2>נוצרה משימה חדשה במערכת</h2>
                    <p><strong>כותרת:</strong> ${task.title}</p>
                    <p><strong>תיאור:</strong> ${task.description || 'ללא תיאור'}</p>
                    <p><strong>סטטוס:</strong> ${task.status === 'todo' ? 'לביצוע' : 'בוצע'}</p>
                    <p><strong>תאריך יעד:</strong> ${task.due_date || 'לא הוגדר'}</p>
                    <p><strong>נוצר על ידי:</strong> ${task.created_by}</p>
                    <br/>
                    <a href="https://${appHost}/Tasks" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        מעבר למשימות
                    </a>
                </div>
            `
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});