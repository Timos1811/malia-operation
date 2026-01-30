import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1VQ9H-JDzOKuhVJCFWhjuSmGlydkIkZc-gBl1LE_n_eU';
const SHEET_NAME = 'קשרי תעופה';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderNumber } = await req.json();

        if (!orderNumber) {
            return Response.json({ error: 'Order number is required' }, { status: 400 });
        }

        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        // Fetch all data from the sheet starting at row 3 (first sheet)
        const range = `A3:K1000`;
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

        // Find the row with matching order number (column I = index 8)
        const matchingRow = rows.find(row => row[8] === orderNumber);

        if (!matchingRow) {
            return Response.json({ error: 'Order number not found' }, { status: 404 });
        }

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