import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REPS = [
    "David Cohen", "Sarah Levy", "Michael Ben-Ari", "Rachel Weiss", 
    "Daniel Golan", "Leah Katz", "Yossi Mizrahi", "Noa Peretz", 
    "Omer Friedman", "Maya Avraham"
];

const CUSTOMER_NAMES = [
    "Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Dahan", "Avraham", 
    "Friedman", "Katz", "Azoulay", "Gabay", "Hadad", "Amar", "Ohana", 
    "Bar", "Klein", "Shapira", "Segal", "Golan", "Baruch"
];

const HOTELS = ["Blue Lagoon", "Grand Beach", "City Center", "Mountain View", "Seaside Resort"];
const COMPANIES = ["Caspar", "Neto Fun", "Kishrei Teufa"];

async function processInChunks(items, processFn, chunkSize = 3) {
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await Promise.all(chunk.map(processFn));
        await new Promise(resolve => setTimeout(resolve, 200)); // Add delay to avoid rate limits
    }
}

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

        await processInChunks(expenses, e => base44.asServiceRole.entities.Expense.delete(e.id));
        await processInChunks(events, e => base44.asServiceRole.entities.ExpenseEvent.delete(e.id));
        await processInChunks(incomes, i => base44.asServiceRole.entities.TableData.delete(i.id));

        // 2. Create Incomes (TableData)
        // Ensure "customer" field contains ONLY the pax count as a number, or "Name Count" where Count is the first number
        const incomeData = [];
        for (let i = 0; i < 50; i++) {
            const rep = REPS[i % REPS.length];
            const pax = Math.floor(Math.random() * 5) + 1; // 1-5 people
            const name = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
            const amount = pax * (Math.floor(Math.random() * 200) + 300); // 300-500 EUR per person

            // Varied Balance Logic
            let paidAmount = amount;
            let statusStr = 'מאוזן';
            const balanceRand = Math.random();
            
            if (balanceRand < 0.33) {
                // Shortage (paid less)
                paidAmount = amount - (Math.floor(Math.random() * 100) + 20);
                statusStr = `חוסר ${amount - paidAmount}`;
            } else if (balanceRand < 0.66) {
                // Surplus (paid more)
                paidAmount = amount + (Math.floor(Math.random() * 100) + 20);
                statusStr = `יתרה ${paidAmount - amount}`;
            }

            // Varied Departure Date (Past and Future)
            const daysOffset = Math.floor(Math.random() * 30) - 15; // -15 to +15 days from now
            const departureDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            incomeData.push({
                order_number: `${20000 + i}`,
                customer: `${pax}`, // Only the number of passengers
                sales_rep: rep,
                requested_amount: amount.toString(),
                eur_amount: paidAmount.toString(),
                eur_status: statusStr,
                departure_date: departureDate,
                nights: "4",
                gender: Math.random() > 0.5 ? "Male" : "Female",
                hotel: HOTELS[Math.floor(Math.random() * HOTELS.length)],
                company: COMPANIES[Math.floor(Math.random() * COMPANIES.length)],
                shekel_amount: "0",
                dollar_amount: "0",
                bit_amount: "0"
            });
        }
        await processInChunks(incomeData, data => base44.asServiceRole.entities.TableData.create(data));

        // 3. Create Expenses
        const expenseTasks = [];

        // For EACH rep, create varied expenses
        for (const rep of REPS) {
            
            // A. Withdrawals (Meshicha) - 1 to 3 records per rep
            const numWithdrawals = Math.floor(Math.random() * 3) + 1;
            for (let k = 0; k < numWithdrawals; k++) {
                expenseTasks.push(async () => {
                    await base44.asServiceRole.entities.Expense.create({
                        reason: 'משיכה לאדם',
                        recipient: rep,
                        amount: Math.floor(Math.random() * 300) + 50,
                        currency: 'EUR',
                        expense_date: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
                        sales_rep: rep,
                        notes: `Withdrawal #${k+1}`
                    });
                });
            }

            // B. Full Refunds (Hechzer Male) - 1 to 2 records per rep
            const numFullRefunds = Math.floor(Math.random() * 2) + 1;
            for (let k = 0; k < numFullRefunds; k++) {
                expenseTasks.push(async () => {
                    await base44.asServiceRole.entities.Expense.create({
                        reason: 'החזר מלא',
                        recipient: rep,
                        amount: Math.floor(Math.random() * 500) + 100,
                        currency: 'EUR',
                        expense_date: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
                        sales_rep: rep,
                        notes: `Full refund for cancellation #${k+1}`
                    });
                });
            }

            // C. Partial Refunds (Hechzer Helki) - 1 to 3 records per rep
            const numPartialRefunds = Math.floor(Math.random() * 3) + 1;
            for (let k = 0; k < numPartialRefunds; k++) {
                expenseTasks.push(async () => {
                    await base44.asServiceRole.entities.Expense.create({
                        reason: 'החזר חלקי',
                        recipient: rep,
                        amount: Math.floor(Math.random() * 150) + 20,
                        currency: 'EUR',
                        expense_date: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
                        sales_rep: rep,
                        notes: `Partial refund (compensation) #${k+1}`
                    });
                });
            }

             // D. Eshel (Allowance) - 1 to 2 records
             const numEshel = Math.floor(Math.random() * 2) + 1;
             for (let k = 0; k < numEshel; k++) {
                expenseTasks.push(async () => {
                    await base44.asServiceRole.entities.Expense.create({
                        reason: 'אשל',
                        recipient: rep,
                        amount: 50,
                        currency: 'EUR',
                        expense_date: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
                        sales_rep: rep,
                        notes: 'Daily food allowance'
                    });
                });
            }
        }

        await processInChunks(expenseTasks, task => task());

        // 4. Supplier Payments (Independent of reps)
        const supplierTasks = [];
        const SUPPLIERS = ["Manoos", "Temis", "Mike", "Magda"];
        const EVENTS = ["Kodo", "Candy", "Shuttles"];
        
        for (let i = 0; i < 8; i++) {
            supplierTasks.push(async () => {
                const expense = await base44.asServiceRole.entities.Expense.create({
                    reason: 'תשלום לספק',
                    recipient: SUPPLIERS[i % SUPPLIERS.length],
                    amount: Math.floor(Math.random() * 2000) + 500,
                    currency: 'EUR',
                    expense_date: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
                    sales_rep: 'System', // Supplier payments usually not linked to a specific rep sales-wise
                    notes: 'Event production payment'
                });

                await base44.asServiceRole.entities.ExpenseEvent.create({
                    expense_id: expense.id,
                    event_name: EVENTS[i % EVENTS.length],
                    event_date: new Date(Date.now() + Math.random() * 1000000000).toISOString().split('T')[0],
                    buyers_count: Math.floor(Math.random() * 100) + 20,
                    scanned_count: Math.floor(Math.random() * 80) + 10
                });
            });
        }
        await processInChunks(supplierTasks, task => task());


        return Response.json({ success: true, message: "Data seeded successfully with updated logic" });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});