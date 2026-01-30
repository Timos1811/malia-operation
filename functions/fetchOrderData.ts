import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1VQ9H-JDzOKuhVJCFWhjuSmGlydkIkZc-gBl1LE_n_eU';

Deno.serve(async (req) => {
    try {
        // מוחקים או מנטרלים את הבדיקה הזו:
/*
const base44 = createClientFromRequest(req);
let user = null;
try {
  user = await base44.auth.me();
} catch (e) { ... }

if (!user) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
*/

        const { orderNumber } = await req.json();

        if (!orderNumber) {
            return Response.json({ error: 'Order number is required' }, { status: 400 });
        }

        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        // Fetch all data from the sheet starting at row 3
        const range = 'A3:K1000';
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            return Response.json({ error: 'Failed to fetch Google Sheets data', details: error }, { status: 500 });
        }

        const data = await response.json();
        const rows = data.values || [];

        console.log(`Searching for order: ${orderNumber}`);
        console.log(`Found ${rows.length} rows in sheet`);

        // Find the row with matching order number (column I = index 8)
        // Convert both to strings and trim to handle any formatting differences
        const matchingRow = rows.find(row => 
            row[8] && String(row[8]).trim() === String(orderNumber).trim()
        );

        if (!matchingRow) {
            console.log(`Order ${orderNumber} not found in sheet`);
            return Response.json({ error: 'Order number not found' }, { status: 404 });
        }

        console.log(`Found matching row for order ${orderNumber}`);

        // Extract data from the matching row
        // H=7 (לקוחות), C=2 (לילות), J=9 (מלון), K=10 (מגדר)
        return Response.json({
            customer: matchingRow[7] || '',
            nights: matchingRow[2] || '',
            hotel: matchingRow[9] || '',
            gender: matchingRow[10] || ''
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});