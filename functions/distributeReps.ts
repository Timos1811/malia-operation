import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate (admin/service role usually needed for bulk updates, 
        // but here we might just be the user. If public app, fine.)
        // We'll use service role to be sure we can update everything.
        
        const reps = ['יוסי', 'שרה', 'דני', 'רוני', 'מיכל', 'נועה', 'עומר'];
        
        // 1. Update TableData
        const tableDataRecords = await base44.asServiceRole.entities.TableData.list('-created_date', 100); 
        // Limit 100 should cover the 50 we created + extras.
        
        for (const record of tableDataRecords) {
            const randomRep = reps[Math.floor(Math.random() * reps.length)];
            await base44.asServiceRole.entities.TableData.update(record.id, {
                sales_rep: randomRep
            });
        }

        // 2. Update Expense
        const expenseRecords = await base44.asServiceRole.entities.Expense.list('-created_date', 100);
        
        for (const record of expenseRecords) {
            const randomRep = reps[Math.floor(Math.random() * reps.length)];
            await base44.asServiceRole.entities.Expense.update(record.id, {
                sales_rep: randomRep
            });
        }

        return Response.json({ 
            success: true, 
            message: `Updated ${tableDataRecords.length} TableData and ${expenseRecords.length} Expense records with 7 random reps.` 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});