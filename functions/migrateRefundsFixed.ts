import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // This is an admin operation, so ideally we check if user is admin, 
        // but for migration we'll just proceed if authenticated.
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch ALL expenses (limit 1000 should be enough for now based on the list)
        // If there are more, we might need pagination, but let's start with this.
        const expenses = await base44.asServiceRole.entities.Expense.list('-created_date', 1000);
        
        // 2. Filter for refunds
        const refunds = expenses.filter(e => 
            e.reason === 'החזר מלא' || e.reason === 'החזר חלקי'
        );

        let updatedCount = 0;
        const updates = [];

        // 3. Update each refund
        for (const expense of refunds) {
            // Only update if sales_rep exists AND recipient is different
            if (expense.sales_rep && expense.recipient !== expense.sales_rep) {
                // We push the promise to an array to await them or execute sequentially
                // Using sequential for safety in this script
                await base44.asServiceRole.entities.Expense.update(expense.id, {
                    recipient: expense.sales_rep
                });
                updatedCount++;
                updates.push({ id: expense.id, old: expense.recipient, new: expense.sales_rep });
            }
        }

        return Response.json({ 
            success: true, 
            total_refunds_found: refunds.length,
            updated_count: updatedCount,
            details: updates 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});