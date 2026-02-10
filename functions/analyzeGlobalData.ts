import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return Response.json({ error: 'Messages array is required' }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1]?.content || '';
        
        // 1. Smart Search Detection
        // Extract potential order numbers (4-10 digits)
        const potentialOrderNumbers = lastMessage.match(/\b\d{4,10}\b/g) || [];
        // Extract potential names (simple heuristic: 2-3 words in Hebrew/English) - skipped for now to avoid noise, focusing on IDs and general recent context.

        // 2. Parallel Data Fetching
        const promises = [
            // General Recent Context (Reduced limits to prevent overflow/errors)
            base44.asServiceRole.entities.TableData.list('-created_date', 400),
            base44.asServiceRole.entities.Expense.list('-expense_date', 400),
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.Task.list('-created_date', 200),
            base44.asServiceRole.entities.CasparFilling.list('-departure_date', 200),
            base44.asServiceRole.entities.Attraction.list(),
            base44.asServiceRole.entities.PendingSale.list('-created_date', 100),
            base44.asServiceRole.entities.ExpenseEvent.list(),
        ];

        // Add Specific Search Queries if ID detected
        if (potentialOrderNumbers.length > 0) {
            // Search in TableData
            promises.push(base44.asServiceRole.entities.TableData.filter({
                order_number: { $in: potentialOrderNumbers }
            }));
            // Search in Tasks
            promises.push(base44.asServiceRole.entities.Task.filter({
                order_number: { $in: potentialOrderNumbers }
            }));
             // Search in PendingSales
             promises.push(base44.asServiceRole.entities.PendingSale.filter({
                order_number: { $in: potentialOrderNumbers }
            }));
        }

        const results = await Promise.all(promises);

        let [
            incomeData, 
            expenseData, 
            repsData,
            tasksData,
            casparsData,
            attractionsData,
            pendingSalesData,
            eventsData,
            // Optional search results
            searchedIncomes,
            searchedTasks,
            searchedPendingSales
        ] = results;

        // Merge search results into main arrays if they exist
        if (searchedIncomes) incomeData = [...incomeData, ...searchedIncomes];
        if (searchedTasks) tasksData = [...tasksData, ...searchedTasks];
        if (searchedPendingSales) pendingSalesData = [...pendingSalesData, ...searchedPendingSales];

        // Deduplicate (in case search result is also in recent list)
        incomeData = Array.from(new Map(incomeData.map(item => [item.id, item])).values());
        tasksData = Array.from(new Map(tasksData.map(item => [item.id, item])).values());
        pendingSalesData = Array.from(new Map(pendingSalesData.map(item => [item.id, item])).values());

        // 3. Optimized Context Construction (Minimal fields to save tokens)
        const contextData = {
            incomes: incomeData.map(r => ({
                order: r.order_number,
                rep: r.sales_rep,
                customer: r.customer, 
                // Only send relevant amount fields to save space
                amounts: {
                    eur: r.eur_amount || 0,
                    ils: r.shekel_amount || 0,
                    usd: r.dollar_amount || 0
                },
                hotel: r.hotel,
                date: r.created_date ? r.created_date.split('T')[0] : null
            })),
            expenses: expenseData.map(e => ({
                reason: e.reason,
                recipient: e.recipient,
                amount: e.amount,
                currency: e.currency,
                date: e.expense_date,
                rep: e.sales_rep,
                notes: e.notes // Added notes for better context
            })),
            reps: repsData.map(u => u.full_name),
            tasks: tasksData.map(t => ({
                title: t.title,
                status: t.status,
                assignee: t.sales_rep,
                due: t.due_date,
                order: t.order_number
            })),
            caspars: casparsData.map(c => ({
                name: c.full_name,
                hotel: c.hotel,
                departure: c.departure_date
            })),
            events: attractionsData.map(a => ({ name: a.name, price: a.price_eur })),
            pending: pendingSalesData.map(p => ({
                order: p.order_number,
                rep: p.sales_rep,
                customer: p.customer
            })),
            event_stats: eventsData.map(e => ({
                name: e.event_name,
                date: e.event_date,
                buyers: e.buyers_count,
                scanned: e.scanned_count
            }))
        };

        // 4. Smart Prompt
        const recentMessages = messages.slice(-8); // Keep last 8 messages
        const historyText = recentMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

        const prompt = `
        You are a smart business analyst AI.
        
        CONSTRAINTS:
        1. **Quantity vs Amount**: 
           - "How many" / "כמה" / "quantity" = COUNT records.
           - "How much" / "סכום" / "amount" / "total" = SUM monetary value.
        2. **Currency**: Keep original currencies (ILS/EUR/USD). DO NOT CONVERT unless asked.
        3. **Search**: If user asked for an Order ID and it's in the data -> Show details. If not -> Say "Not found".
        4. **Language**: Hebrew.
        5. **Style**: Professional, concise, data-driven.

        DATA CONTEXT (Recent & Searched):
        ${JSON.stringify(contextData)}

        CONVERSATION:
        ${historyText}
        
        Analyze the data and answer the user's last question.
        `;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
        });

        return Response.json({ answer: response });

    } catch (error) {
        console.error("Global Chat Error:", error);
        return Response.json({ error: error.message || "An error occurred while processing your request." }, { status: 500 });
    }
});