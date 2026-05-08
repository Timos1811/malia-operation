import { createClientFromRequest } from 'npm:@base44/sdk@0.8.27';

function getNextEventDate(eventDays, startTimeStr) {
    if (!eventDays || eventDays.length === 0 || !startTimeStr) return null;
    
    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    if (isNaN(startHour) || isNaN(startMin)) return null;

    const jlmNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
    const sortedDays = [...eventDays].sort((a,b) => a-b);
    
    for (let i = 0; i <= 7; i++) {
        const d = new Date(jlmNow);
        d.setDate(jlmNow.getDate() + i);
        const dayOfWeek = d.getDay();
        
        if (sortedDays.includes(dayOfWeek)) {
            d.setHours(startHour, startMin, 0, 0);
            
            const cutoffTime = new Date(d);
            cutoffTime.setHours(cutoffTime.getHours() + 4);
            
            if (jlmNow <= cutoffTime) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
    }
    return null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Delete old demo data
        const oldPending = await base44.asServiceRole.entities.PendingSale.filter({ comments: "הזמנה שנוצרה אוטומטית לצורך הדגמה" }, '', 1000);
        const oldTable = await base44.asServiceRole.entities.TableData.filter({ comments: "הזמנה שנוצרה אוטומטית לצורך הדגמה" }, '', 1000);
        
        const oldOrderNumbers = [...oldPending.map(o => o.order_number), ...oldTable.map(o => o.order_number)];
        
        // Delete pending
        for (const o of oldPending) await base44.asServiceRole.entities.PendingSale.delete(o.id);
        // Delete table
        for (const o of oldTable) await base44.asServiceRole.entities.TableData.delete(o.id);
        
        // Delete expenses
        const oldExpenses = await base44.asServiceRole.entities.Expense.filter({ notes: "החזר חלקי אוטומטי לדוגמה" }, '', 1000);
        for (const e of oldExpenses) await base44.asServiceRole.entities.Expense.delete(e.id);
        
        // Delete wristbands
        if (oldOrderNumbers.length > 0) {
            const allWristbands = await base44.asServiceRole.entities.Wristband.list('-created_date', 5000);
            const wristbandsToDelete = allWristbands.filter(w => oldOrderNumbers.includes(w.order_number));
            for (const w of wristbandsToDelete) {
                await base44.asServiceRole.entities.Wristband.delete(w.id);
            }
        }

        // 2. Generate new
        const users = await base44.asServiceRole.entities.User.list();
        const reps = users.map(u => u.full_name).filter(Boolean);
        if (reps.length === 0) reps.push("נציג כללי");

        const attractions = await base44.asServiceRole.entities.Attraction.list();
        if (attractions.length === 0) return Response.json({ error: 'No attractions found to associate' }, { status: 400 });

        const hotels = ["מאלי מאלי", "ניסי ביץ", "אדמס ביץ", "אקווה מרינה", "אוריאנה"];
        const companies = ["ק", "נ", "כ"];
        const genders = ["מעורב", "גברים", "נשים"];

        const today = new Date();
        
        const randomDateInNextWeek = () => {
            const d = new Date(today);
            d.setDate(d.getDate() + Math.floor(Math.random() * 7) + 1);
            return d.toISOString().split('T')[0];
        };

        const generateOrderNumber = () => Math.floor(100000 + Math.random() * 900000).toString();

        const pendingSales = [];
        const tableData = [];
        const wristbands = [];
        const expenses = [];

        const createRecords = (count, isPending) => {
            for (let i=0; i<count; i++) {
                const orderNumber = generateOrderNumber();
                const customers = Math.floor(Math.random() * 5) + 1;
                const departureDate = randomDateInNextWeek();
                const rep = reps[Math.floor(Math.random() * reps.length)];
                
                const selectedAttractions = attractions.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * attractions.length) + 1);
                let totalPrice = 0;
                selectedAttractions.forEach(a => totalPrice += a.price_eur || 0);
                totalPrice *= customers;

                const isCombo = selectedAttractions.length === attractions.length && attractions.length > 0;
                if (isCombo) totalPrice = 550 * customers;

                const sale = {
                    order_number: orderNumber,
                    customer: customers.toString(),
                    departure_date: departureDate,
                    nights: Math.floor(Math.random() * 5) + 3 + "",
                    gender: genders[Math.floor(Math.random() * genders.length)],
                    hotel: hotels[Math.floor(Math.random() * hotels.length)],
                    company: companies[Math.floor(Math.random() * companies.length)],
                    requested_amount: totalPrice.toString(),
                    eur_amount: isPending ? "0" : totalPrice.toString(),
                    shekel_amount: "0",
                    dollar_amount: "0",
                    bit_amount: "0",
                    eur_status: isPending ? "0" : "0",
                    comments: "הזמנה שנוצרה אוטומטית לצורך הדגמה",
                    sales_rep: rep,
                    is_combo: isCombo
                };

                if (isPending) {
                    pendingSales.push(sale);
                } else {
                    tableData.push(sale);

                    if (Math.random() > 0.7) {
                        expenses.push({
                            reason: "החזר חלקי",
                            recipient: orderNumber,
                            amount: Math.floor(Math.random() * 50) + 10,
                            currency: "EUR",
                            expense_date: today.toISOString().split('T')[0],
                            sales_rep: rep,
                            notes: "החזר חלקי אוטומטי לדוגמה"
                        });
                    }
                }

                const eventNames = selectedAttractions.map(a => {
                    const nextDateStr = getNextEventDate(a.event_days, a.start_time);
                    return nextDateStr ? `${a.name} - ${nextDateStr.split('-').reverse().join('/')}` : a.name;
                }).filter(Boolean);

                for (let j=0; j<customers; j++) {
                    wristbands.push({
                        nfc_id: Math.random().toString(36).substring(2, 10).toUpperCase(),
                        order_number: orderNumber,
                        customer_name: `לקוח ${j+1}`,
                        allowed_events: eventNames,
                        status: "active",
                        valid_until: departureDate
                    });
                }
            }
        };

        createRecords(25, true);
        createRecords(25, false);

        const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

        for (const chunk of chunkArray(pendingSales, 10)) await base44.asServiceRole.entities.PendingSale.bulkCreate(chunk);
        for (const chunk of chunkArray(tableData, 10)) await base44.asServiceRole.entities.TableData.bulkCreate(chunk);
        for (const chunk of chunkArray(wristbands, 10)) await base44.asServiceRole.entities.Wristband.bulkCreate(chunk);
        for (const chunk of chunkArray(expenses, 10)) await base44.asServiceRole.entities.Expense.bulkCreate(chunk);

        return Response.json({ 
            success: true, 
            deleted: { orders: oldOrderNumbers.length, expenses: oldExpenses.length },
            created: { pending: pendingSales.length, table: tableData.length, wristbands: wristbands.length, expenses: expenses.length }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});