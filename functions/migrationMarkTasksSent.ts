import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all tasks that are relevant for notifications (refund or supplier_payment)
        // We want to mark them as 'sent' so the watchdog doesn't spam about old tasks.
        
        // Since we just added the field, they don't have it, or it's null/undefined.
        // We'll update all existing ones to true.
        
        const tasks = await base44.asServiceRole.entities.Task.filter({});
        let count = 0;
        
        for (const task of tasks) {
            // Only update if it's a refund or supplier payment, otherwise it doesn't matter much, 
            // but for safety let's mark all existing tasks as sent.
            if (!task.notification_sent) {
                 await base44.asServiceRole.entities.Task.update(task.id, { notification_sent: true });
                 count++;
            }
        }

        return Response.json({ success: true, updated: count });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});