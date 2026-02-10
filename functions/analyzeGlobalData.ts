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

        // Parallel fetch of key datasets
        const [incomeData, expenseData, repsData] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 1000), // Last 1000 incomes
            base44.asServiceRole.entities.Expense.list('-expense_date', 1000),   // Last 1000 expenses
            base44.asServiceRole.entities.User.list()
        ]);

        // Simplify Income Data for Token Efficiency
        const simplifiedIncome = incomeData.map(r => ({
            rep: r.sales_rep,
            customers: r.customer, // Keeping raw string to let LLM parse "7 people" etc if needed, or better, try to extract number if possible.
            total_eur: r.eur_amount,
            total_shekel: r.shekel_amount,
            total_usd: r.dollar_amount,
            total_bit: r.bit_amount,
            date: r.created_date ? r.created_date.split('T')[0] : null
        }));

        // Simplify Expense Data
        const simplifiedExpenses = expenseData.map(e => ({
            reason: e.reason,
            recipient: e.recipient,
            amount: e.amount,
            currency: e.currency,
            date: e.expense_date
        }));

        const dataContext = JSON.stringify({
            income_sample: simplifiedIncome,
            expenses_sample: simplifiedExpenses,
            active_reps: repsData.map(u => u.full_name)
        });

        const prompt = `
        You are a business intelligence AI for a travel/events company.
        You have access to the following datasets (JSON format):
        1. income_sample: Recent sales/income records.
        2. expenses_sample: Recent expense records.
        3. active_reps: List of sales representatives.

        Data Context:
        ${dataContext}

        User Question: "${question}"

        Instructions:
        1. Analyze the provided data to answer the user's question.
        2. If asking for averages, totals, or performance, calculate them from the data provided.
        3. Note that 'customers' field in income might need parsing (e.g. "5 pax" or just "5"). 
        4. Currency conversion rates (approx): 1 USD = 0.95 EUR, 1 ILS = 0.26 EUR. Use these if aggregation is needed in one currency (usually EUR).
        5. Provide a clear, concise answer in Hebrew.
        6. If the data is insufficient to answer perfectly (e.g. asking for data older than the sample), mention that the answer is based on the recent 1000 records.
        `;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
        });

        return Response.json({ answer: response });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});