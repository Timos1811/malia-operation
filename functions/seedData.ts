import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REPS = [
    "David Cohen", "Sarah Levy", "Michael Ben-Ari", "Rachel Weiss", 
    "Daniel Golan", "Leah Katz", "Yossi Mizrahi", "Noa Peretz", 
    "Omer Friedman", "Maya Avraham"
];

const HOTELS = ["Blue Lagoon", "Grand Beach", "City Center", "Mountain View", "Seaside Resort"];
const COMPANIES = ["Caspar", "Neto Fun", "Kishrei Teufa"];

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Clear existing data
        const [expenses, events, incomes] = await Promise.all([
            base44.asServiceRole.entities.Expense.list('-created_date', 1000),
            base44.asServiceRole.entities.ExpenseEvent.list('-created_date', 1000),
            base44.asServiceRole.entities.TableData.list('-created_date', 1000)
        ]);

        await Promise.all([
            ...expenses.map(e => base44.asServiceRole.entities.Expense.delete(e.id)),
            ...events.map(e => base44.asServiceRole.entities.ExpenseEvent.delete(e.id)),
            ...incomes.map(i => base44.asServiceRole.entities.TableData.delete(i.id))
        ]);

        // 2. Create Incomes (TableData)
        const incomePromises = [];
        for (let i = 0; i < 30; i++) {
            const rep = REPS[i % REPS.length];
            const amount = Math.floor(Math.random() * 500) + 200;
            incomePromises.push(base44.asServiceRole.entities.TableData.create({
                order_number: `${10000 + i}`,
                customer: `Customer ${i} (${Math.floor(Math.random() * 4) + 1} pax)`,
                sales_rep: rep,
                requested_amount: amount.toString(),
                eur_amount: amount.toString(), // Fully paid in EUR
                eur_status: 'מאוזן',
                departure_date: new Date(Date.now() + Math.random() * 1000000000).toISOString().split('T')[0],
                nights: "4",
                gender: Math.random() > 0.5 ? "Male" : "Female",
                hotel: HOTELS[Math.floor(Math.random() * HOTELS.length)],
                company: COMPANIES[Math.floor(Math.random() * COMPANIES.length)],
                shekel_amount: "0",
                dollar_amount: "0",
                bit_amount: "0"
            }));
        }
        await Promise.all(incomePromises);

        // 3. Create Expenses
        // A. Refunds & Withdrawals (linked to Reps)
        for (const rep of REPS) {
            // Withdrawal
            await base44.asServiceRole.entities.Expense.create({
                reason: 'משיכה לאדם',
                recipient: rep,
                amount: Math.floor(Math.random() * 200) + 50,
                currency: 'EUR',
                expense_date: new Date().toISOString(),
                sales_rep: rep,
                notes: 'Advance payment'
            });

            // Refund
            if (Math.random() > 0.5) {
                await base44.asServiceRole.entities.Expense.create({
                    reason: 'החזר מלא',
                    recipient: rep,
                    amount: Math.floor(Math.random() * 100) + 20,
                    currency: 'EUR',
                    expense_date: new Date().toISOString(),
                    sales_rep: rep,
                    notes: 'Customer cancellation'
                });
            }
        }

        // B. Supplier Payments (with Events)
        const SUPPLIERS = ["Manoos", "Temis", "Mike", "Magda"];
        for (let i = 0; i < 5; i++) {
            const expense = await base44.asServiceRole.entities.Expense.create({
                reason: 'תשלום לספק',
                recipient: SUPPLIERS[i % SUPPLIERS.length],
                amount: Math.floor(Math.random() * 1000) + 500,
                currency: 'EUR',
                expense_date: new Date().toISOString(),
                sales_rep: 'System',
                notes: 'Event payment'
            });

            await base44.asServiceRole.entities.ExpenseEvent.create({
                expense_id: expense.id,
                event_name: 'Kodo Party',
                event_date: new Date().toISOString().split('T')[0],
                buyers_count: Math.floor(Math.random() * 50) + 10,
                scanned_count: Math.floor(Math.random() * 40) + 5
            });
        }

        // C. General Expenses (Eschel)
        for (let i = 0; i < 5; i++) {
             const rep = REPS[Math.floor(Math.random() * REPS.length)];
             await base44.asServiceRole.entities.Expense.create({
                reason: 'אשל',
                recipient: rep,
                amount: 50,
                currency: 'EUR',
                expense_date: new Date().toISOString(),
                sales_rep: rep,
                notes: 'Daily allowance'
            });
        }

        return Response.json({ success: true, message: "Data seeded successfully" });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});