import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { messages, type } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return Response.json({ error: 'Messages array is required' }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1]?.content || '';
        
        // 1. Smart Search Detection
        const potentialOrderNumbers = lastMessage.match(/\b\d{4,10}\b/g) || [];

        // 2. Parallel Data Fetching
        // INCREASED LIMITS to ensure accurate global stats calculation
        const promises = [
            base44.asServiceRole.entities.TableData.list('-created_date', 5000),
            base44.asServiceRole.entities.Expense.list('-expense_date', 5000),
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.Task.list('-created_date', 5000),
            base44.asServiceRole.entities.CasparFilling.list('-departure_date', 5000),
            base44.asServiceRole.entities.Attraction.list(),
            base44.asServiceRole.entities.PendingSale.list('-created_date', 5000),
            base44.asServiceRole.entities.ExpenseEvent.list(),
            base44.asServiceRole.entities.MoneyLocation.list(),
        ];

        if (potentialOrderNumbers.length > 0) {
            promises.push(base44.asServiceRole.entities.TableData.filter({
                order_number: { $in: potentialOrderNumbers }
            }));
            promises.push(base44.asServiceRole.entities.Task.filter({
                order_number: { $in: potentialOrderNumbers }
            }));
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
            moneyLocationsData,
            searchedIncomes,
            searchedTasks,
            searchedPendingSales
        ] = results;

        if (searchedIncomes) incomeData = [...incomeData, ...searchedIncomes];
        if (searchedTasks) tasksData = [...tasksData, ...searchedTasks];
        if (searchedPendingSales) pendingSalesData = [...pendingSalesData, ...searchedPendingSales];

        // Deduplicate
        incomeData = Array.from(new Map(incomeData.map(item => [item.id, item])).values());
        tasksData = Array.from(new Map(tasksData.map(item => [item.id, item])).values());
        pendingSalesData = Array.from(new Map(pendingSalesData.map(item => [item.id, item])).values());


        // --- AGGREGATION LOGIC (Mirrors pages/ManagerDashboard.js) ---
        const salesReps = new Set(incomeData.map(s => s.sales_rep).filter(Boolean));
        const expenseReps = new Set(expenseData.map(e => e.sales_rep).filter(Boolean));
        const recipients = new Set(expenseData.filter(e => e.reason === 'משיכה לאדם').map(e => e.recipient).filter(Boolean));
        const allStatsUsers = new Set([...salesReps, ...expenseReps, ...recipients]);

        const repsStats = Array.from(allStatsUsers).map(repName => {
            const userSales = incomeData.filter(s => s.sales_rep === repName);
            
            // Total Income (EUR equivalent)
            const totalIncome = userSales.reduce((sum, sale) => {
                const eur = parseFloat(sale.eur_amount) || 0;
                const nis = parseFloat(sale.shekel_amount) || 0;
                const usd = parseFloat(sale.dollar_amount) || 0;
                const bit = parseFloat(sale.bit_amount) || 0;
                return sum + eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
            }, 0);

            // Total Customers
            const totalCustomers = userSales.reduce((sum, sale) => {
                const customerStr = String(sale.customer || '');
                const numberMatch = customerStr.match(/\d+/);
                return sum + (numberMatch ? parseInt(numberMatch[0]) : 0);
            }, 0);

            // Average per Customer
            const averagePerCustomer = totalCustomers > 0 ? totalIncome / totalCustomers : 0;

            // Expenses logic
            const userExpenses = expenseData.filter(e => e.sales_rep === repName);
            
            const fullRefunds = userExpenses
                .filter(e => e.reason === 'החזר מלא')
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

            const partialRefunds = userExpenses
                .filter(e => e.reason === 'החזר חלקי')
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

            const withdrawals = expenseData
                .filter(e => e.reason === 'משיכה לאדם' && e.recipient === repName)
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

             const shortage = userSales.reduce((sum, sale) => {
                if (sale.eur_status && sale.eur_status !== 'מאוזן') {
                  const val = parseFloat(sale.eur_status);
                  if (!isNaN(val) && val < 0) return sum + Math.abs(val);
                }
                return sum;
              }, 0);

            return {
                name: repName,
                total_income_eur: Math.round(totalIncome),
                total_customers: totalCustomers,
                avg_per_customer_eur: Math.round(averagePerCustomer),
                full_refunds: Math.round(fullRefunds),
                partial_refunds: Math.round(partialRefunds),
                withdrawals: Math.round(withdrawals),
                shortage: Math.round(shortage),
                groups_count: userSales.length
            };
        });
        // -----------------------------------------------------------


        const contextData = {
            // PRE-CALCULATED STATS (The Source of Truth)
            reps_stats: repsStats, 

            // Raw data for other queries
            incomes: incomeData.map(r => ({ 
                order: r.order_number,
                rep: r.sales_rep,
                customer: r.customer, 
                gender: r.gender, // Added for gender analysis
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
                notes: e.notes 
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
                customer: p.customer,
                gender: p.gender // Added for gender analysis
            })),
            event_stats: eventsData.map(e => ({
                name: e.event_name,
                date: e.event_date,
                buyers: e.buyers_count,
                scanned: e.scanned_count
            })),
            money_locations: moneyLocationsData.map(m => ({
                name: m.name,
                amount: m.amount,
                currency: m.currency
            }))
            };

        const recentMessages = messages.slice(-8);
        const historyText = recentMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

        const prompt = `
        You are a smart business analyst AI with access to ALL system data. ${type ? `Focus your analysis on: ${type}.` : ''}
        
        CONSTRAINTS:
        1. **Truth Source**: TRUST the 'reps_stats' object for any questions about sales reps, averages, totals, or performance. It contains pre-calculated, accurate data.
        2. **Deep Analysis**: You have access to raw data (incomes, expenses, etc.). Use it to answer complex questions like "which day had the most sales for females".
           - For gender analysis: Check 'gender' field in 'incomes' and 'pending'.
           - For money locations: Check 'money_locations'.
        3. **Quantity vs Amount**: 
           - "How many" / "כמה" / "quantity" = COUNT items.
           - "How much" / "סכום" / "amount" / "total" = SUM monetary value.
        4. **Currency**: Keep original currencies (ILS/EUR/USD). DO NOT CONVERT unless asked.
        5. **Search**: If user asked for an Order ID and it's in the data -> Show details. If not -> Say "Not found".
        6. **Language**: Hebrew.
        7. **Style**: Professional, concise, data-driven.

        DATA CONTEXT:
        ${JSON.stringify(contextData)}

        CONVERSATION:
        ${historyText}
        
        Analyze the data deeply and answer the user's last question.
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