import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import ExcelJS from 'npm:exceljs@4.4.0';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Fetch Data
        const [income, expenses, pendingSales, tasks, caspars, moneyLocations] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 1000),
            base44.asServiceRole.entities.Expense.list('-expense_date', 1000), 
            base44.asServiceRole.entities.PendingSale.list('-created_date', 1000),
            base44.asServiceRole.entities.Task.list('-due_date', 1000),
            base44.asServiceRole.entities.CasparFilling.list('-created_date', 1000),
            base44.asServiceRole.entities.MoneyLocation.list('-created_date', 1000)
        ]);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Base44 System';
        workbook.created = new Date();
        workbook.views = [{
            x: 0, y: 0, width: 10000, height: 20000,
            firstSheet: 0, activeTab: 0, visibility: 'visible',
            rtl: true
        }];

        // --- Config ---
        const sheetConfigs = {
            TableData: {
                headers: {
                    order_number: "מספר הזמנה",
                    customer: "לקוח/ות",
                    departure_date: "תאריך עזיבה",
                    nights: "לילות",
                    gender: "מגדר",
                    hotel: "מלון",
                    company: "חברה",
                    sales_rep: "נציג מטפל",
                    eur_amount: "יורו (EUR)",
                    shekel_amount: "שקל (ILS)",
                    dollar_amount: "דולר (USD)",
                    bit_amount: "ביט (BIT)",
                    comments: "הערות",
                    requested_amount: "סכום מבוקש"
                },
                calculatedColumns: [
                    { header: "ערך יורו משוקלל", formula: "=[@[יורו (EUR)]] + [@[שקל (ILS)]]*0.26 + [@[דולר (USD)]]*0.95 + [@[ביט (BIT)]]*0.26" },
                    { header: "סטטוס (חישוב)", formula: "=ROUND([@[ערך יורו משוקלל]] - [@[סכום מבוקש]], 2)" }
                ],
                tableName: "IncomeTable"
            },
            Expense: {
                headers: {
                    expense_date: "תאריך",
                    reason: "סיבה/קטגוריה",
                    recipient: "עבור מי/ספק",
                    amount: "סכום",
                    currency: "מטבע",
                    sales_rep: "נציג מבצע",
                    notes: "הערות"
                },
                calculatedColumns: [
                    { header: "ערך יורו משוקלל", formula: "=IF([@מטבע]=\"ILS\", [@[סכום]]*0.26, IF([@מטבע]=\"USD\", [@[סכום]]*0.95, [@[סכום]]))" }
                ],
                tableName: "ExpenseTable"
            },
            PendingSale: {
                headers: {
                    order_number: "מספר הזמנה",
                    customer: "לקוח/ות",
                    sales_rep: "נציג",
                    eur_amount: "יורו (EUR)",
                    shekel_amount: "שקל (ILS)",
                    dollar_amount: "דולר (USD)",
                    bit_amount: "ביט (BIT)",
                    envelope_received: "התקבל מעטפה?",
                    comments: "הערות"
                },
                tableName: "PendingTable"
            },
            Task: {
                headers: {
                    title: "כותרת",
                    description: "תיאור",
                    status: "סטטוס",
                    due_date: "תאריך יעד",
                    sales_rep: "נציג אחראי",
                    task_type: "סוג משימה",
                    amount: "סכום",
                    currency: "מטבע"
                },
                tableName: "TaskTable"
            },
            CasparFilling: {
                headers: {
                    full_name: "שם מלא",
                    phone_number: "טלפון",
                    hotel: "מלון",
                    departure_date: "תאריך עזיבה",
                    people_count: "כמות אנשים",
                    notification_sent: "התראה נשלחה"
                },
                tableName: "CasparTable"
            },
            MoneyLocation: {
                headers: {
                    name: "שם המיקום",
                    amount: "סכום",
                    currency: "מטבע"
                },
                calculatedColumns: [
                     { header: "ערך יורו משוקלל", formula: "=IF([@מטבע]=\"ILS\", [@[סכום]]*0.26, IF([@מטבע]=\"USD\", [@[סכום]]*0.95, [@[סכום]]))" }
                ],
                tableName: "LocationTable"
            }
        };

        // --- Helper: Add Smart Table Sheet ---
        const addSmartSheet = (data, sheetName, entityType) => {
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: 1 }]
            });

            const config = sheetConfigs[entityType] || { headers: {} };
            const mapping = config.headers;
            
            // 1. Prepare Columns
            let columns = [];
            const sample = data.length > 0 ? data[0] : {};
            const dataKeys = Object.keys(sample).filter(k => 
                !['id', 'created_by', 'updated_date', 'created_date', 'eur_status'].includes(k) // Exclude eur_status as we calculate it
            );

            Object.entries(mapping).forEach(([key, label]) => {
                columns.push({ name: label, key: key, filterButton: true });
            });
            
            // Add extra data keys if not mapped
            dataKeys.forEach(key => {
                if (!mapping[key]) columns.push({ name: key, key: key, filterButton: true });
            });

            // Add Calculated Columns Headers
            if (config.calculatedColumns) {
                config.calculatedColumns.forEach(calc => {
                    columns.push({ name: calc.header, totalsRowFunction: 'sum' });
                });
            }

            // 2. Prepare Rows
            const rows = data.map(item => {
                const row = [];
                columns.forEach(col => {
                    if (col.key) {
                        let val = item[col.key];
                        if (col.key.includes('date') && val) val = new Date(val);
                        if (typeof val === 'boolean') val = val ? 'כן' : 'לא';
                        if (['amount', 'people_count', 'nights'].some(k => col.key.includes(k)) && val) val = parseFloat(val);
                        row.push(val);
                    } else {
                        row.push(null); // Placeholder for calculated formula columns
                    }
                });
                return row;
            });

            // 3. Add Table
            if (columns.length > 0) {
                const tableConfig = {
                    name: config.tableName || `${entityType}Table`,
                    ref: 'A1',
                    headerRow: true,
                    totalsRow: true,
                    style: { theme: 'TableStyleMedium9', showRowStripes: true },
                    columns: columns.map(col => {
                        if (col.key && (col.key.includes('amount') || col.key === 'people_count')) {
                            return { ...col, totalsRowFunction: 'sum' };
                        }
                        return col;
                    }),
                    rows: rows,
                };
                
                sheet.addTable(tableConfig);

                // 4. Post-Processing: Formulas & Formatting
                const totalRows = rows.length;
                
                // Apply Formulas to Calculated Columns
                if (config.calculatedColumns) {
                    config.calculatedColumns.forEach(calc => {
                        const colIndex = columns.findIndex(c => c.name === calc.header);
                        if (colIndex !== -1) {
                            const colLetter = sheet.getColumn(colIndex + 1).letter;
                            // Apply to all data rows
                            for (let r = 2; r <= totalRows + 1; r++) {
                                sheet.getCell(`${colLetter}${r}`).value = { formula: calc.formula };
                            }
                        }
                    });
                }

                // Format Numbers & Dates
                columns.forEach((col, idx) => {
                    const colIdx = idx + 1;
                    if (col.key && col.key.includes('amount') || (col.name && col.name.includes('ערך'))) {
                        sheet.getColumn(colIdx).numFmt = '#,##0.00';
                    }
                    if (col.key && col.key.includes('date')) {
                        sheet.getColumn(colIdx).numFmt = 'dd/mm/yyyy';
                    }
                });

                // Conditional Formatting
                // Example: Status column in Income Table
                if (entityType === 'TableData') {
                    const statusColIndex = columns.findIndex(c => c.name === 'סטטוס (חישוב)');
                    if (statusColIndex !== -1) {
                        const colLetter = sheet.getColumn(statusColIndex + 1).letter;
                        sheet.addConditionalFormatting({
                            ref: `${colLetter}2:${colLetter}9999`,
                            rules: [
                                { type: 'cellIs', operator: 'greaterThan', formula: ['0'], style: { fill: { type: 'pattern', bgColor: { argb: 'FFDCFCE7' } }, font: { color: { argb: 'FF166534' } } } }, // Green
                                { type: 'cellIs', operator: 'lessThan', formula: ['-0.01'], style: { fill: { type: 'pattern', bgColor: { argb: 'FFFEE2E2' } }, font: { color: { argb: 'FF991B1B' } } } }, // Red
                                { type: 'cellIs', operator: 'between', formula: ['-0.01', '0.01'], style: { fill: { type: 'pattern', bgColor: { argb: 'FFDBEAFE' } }, font: { color: { argb: 'FF1E40AF' } } } } // Blue (Balanced)
                            ]
                        });
                    }
                }
                
                if (entityType === 'Task') {
                    const statusColIndex = columns.findIndex(c => c.key === 'status');
                    if (statusColIndex !== -1) {
                         const colLetter = sheet.getColumn(statusColIndex + 1).letter;
                         sheet.addConditionalFormatting({
                            ref: `${colLetter}2:${colLetter}9999`,
                            rules: [
                                { type: 'expression', formula: [`=$${colLetter}2="done"`], style: { fill: { type: 'pattern', bgColor: { argb: 'FFDCFCE7' } }, font: { color: { argb: 'FF166534' }, strike: true } } },
                                { type: 'expression', formula: [`=$${colLetter}2="todo"`], style: { fill: { type: 'pattern', bgColor: { argb: 'FFFEE2E2' } }, font: { color: { argb: 'FF991B1B' } } } }
                            ]
                        });
                    }
                }

                // Adjust Widths
                sheet.columns.forEach(col => { col.width = 18; col.alignment = { vertical: 'middle', horizontal: 'center' }; });
            } else {
                 sheet.addRow(["אין נתונים"]);
            }
        };

        // Add Sheets
        addSmartSheet(income, "הכנסות", "TableData");
        addSmartSheet(expenses, "הוצאות", "Expense");
        addSmartSheet(pendingSales, "מכירות בהמתנה", "PendingSale");
        addSmartSheet(tasks, "משימות", "Task");
        addSmartSheet(caspars, "כספרים", "CasparFilling");
        addSmartSheet(moneyLocations, "מיקומי כסף", "MoneyLocation");

        // --- Live Summary Sheet with Formulas ---
        const summarySheet = workbook.addWorksheet("סיכום בנק", {
            views: [{ rightToLeft: true, showGridLines: false }]
        });

        // Setup Layout
        summarySheet.columns = [
            { width: 3 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 20 },
            { width: 3 }, { width: 25 }, { width: 20 }, { width: 3 }
        ];

        let currentRow = 2;
        // Title
        summarySheet.mergeCells(`B${currentRow}:E${currentRow}`);
        const titleCell = summarySheet.getCell(`B${currentRow}`);
        titleCell.value = "טבלת בנק - סיכום חי (מקושר)";
        titleCell.font = { bold: true, size: 24, name: 'Calibri', color: { argb: 'FF1E293B' } };
        titleCell.alignment = { horizontal: 'right' };
        currentRow += 2;

        // Top Cards (Formulas)
        const drawFormulaCard = (startCol, row, title, formula, subtext, format = '#,##0') => {
            const endCol = String.fromCharCode(startCol.charCodeAt(0) + 1);
            summarySheet.getCell(`${startCol}${row}`).value = title;
            summarySheet.getCell(`${startCol}${row}`).font = { bold: true, size: 11, color: { argb: 'FF64748B' } };
            summarySheet.getCell(`${startCol}${row}`).alignment = { vertical: 'bottom', horizontal: 'right' };
            
            const valCell = summarySheet.getCell(`${startCol}${row+1}`);
            valCell.value = { formula: formula };
            valCell.numFmt = format;
            valCell.font = { bold: true, size: 22, color: { argb: 'FF0F172A' } };
            
            summarySheet.getCell(`${startCol}${row+2}`).value = subtext;
            summarySheet.getCell(`${startCol}${row+2}`).font = { size: 10, color: { argb: 'FF94A3B8' } };
            summarySheet.getCell(`${startCol}${row+2}`).alignment = { vertical: 'top', horizontal: 'right' };

            // Borders
            [0,1,2].forEach(off => {
                 const cell = summarySheet.getCell(`${startCol}${row+off}`);
                 cell.border = { left: {style:'medium', color:{argb:'FFE2E8F0'}}, right: {style:'medium', color:{argb:'FFE2E8F0'}} };
                 if(off===0) cell.border.top = {style:'medium', color:{argb:'FFE2E8F0'}};
                 if(off===2) cell.border.bottom = {style:'medium', color:{argb:'FFE2E8F0'}};
            });
        };

        // Note: SUBTOTAL(103) is COUNTA
        drawFormulaCard('B', currentRow, "סה\"כ מכירות", "=SUBTOTAL(103, IncomeTable[מספר הזמנה])", "הזמנות בטבלה");
        // For average, we approximate using Total / Count
        drawFormulaCard('D', currentRow, "סה\"כ הכנסה (משוערך)", "=SUBTOTAL(109, IncomeTable[ערך יורו משוקלל])", "שווי כולל ביורו", '#,##0 €');
        drawFormulaCard('G', currentRow, "יתרה במיקומים", "=SUBTOTAL(109, LocationTable[ערך יורו משוקלל])", "כספות וארנקים", '#,##0 €');
        
        currentRow += 4;

        // Main Summary Table with Formulas
        const colMap = { desc: 'B', eur: 'C', ils: 'D', usd: 'E' };
        
        // Headers
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "תיאור";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = "יורו (EUR)";
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = "שקל (ILS)";
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = "דולר (USD)";
        
        ['B','C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.font = { bold: true, color: { argb: 'FF475569' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            cell.alignment = { horizontal: 'center' };
        });
        currentRow++;

        // Income Row
        summarySheet.getCell(`B${currentRow}`).value = "סה\"כ הכנסות";
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=SUBTOTAL(109, IncomeTable[יורו (EUR)])" };
        summarySheet.getCell(`D${currentRow}`).value = { formula: "=SUBTOTAL(109, IncomeTable[שקל (ILS)])" };
        summarySheet.getCell(`E${currentRow}`).value = { formula: "=SUBTOTAL(109, IncomeTable[דולר (USD)])" };
        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FF16A34A' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        currentRow++;

        // Expense Row
        summarySheet.getCell(`B${currentRow}`).value = "סה\"כ הוצאות";
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=SUMIF(ExpenseTable[מטבע], \"EUR\", ExpenseTable[סכום])" };
        summarySheet.getCell(`D${currentRow}`).value = { formula: "=SUMIF(ExpenseTable[מטבע], \"ILS\", ExpenseTable[סכום])" };
        summarySheet.getCell(`E${currentRow}`).value = { formula: "=SUMIF(ExpenseTable[מטבע], \"USD\", ExpenseTable[סכום])" };
        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        currentRow++;

        // Balance Row
        summarySheet.getCell(`B${currentRow}`).value = "יתרה בקופה";
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=C" + (currentRow-2) + "-C" + (currentRow-1) };
        summarySheet.getCell(`D${currentRow}`).value = { formula: "=D" + (currentRow-2) + "-D" + (currentRow-1) };
        summarySheet.getCell(`E${currentRow}`).value = { formula: "=E" + (currentRow-2) + "-E" + (currentRow-1) };
        ['B','C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.font = { bold: true, size: 12 };
            cell.alignment = { horizontal: 'center' };
            if (col !== 'B') cell.numFmt = '#,##0';
        });
        currentRow++;

        // Bit Footer
        summarySheet.getCell(`B${currentRow}`).value = "סה\"כ ביט (BIT)";
        summarySheet.mergeCells(`C${currentRow}:E${currentRow}`);
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=SUBTOTAL(109, IncomeTable[ביט (BIT)])" };
        summarySheet.getCell(`C${currentRow}`).numFmt = '₪#,##0';
        ['B','C'].forEach(col => {
             const cell = summarySheet.getCell(`${col}${currentRow}`);
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
             cell.font = { color: { argb: 'FF1E40AF' }, bold: true };
        });
        currentRow += 3;

        // Side Pivot-like Tables (Static for now as ExcelJS can't create Pivot Tables, but we can use SUMIFs for known categories if list is small, or keep static)
        // Since category lists are dynamic, static export of current state is safest, but we can make the totals "Live" if we list all known categories.
        // Let's stick to the previous static generation for the Breakdown tables BUT with a note that they are snapshots, OR use simple formulas if possible.
        // For robustness, I'll generate them as static values because dynamic spill arrays (=UNIQUE) might not be supported in all Excel versions/ExcelJS.
        
        const listStartRow = currentRow;
        
        // Reps
        summarySheet.mergeCells(`B${listStartRow}:C${listStartRow}`);
        summarySheet.getCell(`B${listStartRow}`).value = "🏆 מכירות לפי נציג (תמונת מצב)";
        summarySheet.getCell(`B${listStartRow}`).font = { bold: true };
        
        let repRow = listStartRow + 1;
        // Calculating stats here for snapshot
        const salesRepStats = {};
        income.forEach(row => {
            const total = (parseFloat(row.eur_amount)||0) + (parseFloat(row.shekel_amount)||0)*0.26 + (parseFloat(row.dollar_amount)||0)*0.95 + (parseFloat(row.bit_amount)||0)*0.26;
            const rep = row.sales_rep || 'ללא נציג';
            salesRepStats[rep] = (salesRepStats[rep]||0) + total;
        });

        Object.entries(salesRepStats).sort(([,a], [,b]) => b - a).forEach(([name, val]) => {
            summarySheet.getCell(`B${repRow}`).value = name;
            summarySheet.getCell(`C${repRow}`).value = val;
            summarySheet.getCell(`C${repRow}`).numFmt = '#,##0 €';
            repRow++;
        });

        // Expenses
        summarySheet.mergeCells(`G${listStartRow}:H${listStartRow}`);
        summarySheet.getCell(`G${listStartRow}`).value = "📉 הוצאות לפי קטגוריה (תמונת מצב)";
        summarySheet.getCell(`G${listStartRow}`).font = { bold: true };
        
        let expRow = listStartRow + 1;
        const catStats = {};
        expenses.forEach(exp => {
            let val = parseFloat(exp.amount)||0;
            if(exp.currency==='ILS') val*=0.26;
            if(exp.currency==='USD') val*=0.95;
            const reason = exp.reason || 'אחר';
            catStats[reason] = (catStats[reason]||0) + val;
        });

        Object.entries(catStats).sort(([,a], [,b]) => b - a).forEach(([name, val]) => {
            summarySheet.getCell(`G${expRow}`).value = name;
            summarySheet.getCell(`H${expRow}`).value = val;
            summarySheet.getCell(`H${expRow}`).numFmt = '#,##0 €';
            expRow++;
        });

        // Upload
        const buffer = await workbook.xlsx.writeBuffer();
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        if (!accessToken) return Response.json({ error: "No Google Drive token" }, { status: 400 });

        const folderName = "אקסל";
        let folderId = null;
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
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
        
        const metadata = { name: fileName, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', parents: folderId ? [folderId] : [] };
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData
        });

        if (!uploadRes.ok) throw new Error(await uploadRes.text());
        return Response.json({ success: true, fileId: (await uploadRes.json()).id });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});