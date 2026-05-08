import { createClientFromRequest } from 'npm:@base44/sdk@0.8.27';

function getNextEventDate(eventDays, startTimeStr, referenceDate) {
    if (!eventDays || eventDays.length === 0 || !startTimeStr) return null;
    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    if (isNaN(startHour) || isNaN(startMin)) return null;

    const sortedDays = [...eventDays].sort((a,b) => a-b);
    for (let i = 0; i <= 7; i++) {
        const d = new Date(referenceDate);
        d.setDate(referenceDate.getDate() + i);
        const dayOfWeek = d.getDay();
        if (sortedDays.includes(dayOfWeek)) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }
    return null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const users = await base44.asServiceRole.entities.User.list();
        let reps = users.map(u => u.full_name).filter(Boolean);
        if (reps.length === 0) reps.push("נציג כללי");

        const attractions = await base44.asServiceRole.entities.Attraction.list();
        if (attractions.length === 0) return Response.json({ error: 'No attractions found to associate' }, { status: 400 });

        const hotels = ["מאלי מאלי", "ניסי ביץ", "אדמס ביץ", "אקווה מרינה", "אוריאנה", "פנורמה", "קריסטל", "סי אנד סאן"];
        const companies = ["ק", "נ", "כ"];
        const genders = ["מעורב", "גברים", "נשים"];

        const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
        
        const tableData = [];
        const wristbands = [];
        const expenses = [];
        const tasks = [];
        const scans = [];

        // 6 weeks, 20 records each
        for (let week = 0; week < 6; week++) {
            const weekOffset = (5 - week) * 7; // weeks ago
            for (let r = 0; r < 20; r++) {
                const dayOffset = Math.floor(Math.random() * 7);
                const orderDate = new Date(today);
                orderDate.setDate(today.getDate() - weekOffset - dayOffset);
                
                const departureDate = new Date(orderDate);
                departureDate.setDate(orderDate.getDate() + Math.floor(Math.random() * 5) + 3);

                const orderNumber = Math.floor(100000 + Math.random() * 900000).toString();
                const customers = Math.floor(Math.random() * 6) + 1;
                const rep = reps[Math.floor(Math.random() * reps.length)];
                
                const selectedAttractions = attractions.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * attractions.length) + 1);
                let totalPrice = 0;
                selectedAttractions.forEach(a => totalPrice += a.price_eur || 0);
                totalPrice *= customers;

                const isCombo = selectedAttractions.length === attractions.length && attractions.length > 0;
                if (isCombo) totalPrice = 550 * customers;

                tableData.push({
                    order_number: orderNumber,
                    customer: customers.toString(),
                    departure_date: departureDate.toISOString().split('T')[0],
                    nights: Math.floor(Math.random() * 5) + 3 + "",
                    gender: genders[Math.floor(Math.random() * genders.length)],
                    hotel: hotels[Math.floor(Math.random() * hotels.length)],
                    company: companies[Math.floor(Math.random() * companies.length)],
                    requested_amount: totalPrice.toString(),
                    eur_amount: totalPrice.toString(),
                    shekel_amount: "0",
                    dollar_amount: "0",
                    bit_amount: "0",
                    eur_status: "0",
                    comments: "הזמנה שנוצרה אוטומטית לצורך הדגמה (אמצע עונה)",
                    sales_rep: rep,
                    is_combo: isCombo,
                    created_date: orderDate.toISOString()
                });

                // Expenses
                if (Math.random() > 0.8) {
                    expenses.push({
                        reason: "החזר חלקי",
                        recipient: orderNumber,
                        amount: Math.floor(Math.random() * 50) + 10,
                        currency: "EUR",
                        expense_date: orderDate.toISOString().split('T')[0],
                        sales_rep: rep,
                        notes: "החזר חלקי בגין אטרקציה שבוטלה"
                    });
                }
                if (Math.random() > 0.9) {
                    expenses.push({
                        reason: "אשל",
                        recipient: rep,
                        amount: Math.floor(Math.random() * 100) + 50,
                        currency: "EUR",
                        expense_date: orderDate.toISOString().split('T')[0],
                        sales_rep: rep,
                        notes: "ארוחות ומחיה"
                    });
                }
                if (Math.random() > 0.95) {
                    expenses.push({
                        reason: "רכב",
                        recipient: "סוכנות רכב",
                        amount: Math.floor(Math.random() * 150) + 50,
                        currency: "EUR",
                        expense_date: orderDate.toISOString().split('T')[0],
                        sales_rep: rep,
                        notes: "השכרת רכב/דלק"
                    });
                }

                // Tasks
                if (Math.random() > 0.85) {
                    tasks.push({
                        title: `טיפול מול מלון להזמנה ${orderNumber}`,
                        description: "מעקב וטיפול מול הלקוח במלון",
                        status: Math.random() > 0.5 ? "done" : "todo",
                        due_date: departureDate.toISOString().split('T')[0],
                        task_type: "general",
                        order_number: orderNumber,
                        sales_rep: rep
                    });
                }

                // Wristbands
                const eventNames = selectedAttractions.map(a => {
                    const nextDateStr = getNextEventDate(a.event_days, a.start_time, orderDate);
                    return nextDateStr ? `${a.name} - ${nextDateStr.split('-').reverse().join('/')}` : a.name;
                }).filter(Boolean);

                for (let j=0; j<customers; j++) {
                    const nfcId = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const wbStatus = departureDate < today ? "inactive" : "active";
                    
                    wristbands.push({
                        nfc_id: nfcId,
                        order_number: orderNumber,
                        customer_name: `אורח ${j+1}`,
                        allowed_events: eventNames,
                        status: wbStatus,
                        valid_until: departureDate.toISOString().split('T')[0]
                    });

                    // Scans for events that already passed
                    eventNames.forEach(ev => {
                        const dateStr = ev.split(' - ')[1]; // DD/MM/YYYY
                        if (dateStr) {
                            const [d, m, y] = dateStr.split('/');
                            const evDate = new Date(`${y}-${m}-${d}`);
                            if (evDate < today && Math.random() > 0.15) { // 85% attendance rate
                                scans.push({
                                    nfc_id: nfcId,
                                    event_name: ev,
                                    scan_time: evDate.toISOString(),
                                    status: "success",
                                    message: "נכנס בהצלחה",
                                    scanned_by: rep,
                                    customer_name: `אורח ${j+1}`,
                                    order_number: orderNumber
                                });
                            }
                        }
                    });
                }
            }
        }

        const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const delay = ms => new Promise(res => setTimeout(res, ms));

        for (const chunk of chunkArray(tableData, 50)) { await base44.asServiceRole.entities.TableData.bulkCreate(chunk); await delay(1000); }
        for (const chunk of chunkArray(wristbands, 50)) { await base44.asServiceRole.entities.Wristband.bulkCreate(chunk); await delay(1000); }
        for (const chunk of chunkArray(expenses, 50)) { await base44.asServiceRole.entities.Expense.bulkCreate(chunk); await delay(1000); }
        for (const chunk of chunkArray(tasks, 50)) { await base44.asServiceRole.entities.Task.bulkCreate(chunk); await delay(1000); }
        for (const chunk of chunkArray(scans, 50)) { await base44.asServiceRole.entities.WristbandScanLog.bulkCreate(chunk); await delay(1000); }

        return Response.json({ 
            success: true, 
            created: { table: tableData.length, wristbands: wristbands.length, expenses: expenses.length, tasks: tasks.length, scans: scans.length }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});