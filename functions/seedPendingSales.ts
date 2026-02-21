import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REPS = ["David Cohen", "Sarah Levy", "Michael Ben-Ari", "Rachel Weiss"];
const HOTELS = ["Blue Lagoon", "Grand Beach", "City Center", "Mountain View", "Seaside Resort"];
const COMPANIES = ["כ", "נ", "ק"]; 

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Delete existing PendingSale records
        const existing = await base44.asServiceRole.entities.PendingSale.list({ limit: 100 });
        for (const item of existing) {
            await base44.asServiceRole.entities.PendingSale.delete(item.id);
        }

        // 2. Create 10 new records
        const newRecords = [];
        for (let i = 0; i < 10; i++) {
            const pax = Math.floor(Math.random() * 5) + 1;
            const amount = pax * (Math.floor(Math.random() * 200) + 300);
            
            newRecords.push({
                order_number: `${40000 + i}`,
                customer: `${pax}`,
                sales_rep: REPS[Math.floor(Math.random() * REPS.length)],
                requested_amount: amount.toString(),
                eur_amount: "0",
                shekel_amount: "0",
                dollar_amount: "0",
                bit_amount: "0",
                eur_status: "טרם שולם",
                departure_date: new Date(Date.now() + Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                nights: "4",
                gender: Math.random() > 0.5 ? "Male" : "Female",
                hotel: HOTELS[Math.floor(Math.random() * HOTELS.length)],
                company: COMPANIES[Math.floor(Math.random() * COMPANIES.length)],
                comments: "Seed pending sale",
                is_combo: Math.random() > 0.8
            });
        }

        await base44.asServiceRole.entities.PendingSale.bulkCreate(newRecords);

        return Response.json({ success: true, message: "Reset PendingSale with 10 new records" });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});