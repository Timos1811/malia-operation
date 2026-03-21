import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REPS = [
    "David Cohen", "Sarah Levy", "Michael Ben-Ari", "Rachel Weiss", 
    "Daniel Golan", "Leah Katz", "Yossi Mizrahi", "Noa Peretz", 
    "Omer Friedman", "Maya Avraham"
];

// Weighted distribution logic
const REP_WEIGHTS = [0.2, 0.5, 0.8, 0.3, 0.9, 0.1, 0.6, 0.4, 0.7, 0.5]; 

function getRandomRep() {
    const totalWeight = REP_WEIGHTS.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < REPS.length; i++) {
        random -= REP_WEIGHTS[i];
        if (random < 0) return REPS[i];
    }
    return REPS[REPS.length - 1];
}

const HOTELS = ["Blue Lagoon", "Grand Beach", "City Center", "Mountain View", "Seaside Resort"];
const COMPANIES = ["כ", "נ", "ק"]; 
const EXPENSE_REASONS = ['משיכה לאדם', 'החזר מלא', 'החזר חלקי', 'אשל', 'תשלום לספק', 'מונית', 'ארוחה'];

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function deleteAll(base44, entityName) {
    let deletedCount = 0;
    while (true) {
        const items = await base44.asServiceRole.entities[entityName].list({ limit: 50 });
        if (!items || items.length === 0) break;
        
        // Delete individually with delay to avoid rate limits
        for (const item of items) {
            await base44.asServiceRole.entities[entityName].delete(item.id);
            await delay(50); // 50ms delay between deletes
        }
        
        deletedCount += items.length;
        if (items.length < 50) break;
        await delay(200);
    }
    console.log(`Deleted ${deletedCount} records from ${entityName}`);
}

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Delete all existing data
        await deleteAll(base44, 'TableData');
        await deleteAll(base44, 'Expense');
        await deleteAll(base44, 'PendingSale');
        await deleteAll(base44, 'ExpenseEvent');

        // 2. Prepare Data
        const INCOME_COUNT = 220; 
        const EXPENSE_COUNT = 80;

        const incomeData = [];
        const expenseData = [];

        for (let i = 0; i < INCOME_COUNT; i++) {
            const rep = getRandomRep();
            const pax = Math.floor(Math.random() * 5) + 1;
            const amount = pax * (Math.floor(Math.random() * 200) + 300);
            
            let paidAmount = amount;
            let statusStr = 'מאוזן';
            const balanceRand = Math.random();
            if (balanceRand < 0.2) {
                paidAmount = amount - (Math.floor(Math.random() * 100) + 20);
                statusStr = `חוסר ${amount - paidAmount}`;
            } else if (balanceRand < 0.4) {
                paidAmount = amount + (Math.floor(Math.random() * 100) + 20);
                statusStr = `יתרה ${paidAmount - amount}`;
            }

            const isPast = Math.random() > 0.5;
            const daysOffset = isPast ? -Math.floor(Math.random() * 20) - 1 : Math.floor(Math.random() * 20);
            const departureDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            incomeData.push({
                order_number: `${30000 + i}`,
                customer: `${pax}`,
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

        for (let i = 0; i < EXPENSE_COUNT; i++) {
            const rep = getRandomRep();
            const daysOffset = Math.floor(Math.random() * 40) - 20; 
            const expenseDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();

            expenseData.push({
                reason: EXPENSE_REASONS[Math.floor(Math.random() * EXPENSE_REASONS.length)],
                recipient: rep,
                amount: Math.floor(Math.random() * 400) + 20,
                currency: 'EUR',
                expense_date: expenseDate,
                sales_rep: rep,
                notes: `Seed expense #${i+1}`
            });
        }

        // 3. Create using bulkCreate in batches of 50
        // Slicing to ensure we don't send too large payload even for bulkCreate
        const batchSize = 50;
        
        for (let i = 0; i < incomeData.length; i += batchSize) {
            const batch = incomeData.slice(i, i + batchSize);
            await base44.asServiceRole.entities.TableData.bulkCreate(batch);
            await delay(200);
        }

        for (let i = 0; i < expenseData.length; i += batchSize) {
            const batch = expenseData.slice(i, i + batchSize);
            await base44.asServiceRole.entities.Expense.bulkCreate(batch);
            await delay(200);
        }

        return Response.json({ 
            success: true, 
            message: `Successfully seeded ${INCOME_COUNT} incomes and ${EXPENSE_COUNT} expenses using bulkCreate.` 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});