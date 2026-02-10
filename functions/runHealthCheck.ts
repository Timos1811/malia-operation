import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all data
        const [tableData, users] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 3000),
            base44.asServiceRole.entities.User.list()
        ]);

        const issues = [];
        const validUserNames = new Set(users.map(u => u.full_name));
        const orderMap = new Map();

        // Check 1: Duplicate Order Numbers
        tableData.forEach(row => {
            if (row.order_number) {
                if (orderMap.has(row.order_number)) {
                    issues.push({
                        type: 'Duplicate Order Number',
                        details: `Order ${row.order_number} appears multiple times (IDs: ${orderMap.get(row.order_number)}, ${row.id})`,
                        severity: 'High'
                    });
                } else {
                    orderMap.set(row.order_number, row.id);
                }
            }
        });

        // Check 2: Invalid Sales Reps
        tableData.forEach(row => {
            if (row.sales_rep && !validUserNames.has(row.sales_rep)) {
                issues.push({
                    type: 'Unknown Sales Rep',
                    details: `Order ${row.order_number || 'Unknown'}: Sales Rep "${row.sales_rep}" does not exist in Users table`,
                    severity: 'Medium'
                });
            }
        });

        // Check 3: Calculation Mismatches (EUR Status)
        tableData.forEach(row => {
            const requested = parseFloat(row.requested_amount) || 0;
            const eur = parseFloat(row.eur_amount) || 0;
            const nis = parseFloat(row.shekel_amount) || 0;
            const usd = parseFloat(row.dollar_amount) || 0;
            const bit = parseFloat(row.bit_amount) || 0;

            // Conversion rates (approximate, based on app logic)
            // 1 ILS = 0.26 EUR
            // 1 USD = 0.95 EUR
            const totalPaidInEur = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
            const diff = totalPaidInEur - requested;
            
            // Allow small float margin error
            const calculatedStatus = Math.abs(diff) < 1 ? 'מאוזן' : diff.toFixed(2);
            
            // Check if stored status matches logic
            // Note: Stored status might be just the number or "מאוזן"
            const storedStatus = row.eur_status;
            
            // Normalize for comparison
            let isMatch = false;
            if (storedStatus === 'מאוזן' && calculatedStatus === 'מאוזן') isMatch = true;
            else if (parseFloat(storedStatus) && Math.abs(parseFloat(storedStatus) - parseFloat(calculatedStatus)) < 2) isMatch = true;
            
            if (!isMatch && row.order_number) {
                 // Only report significant discrepancies
                 if (storedStatus !== calculatedStatus) {
                     // issues.push({
                     //    type: 'Status Calculation Mismatch',
                     //    details: `Order ${row.order_number}: Stored '${storedStatus}' vs Calculated '${calculatedStatus}'`,
                     //    severity: 'Low'
                     // });
                 }
            }
        });

        return Response.json({ 
            total_records: tableData.length,
            issue_count: issues.length,
            issues: issues.slice(0, 50) // Limit response size
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});