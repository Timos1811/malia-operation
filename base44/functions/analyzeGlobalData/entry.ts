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

        const isAdmin = user.role === 'admin';
        const repFilter = isAdmin ? {} : { sales_rep: user.full_name };

        // 2. Parallel Data Fetching
        // Limit data fetching to user's data if they are not an admin
        const promises = [
            base44.asServiceRole.entities.TableData.filter(repFilter, '-created_date', 5000),
            base44.asServiceRole.entities.Expense.filter(repFilter, '-expense_date', 5000),
            isAdmin ? base44.asServiceRole.entities.User.list() : Promise.resolve([{ full_name: user.full_name, role: user.role }]),
            base44.asServiceRole.entities.Task.filter(repFilter, '-created_date', 5000),
            isAdmin ? base44.asServiceRole.entities.CasparFilling.list('-departure_date', 5000) : Promise.resolve([]),
            base44.asServiceRole.entities.Attraction.list(),
            base44.asServiceRole.entities.PendingSale.filter(repFilter, '-created_date', 5000),
            isAdmin ? base44.asServiceRole.entities.ExpenseEvent.list() : Promise.resolve([]),
            isAdmin ? base44.asServiceRole.entities.MoneyLocation.list() : Promise.resolve([]),
            isAdmin ? base44.asServiceRole.entities.Wristband.list() : Promise.resolve([]),
            isAdmin ? base44.asServiceRole.entities.WristbandScanLog.list('-scan_time', 2000) : Promise.resolve([]),
        ];

        if (potentialOrderNumbers.length > 0) {
            promises.push(base44.asServiceRole.entities.TableData.filter({
                ...repFilter,
                order_number: { $in: potentialOrderNumbers }
            }));
            promises.push(base44.asServiceRole.entities.Task.filter({
                ...repFilter,
                order_number: { $in: potentialOrderNumbers }
            }));
             promises.push(base44.asServiceRole.entities.PendingSale.filter({
                ...repFilter,
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
            wristbandsData,
            scansData,
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

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        const lastWeekStr = lastWeek.toISOString().split('T')[0];
        
        const twoWeeksAgo = new Date(now);
        twoWeeksAgo.setDate(now.getDate() - 14);
        const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];
        
        // Wristbands & Scans Aggregation for Live Insights
        const activeWristbandsCount = wristbandsData.filter(w => w.status === 'active').length;
        const scansToday = scansData.filter(s => s.scan_time && s.scan_time.startsWith(todayStr));
        const scansByEvent = scansToday.reduce((acc, scan) => {
            if(scan.status === 'success' || scan.status === 'processed') {
               acc[scan.event_name] = (acc[scan.event_name] || 0) + 1;
            }
            return acc;
        }, {});

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
                gender: p.gender, // Added for gender analysis
                date: p.created_date ? p.created_date.split('T')[0] : null
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
            })),
            wristbands_stats: {
                total_active_in_destination: activeWristbandsCount,
                successful_scans_today_by_event: scansByEvent
            },
            time_context: {
                today: todayStr,
                one_week_ago: lastWeekStr,
                two_weeks_ago: twoWeeksAgoStr
            }
        };

        const recentMessages = messages.slice(-8);
        const historyText = recentMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

        const prompt = `
        You are a PROACTIVE and SMART business analyst AI with access to system data. ${type ? `Focus your analysis on: ${type}.` : ''}
        
        USER ROLE: ${isAdmin ? 'ADMIN (Full Access)' : 'SALES REP (Limited Access to own data)'}
        If the user is a SALES REP, your answers must focus ONLY on their own sales, groups, and tasks. Do not attempt to answer questions about global cash locations, other sales reps, or global event statistics since that data is not provided to you.
        
        CONSTRAINTS & ADVANCED ANALYSIS LOGIC:
        1. **Truth Source**: TRUST the 'reps_stats' object for any questions about averages, totals, or performance. 
        2. **Drill-down (Cross-referencing)**: If asked WHY there is a shortage or to explain a discrepancy, cross-reference specific 'incomes' vs 'expenses' (especially withdrawals/refunds) to explain exactly where the gap comes from.
        3. **Event Trends & Popularity**: (ADMIN ONLY) If asked about event trends, compare 'event_stats' (which holds event_date, buyers, scanned). Compare the current week (between ${lastWeekStr} and ${todayStr}) vs previous week (between ${twoWeeksAgoStr} and ${lastWeekStr}). Explicitly state which events are selling more/less, and which events have the lowest/highest buyers.
        4. **Proactive Insights & Daily Summary**: If the user asks for a "סיכום יומי", "תובנות" or general status, you MUST provide a structured summary including:
           - ⚠️ **Departures Alert**: Identify any groups in 'incomes' or 'pending' where 'departure' date is today (${todayStr}) or tomorrow. Highlight if they have missing payments.
           - ${isAdmin ? `- 🚨 **Anomalies**: Highlight any rep from 'reps_stats' with unusually high 'shortage' (> 0) or 'withdrawals'.\n           - 📊 **Live Event Stats**: Report 'successful_scans_today_by_event' and 'total_active_in_destination' from 'wristbands_stats'.` : ''}
           - 💰 **Financial Day Summary**: Summarize incomes/expenses created today (${todayStr}).
        5. **Quantity vs Amount**: "How many" = COUNT items. "How much" / "סכום" = SUM monetary value.
        6. **Currency**: Keep original currencies (ILS/EUR/USD). DO NOT CONVERT unless asked.
        7. **Language**: Hebrew.
        8. **Style**: Professional, insightful, action-oriented, use emojis for readability (💰, 🚨, 📊, ✈️, 📈).

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