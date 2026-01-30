import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// מזהה הגיליון שלך מגוגל שיטס
const SPREADSHEET_ID = '1VQ9H-JDzOKuhVJCFWhjuSmGlydkIkZc-gBl1LE_n_eU';

Deno.serve(async (req) => {
    try {
        // יצירת הקליינט מתוך הבקשה כדי לאפשר גישה לקונקטורים
        const base44 = createClientFromRequest(req);

        // שליפת מספר ההזמנה שנשלח מהצד של הלקוח (React)
        const body = await req.json();
        const { orderNumber } = body;

        if (!orderNumber) {
            return Response.json({ error: 'Order number is required' }, { status: 400 });
        }

        // קבלת Access Token לגוגל שיטס באמצעות Service Role (עוקף את הצורך בלוגין של משתמש)
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        // הגדרת טווח הקריאה בגיליון (משורה 3 עד עמודה K)
        const range = 'A3:K1000';
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;

        // ביצוע הקריאה ל-API של גוגל שיטס
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Sheets API error:', errorText);
            return Response.json({ error: 'Failed to fetch Google Sheets data', details: errorText }, { status: 500 });
        }

        const data = await response.json();
        const rows = data.values || [];

        console.log(`Searching for order: ${orderNumber}. Total rows to check: ${rows.length}`);

        /**
         * חיפוש השורה המתאימה:
         * אנו מחפשים בעמודה I (אינדקס 8 בספירה של אפס)
         */
        const matchingRow = rows.find(row => 
            row[8] && String(row[8]).trim() === String(orderNumber).trim()
        );

        if (!matchingRow) {
            console.log(`Order ${orderNumber} not found in sheet.`);
            return Response.json({ error: 'Order number not found' }, { status: 404 });
        }

        console.log(`Found matching row for order ${orderNumber}`);

        /**
         * מיפוי הנתונים מהשורה שנמצאה חזרה לאפליקציה:
         * עמודה H (אינדקס 7) -> לקוחות
         * עמודה C (אינדקס 2) -> לילות
         * עמודה J (אינדקס 9) -> מלון
         * עמודה K (אינדקס 10) -> מגדר
         */
        return Response.json({
            customer: matchingRow[7] || '',
            nights: matchingRow[2] || '',
            hotel: matchingRow[9] || '',
            gender: matchingRow[10] || ''
        });

    } catch (error) {
        console.error('Function error:', error.message);
        return Response.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
});