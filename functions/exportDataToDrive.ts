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
            rtl: true
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

            const cleanData = data.map(item => {
                const { id, created_by, updated_date, ...rest } = item;
                return rest;
            });

            const keys = Object.keys(cleanData[0]);
            sheet.columns = keys.map(key => ({
                header: key,
                key: key,
                width: 20,
                style: { alignment: { vertical: 'middle', horizontal: 'right' }, font: { name: 'Calibri', size: 11 } }
            }));

            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Calibri' };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate-900
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 30;

            sheet.addRows(cleanData);

            // Simple borders for data sheets
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

        // --- Stats Logic ---
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

        // --- Build "Bank Summary" Sheet (Styled like Website) ---
        const summarySheet = workbook.addWorksheet("סיכום בנק", {
            views: [{ rightToLeft: true, showGridLines: false }]
        });

        // Column Setup (simulating grid)
        summarySheet.columns = [
            { width: 3 },  // Spacer
            { width: 25 }, // Col B
            { width: 20 }, // Col C
            { width: 20 }, // Col D
            { width: 20 }, // Col E
            { width: 3 },  // Spacer
            { width: 25 }, // Col G
            { width: 20 }, // Col H
            { width: 3 }   // Spacer
        ];

        let currentRow = 2;

        // Title
        summarySheet.mergeCells(`B${currentRow}:E${currentRow}`);
        const titleCell = summarySheet.getCell(`B${currentRow}`);
        titleCell.value = "טבלת בנק - סיכום מנהלים";
        titleCell.font = { bold: true, size: 24, name: 'Calibri', color: { argb: 'FF1E293B' } };
        titleCell.alignment = { horizontal: 'right' };
        currentRow += 2;

        // --- 1. Top Cards (Stats) ---
        // Simulating 3 cards horizontally: B-C, D-E, G-H
        
        const drawCard = (startCol, row, title, value, subtext) => {
            const endCol = String.fromCharCode(startCol.charCodeAt(0) + 1); // Next char
            
            // Card Box
            const range = `${startCol}${row}:${endCol}${row + 2}`;
            
            // Styles
            summarySheet.getCell(`${startCol}${row}`).value = title;
            summarySheet.getCell(`${startCol}${row}`).font = { bold: true, size: 11, color: { argb: 'FF64748B' }, name: 'Calibri' };
            summarySheet.getCell(`${startCol}${row}`).alignment = { vertical: 'bottom', horizontal: 'right' };
            
            summarySheet.getCell(`${startCol}${row+1}`).value = value;
            summarySheet.getCell(`${startCol}${row+1}`).font = { bold: true, size: 22, color: { argb: 'FF0F172A' }, name: 'Calibri' };
            
            summarySheet.getCell(`${startCol}${row+2}`).value = subtext;
            summarySheet.getCell(`${startCol}${row+2}`).font = { size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
            summarySheet.getCell(`${startCol}${row+2}`).alignment = { vertical: 'top', horizontal: 'right' };

            // Border for the "Card" effect
            const topUserData = summarySheet.getCell(`${startCol}${row}`);
            topUserData.border = { top: {style:'medium', color: {argb:'FFE2E8F0'}}, left: {style:'medium', color: {argb:'FFE2E8F0'}}, right: {style:'medium', color: {argb:'FFE2E8F0'}} };
            
            const middleUserData = summarySheet.getCell(`${startCol}${row+1}`);
            middleUserData.border = { left: {style:'medium', color: {argb:'FFE2E8F0'}}, right: {style:'medium', color: {argb:'FFE2E8F0'}} };

            const bottomUserData = summarySheet.getCell(`${startCol}${row+2}`);
            bottomUserData.border = { bottom: {style:'medium', color: {argb:'FFE2E8F0'}}, left: {style:'medium', color: {argb:'FFE2E8F0'}}, right: {style:'medium', color: {argb:'FFE2E8F0'}} };
        };

        drawCard('B', currentRow, "סה\"כ לקוחות", totalCustomers, "לקוחות בכל הקבוצות");
        drawCard('D', currentRow, "סה\"כ קבוצות", income.length, "הזמנות במערכת");
        drawCard('G', currentRow, "ממוצע ללקוח", `€${Math.round(avgRevenuePerCustomer)}`, "הכנסה ממוצעת משוערת");
        
        currentRow += 4; // Space after cards

        // --- 2. Main Table (Styled like shadcn table) ---
        
        // Table Header
        const headers = ["תיאור", "יורו (EUR)", "שקל (ILS)", "דולר (USD)", "ביט (BIT)"]; // Transposed/Pivoted logic for better print view? 
        // Actually site uses Rows=Currency, Cols=Income/Expense. Let's stick to site layout: Rows=Total Income/Expense, Cols=Currencies.
        
        // Site Layout:
        // Cols: Description | EUR | ILS | USD
        // Rows: Income, Expense, Balance
        // Footer: Bit Summary
        
        const tableStartRow = currentRow;
        const colMap = { desc: 'B', eur: 'C', ils: 'D', usd: 'E' };

        // Headers
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "תיאור";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = "יורו (EUR)";
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = "שקל (ILS)";
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = "דולר (USD)";

        ['B','C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.font = { bold: true, color: { argb: 'FF475569' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        summarySheet.getRow(currentRow).height = 25;
        currentRow++;

        // Row 1: Income
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "סה\"כ הכנסות";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = totals.eur.income;
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = totals.shekel.income;
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = totals.usd.income;

        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FF16A34A' }, bold: true }; // Green
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        summarySheet.getRow(currentRow).height = 25;
        currentRow++;

        // Row 2: Expenses
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "סה\"כ הוצאות";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = totals.eur.expenses;
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = totals.shekel.expenses;
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = totals.usd.expenses;

        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        summarySheet.getRow(currentRow).height = 25;
        currentRow++;

        // Row 3: Balance (Bold, Light Background)
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "יתרה בקופה";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = totals.eur.income - totals.eur.expenses;
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = totals.shekel.income - totals.shekel.expenses;
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = totals.usd.income - totals.usd.expenses;

        ['B','C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slate-50
            cell.font = { bold: true, size: 12 };
            cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (col !== 'B') cell.numFmt = '#,##0';
        });
        summarySheet.getRow(currentRow).height = 35;
        currentRow++;

        // Row 4: Bit Footer (Blue Background)
        summarySheet.getCell(`B${currentRow}`).value = "סיכום ביט";
        summarySheet.mergeCells(`C${currentRow}:E${currentRow}`); // Merge rest
        
        const bitSummaryText = `קשרי תעופה: ₪${totals.bitKishrei.toLocaleString()}  |  נטו פאן: ₪${totals.bitNeto.toLocaleString()}  |  סה"כ: ₪${totals.bit.income.toLocaleString()}`;
        summarySheet.getCell(`C${currentRow}`).value = bitSummaryText;

        ['B', 'C'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; // Blue-50
            cell.font = { color: { argb: 'FF1E40AF' }, bold: true }; // Blue-800
            cell.border = { top: { style: 'thin', color: { argb: 'FFBFDBFE' } } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        summarySheet.getRow(currentRow).height = 35;
        
        currentRow += 3;

        // --- 3. Side Lists (Reps & Expenses) ---
        
        const listStartRow = currentRow;
        
        // Sales Reps (Left side B-C)
        summarySheet.mergeCells(`B${listStartRow}:C${listStartRow}`);
        const repHeader = summarySheet.getCell(`B${listStartRow}`);
        repHeader.value = "🏆 מכירות לפי נציג (יורו)";
        repHeader.font = { bold: true, color: { argb: 'FF0F172A' }, size: 12 };
        repHeader.border = { bottom: { style: 'thick', color: { argb: 'FFCBD5E1' } } };
        
        let repRow = listStartRow + 1;
        Object.entries(salesRepStats)
            .sort(([,a], [,b]) => b - a)
            .forEach(([name, val]) => {
                summarySheet.getCell(`B${repRow}`).value = name;
                summarySheet.getCell(`C${repRow}`).value = val;
                summarySheet.getCell(`C${repRow}`).numFmt = '#,##0 €';
                
                // Alternating row colors
                if ((repRow - listStartRow) % 2 === 0) {
                     summarySheet.getCell(`B${repRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                     summarySheet.getCell(`C${repRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
                repRow++;
            });


        // Expenses (Right side D-E) - actually G-H to separate visually
        summarySheet.mergeCells(`G${listStartRow}:H${listStartRow}`);
        const expHeader = summarySheet.getCell(`G${listStartRow}`);
        expHeader.value = "📉 הוצאות לפי קטגוריה (יורו)";
        expHeader.font = { bold: true, color: { argb: 'FF0F172A' }, size: 12 };
        expHeader.border = { bottom: { style: 'thick', color: { argb: 'FFCBD5E1' } } };

        let expRow = listStartRow + 1;
        Object.entries(categoryStats)
            .sort(([,a], [,b]) => b - a)
            .forEach(([name, val]) => {
                summarySheet.getCell(`G${expRow}`).value = name;
                summarySheet.getCell(`H${expRow}`).value = val;
                summarySheet.getCell(`H${expRow}`).numFmt = '#,##0 €';
                
                if ((expRow - listStartRow) % 2 === 0) {
                     summarySheet.getCell(`G${expRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                     summarySheet.getCell(`H${expRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
                expRow++;
            });

        // 3. Upload Logic
        const buffer = await workbook.xlsx.writeBuffer();
        
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        if (!accessToken) return Response.json({ error: "No Google Drive token" }, { status: 400 });

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