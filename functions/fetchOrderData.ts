import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// מזהה הגיליון שלך מגוגל שיטס
const SPREADSHEET_ID = '1VQ9H-JDzOKuhVJCFWhjuSmGlydkIkZc-gBl1LE_n_eU';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { orderNumber } = body;

        if (!orderNumber) {
            return Response.json({ error: 'Order number is required' }, { status: 400, headers: corsHeaders });
        }

        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
        const range = 'A3:K1000';
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Sheets API error:', errorText);
            return Response.json({ error: 'Failed to fetch Google Sheets data', details: errorText }, { status: 500, headers: corsHeaders });
        }

        const data = await response.json();
        const rows = data.values || [];
        
        const targetOrder = String(orderNumber).trim();
        console.log(`Searching for order: ${targetOrder}. Total rows: ${rows.length}`);

        const matchingRow = rows.find(row => 
            row[8] && String(row[8]).trim() === targetOrder
        );

        if (!matchingRow) {
            console.log(`Order ${targetOrder} not found.`);
            return Response.json({ error: 'Order number not found' }, { status: 404, headers: corsHeaders });
        }

        console.log(`Found order ${targetOrder}`);

        return Response.json({
            customer: matchingRow[7] || '',
            nights: matchingRow[2] || '',
            hotel: matchingRow[9] || '',
            gender: matchingRow[10] || '',
            checkInDate: matchingRow[0] || ''
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Function error:', error.message);
        return Response.json({ error: 'Internal Server Error', details: error.message }, { status: 500, headers: corsHeaders });
    }
});