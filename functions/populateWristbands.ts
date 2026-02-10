import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Fetch all orders (TableData)
        const orders = await base44.asServiceRole.entities.TableData.list('-created_date', 100);
        
        // 2. Fetch all attractions to assign randomly
        const attractions = await base44.asServiceRole.entities.Attraction.list();
        const attractionNames = attractions.map(a => a.name);

        const wristbandsToCreate = [];
        let totalWristbands = 0;

        // Helper to get random subset of events
        const getRandomEvents = () => {
            const shuffled = [...attractionNames].sort(() => 0.5 - Math.random());
            const count = Math.floor(Math.random() * 4) + 1; // 1 to 4 events
            return shuffled.slice(0, count);
        };

        // Helper to extract number of people from customer string
        const getPeopleCount = (str) => {
            const match = str && str.match(/\d+/);
            return match ? parseInt(match[0]) : 2; // Default to 2 if no number found
        };

        // Helper to generate random HEX ID
        const generateNFC = () => Math.random().toString(16).slice(2, 10).toUpperCase();

        for (const order of orders) {
            const count = getPeopleCount(order.customer);
            
            for (let i = 0; i < count; i++) {
                wristbandsToCreate.push({
                    nfc_id: generateNFC(),
                    order_number: order.order_number,
                    customer_name: `אורח ${i + 1} - הזמנה ${order.order_number}`,
                    allowed_events: getRandomEvents(),
                    status: 'active',
                    valid_until: order.departure_date || '2026-12-31'
                });
            }
        }

        totalWristbands = wristbandsToCreate.length;

        // Bulk create in chunks to avoid payload limits if any (though 200-300 is usually fine)
        // SDK bulkCreate usually handles array.
        // Assuming base44.entities.Wristband.bulkCreate exists or using loop
        // We'll use a loop of bulk creates of 50 just to be safe and responsive
        
        const chunkSize = 50;
        for (let i = 0; i < wristbandsToCreate.length; i += chunkSize) {
            const chunk = wristbandsToCreate.slice(i, i + chunkSize);
            await base44.asServiceRole.entities.Wristband.bulkCreate(chunk);
        }

        return Response.json({ 
            success: true, 
            message: `Created ${totalWristbands} wristbands for ${orders.length} orders.` 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});