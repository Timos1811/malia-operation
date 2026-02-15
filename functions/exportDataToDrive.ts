import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Fetch Data (Limit 1000 most recent records per entity)
        const [income, expenses, pendingSales, tasks, caspars, moneyLocations] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 1000),
            base44.asServiceRole.entities.Expense.list('-created_date', 1000),
            base44.asServiceRole.entities.PendingSale.list('-created_date', 1000),
            base44.asServiceRole.entities.Task.list('-created_date', 1000),
            base44.asServiceRole.entities.CasparFilling.list('-created_date', 1000),
            base44.asServiceRole.entities.MoneyLocation.list('-created_date', 1000)
        ]);

        // 2. Create Workbook
        const wb = XLSX.utils.book_new();

        const addSheet = (data, name) => {
            if (data && data.length > 0) {
                const cleanData = data.map(item => {
                    const { id, created_by, updated_date, ...rest } = item;
                    return rest;
                });
                const ws = XLSX.utils.json_to_sheet(cleanData);
                XLSX.utils.book_append_sheet(wb, ws, name);
            } else {
                const ws = XLSX.utils.json_to_sheet([{info: "אין נתונים"}]);
                XLSX.utils.book_append_sheet(wb, ws, name);
            }
        };

        addSheet(income, "הכנסות");
        addSheet(expenses, "הוצאות");
        addSheet(pendingSales, "מכירות בהמתנה");
        addSheet(tasks, "משימות");
        addSheet(caspars, "כספרים");
        addSheet(moneyLocations, "מיקומי כסף");

        // --- Calculate Bank Table Summary (Replicating BankTable.js logic) ---
        
        const totals = {
            shekel: { income: 0, expenses: 0 },
            bit: { income: 0, expenses: 0 }, 
            usd: { income: 0, expenses: 0 },
            eur: { income: 0, expenses: 0 },
            bitKishrei: 0,
            bitNeto: 0
        };

        const categoryStats = {};
        const salesRepStats = {};
        let totalCustomers = 0;

        // Calculate Income
        income.forEach(row => {
            const shekel = parseFloat(row.shekel_amount) || 0;
            const bit = parseFloat(row.bit_amount) || 0;
            const usd = parseFloat(row.dollar_amount) || 0;
            const eur = parseFloat(row.eur_amount) || 0;

            totals.shekel.income += shekel;
            totals.bit.income += bit;
            totals.usd.income += usd;
            totals.eur.income += eur;
            
            if (row.company === 'נטו פאן') totals.bitNeto += bit;
            else totals.bitKishrei += bit;

            // Count customers
            const customerStr = String(row.customer || '');
            const numberMatch = customerStr.match(/\d+/);
            const customerCount = numberMatch ? parseInt(numberMatch[0]) : 0;
            totalCustomers += customerCount;

            // Sales Rep Stats (Normalized to EUR)
            const repName = row.sales_rep || 'ללא נציג';
            const totalValueInEur = eur + (shekel * 0.26) + (bit * 0.26) + (usd * 0.95);
            salesRepStats[repName] = (salesRepStats[repName] || 0) + totalValueInEur;
        });

        // Calculate Expenses
        expenses.forEach(exp => {
            const amount = parseFloat(exp.amount) || 0;
            if (exp.currency === 'ILS') totals.shekel.expenses += amount;
            else if (exp.currency === 'USD') totals.usd.expenses += amount;
            else if (exp.currency === 'EUR') totals.eur.expenses += amount;

            // Category breakdown (Normalized to EUR)
            let amountInEur = amount;
            if (exp.currency === 'ILS') amountInEur = amount * 0.26;
            else if (exp.currency === 'USD') amountInEur = amount * 0.95;
            
            if (exp.reason) {
                categoryStats[exp.reason] = (categoryStats[exp.reason] || 0) + amountInEur;
            }
        });

        // Global Stats
        const totalIncomeEurCombined = totals.eur.income + (totals.shekel.income * 0.26) + (totals.bit.income * 0.26) + (totals.usd.income * 0.95);
        const avgRevenuePerCustomer = totalCustomers > 0 ? totalIncomeEurCombined / totalCustomers : 0;

        // --- Build "Bank" Sheet ---
        const wsBank = XLSX.utils.aoa_to_sheet([["דוח בנק מקיף"]]); // Start with title

        let currentRow = 2; // 0-indexed in code logic, but let's track row number for placement

        // 1. General Stats
        XLSX.utils.sheet_add_json(wsBank, [
            { "מדד": "סה\"כ לקוחות", "ערך": totalCustomers },
            { "מדד": "סה\"כ קבוצות/מכירות", "ערך": income.length },
            { "מדד": "ממוצע הכנסה ללקוח (יורו)", "ערך": Math.round(avgRevenuePerCustomer) }
        ], { origin: `A${currentRow}` });
        currentRow += 5;

        // 2. Main Currency Table
        const currencyTable = [
            { "מטבע": "יורו (EUR)", "הכנסות": totals.eur.income, "הוצאות": totals.eur.expenses, "יתרה": totals.eur.income - totals.eur.expenses },
            { "מטבע": "שקל (ILS)", "הכנסות": totals.shekel.income, "הוצאות": totals.shekel.expenses, "יתרה": totals.shekel.income - totals.shekel.expenses },
            { "מטבע": "דולר (USD)", "הכנסות": totals.usd.income, "הוצאות": totals.usd.expenses, "יתרה": totals.usd.income - totals.usd.expenses },
            { "מטבע": "ביט (BIT)", "הכנסות": totals.bit.income, "הוצאות": 0, "יתרה": totals.bit.income } // Bit expenses not tracked separately in totals object structure but usually 0
        ];
        XLSX.utils.sheet_add_json(wsBank, currencyTable, { origin: `A${currentRow}` });
        currentRow += 6;

        // 3. Bit Breakdown
        XLSX.utils.sheet_add_json(wsBank, [
            { "פירוט ביט": "קשרי תעופה", "סכום": totals.bitKishrei },
            { "פירוט ביט": "נטו פאן", "סכום": totals.bitNeto },
            { "פירוט ביט": "סה\"כ ביט", "סכום": totals.bit.income }
        ], { origin: `A${currentRow}` });
        currentRow += 5;

        // 4. Money Locations
        const locationsTable = moneyLocations.map(loc => ({
            "שם המיקום": loc.name,
            "סכום": loc.amount,
            "מטבע": loc.currency
        }));
        if (locationsTable.length > 0) {
             XLSX.utils.sheet_add_json(wsBank, locationsTable, { origin: `A${currentRow}` });
             currentRow += locationsTable.length + 2;
        }

        XLSX.utils.book_append_sheet(wb, wsBank, "סיכום בנק");

        // 5. Sales by Rep (New Sheet)
        const salesRepData = Object.entries(salesRepStats)
            .map(([name, value]) => ({ "נציג": name, "סה\"כ מכירות (יורו)": Math.round(value) }))
            .sort((a, b) => b["סה\"כ מכירות (יורו)"] - a["סה\"כ מכירות (יורו)"]);
        
        const wsRep = XLSX.utils.json_to_sheet(salesRepData);
        XLSX.utils.book_append_sheet(wb, wsRep, "מכירות לפי נציג");

        // 6. Expenses by Category (New Sheet)
        const expensesCatData = Object.entries(categoryStats)
            .map(([name, value]) => ({ "קטגוריית הוצאה": name, "סה\"כ (יורו)": Math.round(value) }))
            .sort((a, b) => b["סה\"כ (יורו)"] - a["סה\"כ (יורו)"]);

        const wsExpCat = XLSX.utils.json_to_sheet(expensesCatData);
        XLSX.utils.book_append_sheet(wb, wsExpCat, "התפלגות הוצאות");

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        // 3. Upload to Google Drive
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        
        if (!accessToken) {
            return Response.json({ error: "No Google Drive access token found" }, { status: 400 });
        }

        // --- Folder Handling ---
        const folderName = "אקסל";
        let folderId = null;

        // Search for existing folder
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`, 
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.files && searchData.files.length > 0) {
                folderId = searchData.files[0].id;
            }
        }

        // Create folder if not found
        if (!folderId) {
            const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder'
                })
            });
            
            if (createFolderRes.ok) {
                const folderData = await createFolderRes.json();
                folderId = folderData.id;
            } else {
                console.error("Failed to create folder", await createFolderRes.text());
                // Fallback to root if folder creation fails
            }
        }

        // --- File Upload ---
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Backup_Data_${dateStr}.xlsx`;

        const metadata = {
            name: fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            parents: folderId ? [folderId] : [] // Upload to folder if exists
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData
        });

        if (!uploadRes.ok) {
            throw new Error(`Drive Upload Failed: ${await uploadRes.text()}`);
        }

        const driveData = await uploadRes.json();
        return Response.json({ success: true, fileId: driveData.id, fileName, folderId });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});