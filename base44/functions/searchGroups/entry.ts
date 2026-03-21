import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse payload
        const payload = await req.json();
        const { sales_rep, event_name, event_status } = payload;
        
        // 1. Base Query for TableData
        let query = {};
        if (sales_rep && sales_rep !== 'all') {
            query.sales_rep = sales_rep;
        }

        // Fetch groups (limit to 1000 recent for performance)
        const groups = await base44.entities.TableData.filter(query, '-created_date', 1000);

        // 2. If no event filter is active, return the groups
        if (!event_name || event_name === 'all' || !event_status || event_status === 'all') {
            return Response.json(groups);
        }

        // 3. Process Event Filter
        // We need to identify which orders have purchased the specific event.
        // We'll fetch wristbands to check their allowed_events.
        // To optimize, we could try to filter wristbands by order_number if the list is small,
        // but fetching recent wristbands is likely more efficient than N queries.
        
        const wristbands = await base44.entities.Wristband.list('-created_date', 3000);
        
        const ordersWithEvent = new Set();
        wristbands.forEach(wb => {
            if (wb.allowed_events && Array.isArray(wb.allowed_events) && wb.allowed_events.includes(event_name)) {
                if (wb.order_number) {
                    ordersWithEvent.add(wb.order_number);
                }
            }
        });

        // Filter the groups based on the event status
        const filteredGroups = groups.filter(group => {
            if (!group.order_number) return false;
            
            const hasEvent = ordersWithEvent.has(group.order_number);
            
            if (event_status === 'bought') {
                return hasEvent;
            } else if (event_status === 'not_bought') {
                return !hasEvent;
            }
            return true;
        });

        return Response.json(filteredGroups);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});