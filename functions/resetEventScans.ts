import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { event_name } = await req.json();

        if (!event_name) {
            return Response.json({ error: 'Event name is required' }, { status: 400 });
        }

        // Fetch all success logs for the event
        // Using a limit of 2000 to be safe, assuming usually less than that per batch
        const logs = await base44.entities.WristbandScanLog.filter({
            event_name: event_name,
            status: 'success'
        }, '-scan_time', 2000);

        if (logs.length === 0) {
            return Response.json({ message: 'No logs to reset', count: 0 });
        }

        // Update all logs to 'processed'
        // Using Promise.all for parallel execution
        // Batching in chunks of 50 to avoid overwhelming the database
        const batchSize = 50;
        let updatedCount = 0;

        for (let i = 0; i < logs.length; i += batchSize) {
            const batch = logs.slice(i, i + batchSize);
            await Promise.all(batch.map(log => 
                base44.entities.WristbandScanLog.update(log.id, { status: 'processed' })
            ));
            updatedCount += batch.length;
        }

        return Response.json({ 
            success: true, 
            message: `Reset ${updatedCount} logs for event ${event_name}`,
            count: updatedCount
        });

    } catch (error) {
        console.error('Error resetting event scans:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});