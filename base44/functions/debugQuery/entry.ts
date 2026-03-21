import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { orderNumber } = await req.json();

        // Test filtering
        const results = await base44.entities.TableData.filter({ order_number: orderNumber });
        
        // Test listing and finding
        const allList = await base44.entities.TableData.list('-created_date', 100);
        const foundInList = allList.find(i => i.order_number === orderNumber);

        return Response.json({ 
            filterCount: results.length,
            filterResult: results[0],
            foundInList: foundInList,
            orderNumberType: typeof orderNumber,
            orderNumber: orderNumber
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});