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
        // Use Jerusalem time
        const now = new Date();
        const jerusalemDateStr = now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
        const jerusalemDate = new Date(jerusalemDateStr);
        const todayDay = jerusalemDate.getDay(); // 0=Sunday
        // Format YYYY-MM-DD manually to be safe
        const year = jerusalemDate.getFullYear();
        const month = String(jerusalemDate.getMonth() + 1).padStart(2, '0');
        const day = String(jerusalemDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

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
        // Sort by departure_date descending to get future dates first
        const allOrders = await base44.asServiceRole.entities.TableData.list('-departure_date', 1000);
        
        const activeOrders = allOrders.filter(order => {
            if (!order.departure_date) return false;
            return order.departure_date >= todayStr;
        });

        console.log(`Found ${activeOrders.length} active orders.`);

        if (activeOrders.length === 0) {
            return Response.json({ message: "No active orders" });
        }

        // 4. Get all active wristbands (valid_until >= today)
        // Sort by valid_until descending
        const allWristbands = await base44.asServiceRole.entities.Wristband.list('-valid_until', 2000);
        
        // Map order_number -> list of wristbands
        const wristbandsByOrder = {};
        for (const wb of allWristbands) {
            if (wb.valid_until && wb.valid_until < todayStr) continue; // Skip expired
            if (!wristbandsByOrder[wb.order_number]) {
                wristbandsByOrder[wb.order_number] = [];
            }
            wristbandsByOrder[wb.order_number].push(wb);
        }

        const messagesSent = [];

        // 5. Check for each event
        for (const event of eventsToday) {
            const missedOrders = [];

            for (const order of activeOrders) {
                const orderWristbands = wristbandsByOrder[order.order_number] || [];
                
                // Check if any wristband has this event
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
                // Add order number + customer name
                const label = `${order.order_number} (${order.customer || '?'})`;
                missedByRep[rep].push(label);
            }

            // Construct Message
            let messageBody = `אירוע: ${event.name}\nסה"כ חסרים: ${missedOrders.length}\n`;
            for (const [rep, orders] of Object.entries(missedByRep)) {
                messageBody += `\n👤 ${rep}:\n ${orders.join(', ')}\n`;
            }

            const title = `⚠️ פיספוסי מכירה להיום`;
            
            // Send Pushover
            try {
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
            } catch (err) {
                console.error("Pushover send error:", err);
            }
        }

        return Response.json({ success: true, messages: messagesSent });

    } catch (error) {
        console.error("Error in dailyEventMissedSalesNotification:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});