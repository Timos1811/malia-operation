import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Existing Reference Data
        const [users, attractions] = await Promise.all([
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.Attraction.list()
        ]);

        const reps = users.map(u => u.full_name);
        const eventNames = attractions.map(a => a.name);

        if (reps.length === 0) return Response.json({ message: "No users found to use as reps" });

        // Helpers
        const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const getRandomDate = (start, end) => {
            return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
        };
        const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        const customerNames = ["דני כהן", "יוסי לוי", "רוני אברהם", "מיכל שחר", "גלית יוסף", "עומר אדם", "נועה קירל", "עידן רייכל", "שלמה ארצי", "משה פרץ", "אייל גולן", "שרית חדד", "דודו אהרון", "ליאור נרקיס", "קובי פרץ", "רגב הוד", "פאר טסי", "עדן בן זקן", "סטטיק", "בן אל תבורי"];
        const hotels = ["Blue Sea", "Laguna", "Sunny Beach", "Grand Hotel", "Royal Palace", "Beach Resort", "Mountain View", "City Center", "Old Town", "New World"];
        const expenseReasons = ["מונית", "ארוחת צוות", "ציוד משרדי", "שיווק", "כיבוד", "דלק", "חניה", "תחזוקה", "נקיון", "אחר"];

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 60); // Last 60 days
        const endDate = new Date();

        const newSales = [];
        const newExpenses = [];
        const newPendingSales = [];
        const newCaspars = [];
        const newTasks = [];

        // 2. Generate Profitable Sales (Income) - High Volume
        for (let i = 0; i < 50; i++) {
            const isEur = Math.random() > 0.5;
            const rep = getRandomItem(reps);
            newSales.push({
                order_number: `ORD-${getRandomInt(10000, 99999)}`,
                customer: getRandomItem(customerNames),
                departure_date: getRandomDate(startDate, endDate).split('T')[0],
                nights: getRandomInt(3, 14).toString(),
                gender: Math.random() > 0.5 ? "זכר" : "נקבה",
                hotel: getRandomItem(hotels),
                company: Math.random() > 0.5 ? "קשרי תעופה" : "נטו פאן",
                requested_amount: getRandomInt(500, 2000).toString(),
                eur_amount: isEur ? getRandomInt(200, 1000).toString() : "0",
                shekel_amount: !isEur ? getRandomInt(500, 3000).toString() : "0",
                dollar_amount: "0",
                bit_amount: Math.random() > 0.8 ? getRandomInt(100, 500).toString() : "0",
                eur_status: "מאוזן",
                comments: "נוצר אוטומטית",
                sales_rep: rep,
                created_date: getRandomDate(startDate, endDate)
            });
        }

        // 3. Generate Lower Expenses (To ensure Profit)
        for (let i = 0; i < 20; i++) {
            const currency = Math.random() > 0.7 ? "ILS" : "EUR";
            newExpenses.push({
                reason: getRandomItem(expenseReasons),
                recipient: getRandomItem(customerNames), // Just using random names
                amount: currency === "EUR" ? getRandomInt(20, 100) : getRandomInt(50, 400),
                currency: currency,
                expense_date: getRandomDate(startDate, endDate).split('T')[0],
                sales_rep: getRandomItem(reps),
                notes: "הוצאה אוטומטית"
            });
        }

        // 4. Generate Pending Sales
        for (let i = 0; i < 15; i++) {
            newPendingSales.push({
                order_number: `PEND-${getRandomInt(10000, 99999)}`,
                customer: getRandomItem(customerNames),
                departure_date: getRandomDate(endDate, new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000)).split('T')[0], // Future dates
                nights: getRandomInt(3, 7).toString(),
                gender: Math.random() > 0.5 ? "זכר" : "נקבה",
                hotel: getRandomItem(hotels),
                company: "קשרי תעופה",
                requested_amount: getRandomInt(600, 1500).toString(),
                sales_rep: getRandomItem(reps),
                created_date: getRandomDate(startDate, endDate),
                envelope_received: Math.random() > 0.5
            });
        }

         // 5. Generate Caspar Fillings
         for (let i = 0; i < 10; i++) {
            newCaspars.push({
                full_name: getRandomItem(customerNames),
                phone_number: `05${getRandomInt(0, 9)}-${getRandomInt(1000000, 9999999)}`,
                hotel: getRandomItem(hotels),
                departure_date: getRandomDate(startDate, endDate).split('T')[0],
                people_count: getRandomInt(1, 5),
                notification_sent: true
            });
        }

        // 6. Generate Tasks
        for (let i = 0; i < 10; i++) {
            newTasks.push({
                title: `משימה עבור ${getRandomItem(customerNames)}`,
                description: "בדיקת סטטוס והשלמת פרטים",
                status: Math.random() > 0.5 ? "todo" : "done",
                priority: Math.random() > 0.5 ? "high" : "medium",
                due_date: getRandomDate(startDate, endDate).split('T')[0],
                sales_rep: getRandomItem(reps)
            });
        }


        // Bulk Insert
        await Promise.all([
            base44.asServiceRole.entities.TableData.bulkCreate(newSales),
            base44.asServiceRole.entities.Expense.bulkCreate(newExpenses),
            base44.asServiceRole.entities.PendingSale.bulkCreate(newPendingSales),
            base44.asServiceRole.entities.CasparFilling.bulkCreate(newCaspars),
            base44.asServiceRole.entities.Task.bulkCreate(newTasks)
        ]);

        return Response.json({ 
            success: true, 
            added: {
                sales: newSales.length,
                expenses: newExpenses.length,
                pending: newPendingSales.length,
                caspars: newCaspars.length,
                tasks: newTasks.length
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});