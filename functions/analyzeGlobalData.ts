import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { question } = await req.json();

        if (!question) {
            return Response.json({ error: 'Question is required' }, { status: 400 });
        }

        // Parallel fetch of extensive datasets (limit to recent 2000 records for performance/tokens)
        // We fetch practically everything to give the "all data" feel.
        const [
            incomeData, 
            expenseData, 
            repsData,
            tasksData,
            casparsData,
            attractionsData,
            pendingSalesData,
            eventsData
        ] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 2000),
            base44.asServiceRole.entities.Expense.list('-expense_date', 2000),
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.Task.list('-created_date', 500),
            base44.asServiceRole.entities.CasparFilling.list('-departure_date', 500),
            base44.asServiceRole.entities.Attraction.list(),
            base44.asServiceRole.entities.PendingSale.list('-created_date', 200),
            base44.asServiceRole.entities.ExpenseEvent.list()
        ]);

        // Simplify Data for Context Window Efficiency
        const contextData = {
            incomes: incomeData.map(r => ({
                order: r.order_number,
                rep: r.sales_rep,
                customer_details: r.customer, 
                totals: {
                    eur: r.eur_amount,
                    ils: r.shekel_amount,
                    usd: r.dollar_amount,
                    bit: r.bit_amount
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
                rep: e.sales_rep
            })),
            active_reps: repsData.map(u => ({ name: u.full_name, role: u.role })),
            tasks: tasksData.map(t => ({
                title: t.title,
                status: t.status,
                assignee: t.sales_rep,
                due: t.due_date
            })),
            caspars: casparsData.map(c => ({
                name: c.full_name,
                hotel: c.hotel,
                departure: c.departure_date
            })),
            events_list: attractionsData.map(a => ({ name: a.name, price: a.price_eur })),
            pending_sales: pendingSalesData.length,
            event_stats: eventsData.map(e => ({
                name: e.event_name,
                date: e.event_date,
                buyers: e.buyers_count,
                scanned: e.scanned_count
            }))
        };

        const prompt = `
        You are a smart business intelligence AI.
        You have access to the ENTIRE database of the company via the JSON data below.

        Data Context:
        ${JSON.stringify(contextData)}

        User Question: "${question}"

        Instructions:
        1. **Be Concise**: For simple questions (e.g., "How much did we earn?", "How many tasks are open?"), provide ONLY the direct answer/number. Do not explain the calculation or add fluff unless explicitly asked.
        2. **Full Analysis**: You can cross-reference data. For example, if asked about a specific rep, check their sales (incomes), expenses, and tasks.
        3. **Currency**: default to EUR if not specified. Approx rates: 1 ILS = 0.26 EUR, 1 USD = 0.95 EUR.
        4. **Language**: Answer in Hebrew.
        5. **Style**: Professional, direct, and helpful. 

        Answer the user's question now.
        `;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
        });

        return Response.json({ answer: response });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});