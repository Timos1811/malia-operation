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

        // Parallel fetch of extensive datasets
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

        // Context Data
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

        // Format conversation history for the prompt
        // We take the last 10 messages to keep context but save tokens
        const recentMessages = messages.slice(-10);
        const historyText = recentMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

        const prompt = `
        You are a highly intelligent business analyst AI for a travel/events company.
        You have access to the ENTIRE database in the context below.

        Data Context:
        ${JSON.stringify(contextData)}

        Conversation History:
        ${historyText}

        Instructions:
        1. **Contextual Awareness**: Use the conversation history to understand follow-up questions (e.g., "And how many of them were..." refers to the previous topic).
        2. **Concise & Direct**: Give direct answers. Use bullet points for lists. Avoid generic intros like "Based on the data...".
        3. **Calculations**: Perform math on the fly (sums, averages, counts).
        4. **Currency**: Default to EUR. Approx rates: 1 ILS = 0.26 EUR, 1 USD = 0.95 EUR.
        5. **Language**: Respond in Hebrew.
        6. **Role**: You are helpful, professional, and sharp.

        Respond to the last user message based on the history and data.
        `;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
        });

        return Response.json({ answer: response });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});