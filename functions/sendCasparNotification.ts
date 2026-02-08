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

        const caspar = data;
        const targetEmail = 'kishreytim@gmail.com';
        const appHost = req.headers.get("host");

        await base44.asServiceRole.integrations.Core.SendEmail({
            to: targetEmail,
            subject: `דיווח כספר חדש: ${caspar.full_name}`,
            body: `
                <div dir="rtl" style="font-family: Arial, sans-serif;">
                    <h2>התקבל דיווח כספר חדש</h2>
                    <p><strong>שם מלא:</strong> ${caspar.full_name}</p>
                    <p><strong>טלפון:</strong> ${caspar.phone_number}</p>
                    <p><strong>מלון:</strong> ${caspar.hotel}</p>
                    <p><strong>תאריך עזיבה:</strong> ${caspar.departure_date}</p>
                    <p><strong>כמות אנשים:</strong> ${caspar.people_count}</p>
                    <br/>
                    <a href="https://${appHost}/Caspars" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        צפייה בטבלה
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