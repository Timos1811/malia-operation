import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { question, type } = await req.json();

        if (!question) {
            return Response.json({ error: 'Question is required' }, { status: 400 });
        }

        let data = [];
        let entityName = '';

        if (type === 'expenses') {
            // Fetch last 500 expenses
            data = await base44.asServiceRole.entities.Expense.list('-expense_date', 500);
            entityName = 'Expenses';
        } else if (type === 'income') {
            // Fetch last 500 income records
            data = await base44.asServiceRole.entities.TableData.list('-created_date', 500);
            entityName = 'Income/Orders';
        } else {
            return Response.json({ error: 'Invalid type' }, { status: 400 });
        }

        // Simplify data to save tokens (remove unnecessary fields if any, but these entities are small enough)
        // Convert to CSV-like string or JSON string might be efficient
        const dataString = JSON.stringify(data);

        const prompt = `
        You are a data analyst assistant.
        I will provide you with a JSON dataset of ${entityName}.
        
        Dataset:
        ${dataString}

        Question: ${question}

        Please answer the question based strictly on the provided dataset.
        If the calculation involves currency, please be precise.
        If you cannot answer based on the data, say so.
        Provide a concise answer in Hebrew.
        `;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            // We don't need internet context for internal data analysis usually, 
            // but if the user asks "how much is 50 EUR in ILS", the model knows rates generally or we provided them in data.
            // Keeping it simple.
        });

        return Response.json({ answer: response });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});