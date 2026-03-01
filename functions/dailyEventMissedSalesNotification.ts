import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const userKey = Deno.env.get("PUSHOVER_USER_KEY");
        const token = Deno.env.get("PUSHOVER_API_TOKEN");

        if (!userKey || !token) {
            console.error("Missing Pushover secrets");
            return Response.json({ error: "Missing secrets" }, { status: 500 });
        }

        // 1. Determine today's day and date
        const now = new Date();
        // Adjust for Jerusalem time (UTC+2/3). 
        // Simple way: Add 3 hours (cover Summer time mostly) or use proper timezone if possible.
        // Deno Deploy is UTC.
        // Jerusalem is UTC+2 (Winter) or UTC+3 (Summer).
        // Let's assume UTC+3 for safety or use formatting.
        const jerusalemDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
        const todayDay = jerusalemDate.getDay(); // 0=Sunday
        const todayStr = jerusalemDate.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`Checking events for day: ${todayDay} (Date: ${todayStr})`);

        // 2. Get events for today
        const allAttractions = await base44.asServiceRole.entities.Attraction.list();
        const eventsToday = allAttractions.filter(attr => 
            attr.event_days && Array.isArray(attr.event_days) && attr.event_days.includes(todayDay)
        );

        if (eventsToday.length === 0) {
            console.log("No events scheduled for today.");
            return Response.json({ message: "No events today" });
        }

        console.log(`Found ${eventsToday.length} events today: ${eventsToday.map(e => e.name).join(', ')}`);

        // 3. Get active orders (departure_date >= today)
        // Since we can't easily filter by range in basic filter, we fetch recent/all and filter in JS.
        // Assuming TableData isn't huge. If it is, we might need a better strategy.
        // We'll fetch last 1000 records.
        const allOrders = await base44.asServiceRole.entities.TableData.list('-created_date', 1000);
        
        const activeOrders = allOrders.filter(order => {
            if (!order.departure_date) return false;
            // Compare string dates YYYY-MM-DD
            return order.departure_date >= todayStr;
        });

        console.log(`Found ${activeOrders.length} active orders.`);

        if (activeOrders.length === 0) {
            return Response.json({ message: "No active orders" });
        }

        // 4. Get all wristbands for these orders
        // Optimization: Fetch all wristbands for active orders.
        // We can't filter wristbands by order_number easily if there are many orders.
        // We'll fetch all wristbands (limit 2000?) or fetch per order (too slow).
        // Let's fetch all active wristbands (valid_until >= today)?
        // Entity Wristband has `valid_until`.
        const allWristbands = await base44.asServiceRole.entities.Wristband.list('-valid_until', 2000);
        
        // Map order_number -> list of wristbands
        const wristbandsByOrder = {};
        allWristbands.forEach(wb => {
            if (!wristbandsByOrder[wb.order_number]) {
                wristbandsByOrder[wb.order_number] = [];
            }
            wristbandsByOrder[wb.order_number].push(wb);
        });

        const messagesSent = [];

        // 5. Check for each event
        for (const event of eventsToday) {
            const missedOrders = [];

            for (const order of activeOrders) {
                const orderWristbands = wristbandsByOrder[order.order_number] || [];
                const hasTicket = orderWristbands.some(wb => 
                    wb.allowed_events && 
                    Array.isArray(wb.allowed_events) && 
                    wb.allowed_events.includes(event.name)
                );

                if (!hasTicket) {
                    missedOrders.push(order);
                }
            }

            if (missedOrders.length === 0) continue;

            // Group by Sales Rep
            const missedByRep = {};
            for (const order of missedOrders) {
                const rep = order.sales_rep || 'ללא נציג';
                if (!missedByRep[rep]) missedByRep[rep] = [];
                missedByRep[rep].push(order.order_number);
            }

            // Construct Message
            let messageBody = "";
            for (const [rep, orders] of Object.entries(missedByRep)) {
                messageBody += `\n👤 ${rep}:\n ${orders.join(', ')}\n`;
            }

            const title = `⚠️ פיספוסי מכירה להיום: ${event.name}`;
            
            // Send Pushover
            const pushRes = await fetch("https://api.pushover.net/1/messages.json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: token,
                    user: userKey,
                    title: title,
                    message: messageBody,
                    priority: 0, 
                    sound: "mechanical"
                })
            });
            
            const resData = await pushRes.json();
            messagesSent.push({ event: event.name, count: missedOrders.length, status: resData.status });
        }

        return Response.json({ success: true, messages: messagesSent });

    } catch (error) {
        console.error("Error in dailyEventMissedSalesNotification:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});