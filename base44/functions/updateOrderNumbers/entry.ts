import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const updateEntities = async (entityName) => {
            const records = await base44.asServiceRole.entities[entityName].list('', 1000);
            let count = 0;
            for (const record of records) {
                let firstDigit = '9';
                if (record.company === 'קשרי תעופה') firstDigit = '5';
                else if (record.company === 'נטו פאן') firstDigit = '1';
                else if (record.company === 'כספרים') firstDigit = '0';
                
                const random4Digits = Math.floor(1000 + Math.random() * 9000).toString();
                const newOrderNumber = firstDigit + random4Digits;
                
                await base44.asServiceRole.entities[entityName].update(record.id, { order_number: newOrderNumber });
                await new Promise(resolve => setTimeout(resolve, 250));
                count++;
            }
            return count;
        };

        const pendingCount = await updateEntities('PendingSale');
        const tableCount = await updateEntities('TableData');

        return Response.json({ success: true, pendingCount, tableCount });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});