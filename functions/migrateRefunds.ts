import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch all expenses
        const expenses = await base44.asServiceRole.entities.Expense.list('-created_date', 1000);
        
        // Filter for refunds
        const refunds = expenses.filter(e => 
            e.reason === 'החזר מלא' || e.reason === 'החזר חלקי'
        );

        let updatedCount = 0;
        
        // Update each refund
        for (const expense of refunds) {
            // We set the recipient to the sales_rep. 
            // If sales_rep is empty, we leave it (or set to the creator?)
            // Assuming sales_rep is the correct "User" to be the recipient.
            if (expense.sales_rep && expense.recipient !== expense.sales_rep) {
                await base44.asServiceRole.entities.Expense.update(expense.id, {
                    recipient: expense.sales_rep
                });
                updatedCount++;
            }
        }

        return Response.json({ success: true, updated: updatedCount });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});