import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function randomString(length) {
    let result = '';
    const characters = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch data
        const attractions = await base44.asServiceRole.entities.Attraction.list('', 100);
        if (!attractions.length) return Response.json({ error: "No attractions" });

        const pendingSales = await base44.asServiceRole.entities.PendingSale.list('', 1000);
        const tableData = await base44.asServiceRole.entities.TableData.list('', 1000);

        let wristbandsToCreate = [];
        let updates = [];

        const processOrders = (orders, entityName) => {
            for (const order of orders) {
                // customer field contains number of people (e.g. "2", "3", "4", "5")
                const numPeople = parseInt(order.customer) || 2;
                let orderTotalExtras = 0;

                for (let i = 0; i < numPeople; i++) {
                    const numAttractions = Math.floor(Math.random() * 3) + 1; // 1 to 3
                    const shuffled = [...attractions].sort(() => 0.5 - Math.random());
                    const selectedAttractions = shuffled.slice(0, numAttractions);
                    
                    const events = selectedAttractions.map(a => a.name);
                    const cost = selectedAttractions.reduce((sum, a) => sum + (parseFloat(a.price_eur) || 0), 0);
                    orderTotalExtras += cost;

                    wristbandsToCreate.push({
                        nfc_id: `${randomString(2)}:${randomString(2)}:${randomString(2)}:${randomString(2)}:${randomString(2)}:${randomString(2)}:${randomString(2)}`,
                        order_number: order.order_number,
                        customer_name: `אורח ${i + 1}`,
                        allowed_events: events,
                        status: 'active',
                        valid_until: order.departure_date
                    });
                }

                // Update order amounts
                const oldReqAmount = parseFloat(order.requested_amount) || 0;
                const oldEurAmount = parseFloat(order.eur_amount) || 0;
                const oldEurStatus = parseFloat(order.eur_status) || 0;
                
                if (entityName === 'TableData') {
                    updates.push({
                        entityName,
                        id: order.id,
                        data: {
                            requested_amount: (oldReqAmount + orderTotalExtras).toString(),
                            eur_amount: (oldEurAmount + orderTotalExtras).toString()
                        }
                    });
                } else {
                    updates.push({
                        entityName,
                        id: order.id,
                        data: {
                            requested_amount: (oldReqAmount + orderTotalExtras).toString(),
                            eur_status: (oldEurStatus - orderTotalExtras).toString()
                        }
                    });
                }
            }
        };

        processOrders(pendingSales, 'PendingSale');
        processOrders(tableData, 'TableData');

        // Create wristbands
        const BATCH_SIZE = 50;
        for (let i = 0; i < wristbandsToCreate.length; i += BATCH_SIZE) {
            const batch = wristbandsToCreate.slice(i, i + BATCH_SIZE);
            await base44.asServiceRole.entities.Wristband.bulkCreate(batch);
        }

        // Update orders sequentially to avoid rate limits
        for (const update of updates) {
            await base44.asServiceRole.entities[update.entityName].update(update.id, update.data);
            await new Promise(r => setTimeout(r, 100)); // 100ms between updates
        }

        return Response.json({ success: true, wristbandsCount: wristbandsToCreate.length, updatesCount: updates.length });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});