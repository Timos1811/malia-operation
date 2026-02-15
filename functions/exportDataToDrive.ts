import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import ExcelJS from 'npm:exceljs@4.4.0';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Fetch Data
        const [income, expenses, pendingSales, tasks, caspars, moneyLocations] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 1000),
            base44.asServiceRole.entities.Expense.list('-created_date', 1000),
            base44.asServiceRole.entities.PendingSale.list('-created_date', 1000),
            base44.asServiceRole.entities.Task.list('-created_date', 1000),
            base44.asServiceRole.entities.CasparFilling.list('-created_date', 1000),
            base44.asServiceRole.entities.MoneyLocation.list('-created_date', 1000)
        ]);

        // 2. Create Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Base44 System';
        workbook.created = new Date();
        workbook.views = [{
            x: 0, y: 0, width: 10000, height: 20000,
            firstSheet: 0, activeTab: 0, visibility: 'visible',
            rtl: true // Global RTL preference
        }];

        // --- Helper: Add Styled Data Sheet ---
        const addDataSheet = (data, sheetName) => {
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ rightToLeft: true, showGridLines: true }]
            });

            if (!data || data.length === 0) {
                sheet.addRow(["אין נתונים"]);
                return;
            }

            // Clean data (remove system fields)
            const cleanData = data.map(item => {
                const { id, created_by, updated_date, ...rest } = item;
                return rest;
            });

            // Set Columns based on keys
            const keys = Object.keys(cleanData[0]);
            sheet.columns = keys.map(key => ({
                header: key,
                key: key,
                width: 20,
                style: { alignment: { vertical: 'middle', horizontal: 'right' } }
            }));

            // Style Header Row
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate-900
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 30;

            // Add Data
            sheet.addRows(cleanData);

            // Add Borders
            sheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                    };
                });
            });
        };

        addDataSheet(income, "הכנסות");
        addDataSheet(expenses, "הוצאות");
        addDataSheet(pendingSales, "מכירות בהמתנה");
        addDataSheet(tasks, "משימות");
        addDataSheet(caspars, "כספרים");
        addDataSheet(moneyLocations, "מיקומי כסף");

        // --- Calculate Summary Stats ---
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

        // Process Income
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

            const customerStr = String(row.customer || '');
            const numberMatch = customerStr.match(/\d+/);
            totalCustomers += numberMatch ? parseInt(numberMatch[0]) : 0;

            const repName = row.sales_rep || 'ללא נציג';
            const totalValueInEur = eur + (shekel * 0.26) + (bit * 0.26) + (usd * 0.95);
            salesRepStats[repName] = (salesRepStats[repName] || 0) + totalValueInEur;
        });

        // Process Expenses
        expenses.forEach(exp => {
            const amount = parseFloat(exp.amount) || 0;
            if (exp.currency === 'ILS') totals.shekel.expenses += amount;
            else if (exp.currency === 'USD') totals.usd.expenses += amount;
            else if (exp.currency === 'EUR') totals.eur.expenses += amount;

            let amountInEur = amount;
            if (exp.currency === 'ILS') amountInEur = amount * 0.26;
            else if (exp.currency === 'USD') amountInEur = amount * 0.95;
            
            if (exp.reason) categoryStats[exp.reason] = (categoryStats[exp.reason] || 0) + amountInEur;
        });

        const totalIncomeEurCombined = totals.eur.income + (totals.shekel.income * 0.26) + (totals.bit.income * 0.26) + (totals.usd.income * 0.95);
        const avgRevenuePerCustomer = totalCustomers > 0 ? totalIncomeEurCombined / totalCustomers : 0;

        // --- Build Styled "Bank Summary" Sheet ---
        const summarySheet = workbook.addWorksheet("סיכום בנק", {
            views: [{ rightToLeft: true, showGridLines: false }]
        });

        // Title
        summarySheet.mergeCells('A1:E1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = "דוח בנק מקיף";
        titleCell.font = { bold: true, size: 20, color: { argb: 'FF1E293B' } };
        titleCell.alignment = { horizontal: 'center' };

        // --- 1. General Stats Table ---
        let currentRow = 3;
        const addSectionTitle = (title, row) => {
            summarySheet.mergeCells(`A${row}:C${row}`);
            const cell = summarySheet.getCell(`A${row}`);
            cell.value = title;
            cell.font = { bold: true, size: 14, color: { argb: 'FF334155' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
        };

        addSectionTitle("מדדים כלליים", currentRow);
        currentRow++;

        const generalStatsData = [
            ["סה\"כ לקוחות", totalCustomers],
            ["סה\"כ מכירות", income.length],
            ["הכנסה ממוצעת ללקוח (€)", Math.round(avgRevenuePerCustomer)]
        ];

        generalStatsData.forEach(([label, value]) => {
            const row = summarySheet.getRow(currentRow);
            row.getCell(1).value = label;
            row.getCell(2).value = value;
            row.getCell(1).font = { bold: true };
            currentRow++;
        });
        currentRow += 2;

        // --- 2. Main Currency Table ---
        addSectionTitle("סיכום לפי מטבעות", currentRow);
        currentRow++;

        // Headers
        const currencyHeaders = ["מטבע", "הכנסות", "הוצאות", "יתרה"];
        const headerRow = summarySheet.getRow(currentRow);
        currencyHeaders.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
            cell.alignment = { horizontal: 'center' };
        });
        currentRow++;

        const currencyData = [
            ["יורו (EUR)", totals.eur.income, totals.eur.expenses],
            ["שקל (ILS)", totals.shekel.income, totals.shekel.expenses],
            ["דולר (USD)", totals.usd.income, totals.usd.expenses],
            ["ביט (BIT)", totals.bit.income, 0]
        ];

        currencyData.forEach(([currency, inc, exp]) => {
            const balance = inc - exp;
            const row = summarySheet.getRow(currentRow);
            
            row.getCell(1).value = currency;
            
            const incCell = row.getCell(2);
            incCell.value = inc;
            incCell.numFmt = '#,##0';
            incCell.font = { color: { argb: 'FF16A34A' } }; // Green

            const expCell = row.getCell(3);
            expCell.value = exp;
            expCell.numFmt = '#,##0';
            expCell.font = { color: { argb: 'FFDC2626' } }; // Red

            const balCell = row.getCell(4);
            balCell.value = balance;
            balCell.numFmt = '#,##0';
            balCell.font = { bold: true, color: { argb: balance >= 0 ? 'FF000000' : 'FFDC2626' } };

            currentRow++;
        });
        currentRow += 2;

        // --- 3. Additional Tables (Side by Side) ---
        const startRow = currentRow;
        
        // Bit Table (Left)
        addSectionTitle("פירוט ביט", startRow);
        let bitRow = startRow + 1;
        
        [["קשרי תעופה", totals.bitKishrei], ["נטו פאן", totals.bitNeto]].forEach(([label, val]) => {
            summarySheet.getCell(`A${bitRow}`).value = label;
            summarySheet.getCell(`B${bitRow}`).value = val;
            summarySheet.getCell(`B${bitRow}`).numFmt = '#,##0';
            bitRow++;
        });

        // Sales Reps (Right - Column E)
        const repStartRow = startRow;
        summarySheet.mergeCells(`E${repStartRow}:F${repStartRow}`);
        const repTitle = summarySheet.getCell(`E${repStartRow}`);
        repTitle.value = "מכירות לפי נציג (יורו)";
        repTitle.font = { bold: true, color: { argb: 'FF334155' } };
        repTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        
        let repRow = repStartRow + 1;
        // Headers
        summarySheet.getCell(`E${repRow}`).value = "נציג";
        summarySheet.getCell(`F${repRow}`).value = "סה\"כ";
        summarySheet.getRow(repRow).getCell(5).font = { bold: true };
        summarySheet.getRow(repRow).getCell(6).font = { bold: true };
        repRow++;

        Object.entries(salesRepStats)
            .sort(([,a], [,b]) => b - a)
            .forEach(([name, val]) => {
                summarySheet.getCell(`E${repRow}`).value = name;
                summarySheet.getCell(`F${repRow}`).value = Math.round(val);
                summarySheet.getCell(`F${repRow}`).numFmt = '#,##0 €';
                repRow++;
            });

        // Expenses (Far Right - Column H)
        const expStartRow = startRow;
        summarySheet.mergeCells(`H${expStartRow}:I${expStartRow}`);
        const expTitle = summarySheet.getCell(`H${expStartRow}`);
        expTitle.value = "הוצאות לפי קטגוריה (יורו)";
        expTitle.font = { bold: true, color: { argb: 'FF334155' } };
        expTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        let expRow = expStartRow + 1;
        summarySheet.getCell(`H${expRow}`).value = "קטגוריה";
        summarySheet.getCell(`I${expRow}`).value = "סה\"כ";
        summarySheet.getRow(expRow).getCell(8).font = { bold: true };
        summarySheet.getRow(expRow).getCell(9).font = { bold: true };
        expRow++;

        Object.entries(categoryStats)
            .sort(([,a], [,b]) => b - a)
            .forEach(([name, val]) => {
                summarySheet.getCell(`H${expRow}`).value = name;
                summarySheet.getCell(`I${expRow}`).value = Math.round(val);
                summarySheet.getCell(`I${expRow}`).numFmt = '#,##0 €';
                expRow++;
            });

        // Adjust Column Widths
        summarySheet.columns = [
            { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, // A-D
            { width: 20 }, { width: 15 }, // E-F
            { width: 5 }, // G (Spacer)
            { width: 25 }, { width: 15 } // H-I
        ];

        // 3. Upload to Google Drive
        const buffer = await workbook.xlsx.writeBuffer();
        
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        if (!accessToken) return Response.json({ error: "No Google Drive token" }, { status: 400 });

        // ... Folder and Upload Logic ...
        const folderName = "אקסל";
        let folderId = null;

        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`, 
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.files?.length > 0) folderId = searchData.files[0].id;
        }

        if (!folderId) {
            const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' })
            });
            if (createRes.ok) folderId = (await createRes.json()).id;
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Backup_Data_${dateStr}.xlsx`;
        
        const metadata = {
            name: fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            parents: folderId ? [folderId] : []
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData
        });

        if (!uploadRes.ok) throw new Error(await uploadRes.text());
        const driveData = await uploadRes.json();
        
        return Response.json({ success: true, fileId: driveData.id });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});