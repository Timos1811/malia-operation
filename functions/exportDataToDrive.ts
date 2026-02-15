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

        // 2. Create Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Base44 System';
        workbook.created = new Date();
        workbook.views = [{
            x: 0, y: 0, width: 10000, height: 20000,
            firstSheet: 0, activeTab: 0, visibility: 'visible',
            rtl: true
        }];

        // --- Configuration: Headers & Validations ---
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
                    eur_status: "סטטוס יורו",
                    requested_amount: "סכום מבוקש"
                },
                validations: {
                    gender: ["זכר", "נקבה", "מעורב"],
                    company: ["קשרי תעופה", "נטו פאן"]
                }
            },
            Expense: {
                headers: {
                    expense_date: "תאריך",
                    reason: "סיבה/קטגוריה",
                    recipient: "עבור מי/ספק",
                    amount: "סכום",
                    currency: "מטבע",
                    sales_rep: "נציג מבצע",
                    notes: "הערות",
                    returned_to_in_israel: "הוחזר ל-"
                },
                validations: {
                    currency: ["EUR", "ILS", "USD"],
                    reason: [
                        "יצא מהיעד", "החזר מלא", "החזר חלקי", "רכב", "אחר", 
                        "משיכה לאדם", "תשלום לספק", "פיצוי קשרי תעופה", 
                        "פיצוי נטו פאן", "פינוק ללקוחות", "פינוק לנציגים", "אשל"
                    ]
                }
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
                validations: {
                    envelope_received: ["TRUE", "FALSE"] // Excel boolean check
                }
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
                validations: {
                    status: ["todo", "done"],
                    task_type: ["general", "refund", "supplier_payment", "add_event"],
                    currency: ["EUR", "ILS", "USD"]
                }
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
                validations: {}
            },
            MoneyLocation: {
                headers: {
                    name: "שם המיקום",
                    amount: "סכום",
                    currency: "מטבע"
                },
                validations: {
                    currency: ["EUR", "ILS", "USD"]
                }
            }
        };

        // --- Helper: Add Smart Table Sheet ---
        const addSmartSheet = (data, sheetName, entityType) => {
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: 1 }]
            });

            const config = sheetConfigs[entityType] || { headers: {}, validations: {} };
            const mapping = config.headers;
            
            // 1. Prepare Columns
            // Use mapped keys primarily, allow raw keys if data exists but not mapped
            let columns = [];
            const sample = data.length > 0 ? data[0] : {};
            const dataKeys = Object.keys(sample).filter(k => 
                !['id', 'created_by', 'updated_date', 'created_date'].includes(k)
            );

            // Defined headers first
            Object.entries(mapping).forEach(([key, label]) => {
                columns.push({ name: label, key: key, filterButton: true });
            });

            // Extra headers from data
            dataKeys.forEach(key => {
                if (!mapping[key]) {
                    columns.push({ name: key, key: key, filterButton: true });
                }
            });

            // 2. Prepare Rows
            const rows = data.map(item => {
                const row = [];
                columns.forEach(col => {
                    let val = item[col.key];
                    
                    // Formatting logic
                    if (col.key.includes('date') && val) val = new Date(val);
                    if (typeof val === 'boolean') val = val ? 'כן' : 'לא';
                    if (['amount', 'people_count', 'nights'].some(k => col.key.includes(k)) && val) val = parseFloat(val);
                    
                    row.push(val);
                });
                return row;
            });

            // 3. Add Table
            if (columns.length > 0) {
                const tableConfig = {
                    name: `${entityType}Table`,
                    ref: 'A1',
                    headerRow: true,
                    totalsRow: true, // Enable totals row
                    style: {
                        theme: 'TableStyleMedium9', // Blue/Light style
                        showRowStripes: true,
                    },
                    columns: columns.map(col => {
                        // Add totals for numeric amount columns
                        if (col.key.includes('amount') || col.key === 'people_count') {
                            return { ...col, totalsRowFunction: 'sum' };
                        }
                        return col;
                    }),
                    rows: rows,
                };
                
                sheet.addTable(tableConfig);

                // 4. Post-Table Styling & Validation
                const lastRowIdx = 1 + rows.length + 1; // Header + Data + Total

                // Set Column Widths
                sheet.columns.forEach(col => {
                    col.width = 20; 
                    col.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (col.key && (col.key.includes('title') || col.key.includes('description') || col.key.includes('comments'))) {
                        col.width = 35; // Wider for text
                        col.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
                    }
                });

                // Apply Data Validations
                Object.entries(config.validations).forEach(([key, options]) => {
                    const colIndex = columns.findIndex(c => c.key === key);
                    if (colIndex !== -1) {
                        // Apply validation to the whole data column (e.g. A2:A1000)
                        const colLetter = sheet.getColumn(colIndex + 1).letter;
                        // Range from 2 to 9999 to allow future entry
                        const range = `${colLetter}2:${colLetter}9999`;
                        
                        // We can't easily set validation on range string in ExcelJS, 
                        // we loop through existing rows + some extra empty ones?
                        // Better: Apply to current rows. For "Working file", user might need to copy-paste validation.
                        // Excel Tables usually extend validation automatically to new rows!
                        
                        for (let r = 2; r <= rows.length + 50; r++) { // Apply to existing + 50 buffer rows
                            sheet.getCell(`${colLetter}${r}`).dataValidation = {
                                type: 'list',
                                allowBlank: true,
                                formulae: [`"${options.join(',')}"`],
                                showErrorMessage: true,
                                errorTitle: 'ערך לא חוקי',
                                error: 'אנא בחר ערך מהרשימה'
                            };
                        }
                    }
                });

                // Format Numbers & Dates
                columns.forEach((col, idx) => {
                    const colLetter = sheet.getColumn(idx + 1).letter;
                    const cellRange = `${colLetter}2:${colLetter}${rows.length + 1}`;
                    
                    if (col.key.includes('amount')) {
                        sheet.getColumn(idx + 1).numFmt = '#,##0.00';
                    }
                    if (col.key.includes('date')) {
                        sheet.getColumn(idx + 1).numFmt = 'dd/mm/yyyy';
                    }
                });
            } else {
                 sheet.addRow(["אין נתונים להצגה"]);
            }
        };

        // Add Smart Sheets
        addSmartSheet(income, "הכנסות", "TableData");
        addSmartSheet(expenses, "הוצאות", "Expense");
        addSmartSheet(pendingSales, "מכירות בהמתנה", "PendingSale");
        addSmartSheet(tasks, "משימות", "Task");
        addSmartSheet(caspars, "כספרים", "CasparFilling");
        addSmartSheet(moneyLocations, "מיקומי כסף", "MoneyLocation");

        // --- Summary Sheet (Same Visuals, just referencing data) ---
        // Calculating stats in JS still, as cross-sheet formulas to tables can be brittle in generation.
        
        // ... (Keep existing stats logic)
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

        // Build Summary
        const summarySheet = workbook.addWorksheet("סיכום בנק", {
            views: [{ rightToLeft: true, showGridLines: false }]
        });

        summarySheet.columns = [
            { width: 3 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 20 },
            { width: 3 }, { width: 25 }, { width: 20 }, { width: 3 }
        ];

        let currentRow = 2;
        summarySheet.mergeCells(`B${currentRow}:E${currentRow}`);
        const titleCell = summarySheet.getCell(`B${currentRow}`);
        titleCell.value = "טבלת בנק - סיכום מנהלים";
        titleCell.font = { bold: true, size: 24, name: 'Calibri', color: { argb: 'FF1E293B' } };
        titleCell.alignment = { horizontal: 'right' };
        currentRow += 2;

        const drawCard = (startCol, row, title, value, subtext) => {
            const endCol = String.fromCharCode(startCol.charCodeAt(0) + 1);
            summarySheet.getCell(`${startCol}${row}`).value = title;
            summarySheet.getCell(`${startCol}${row}`).font = { bold: true, size: 11, color: { argb: 'FF64748B' }, name: 'Calibri' };
            summarySheet.getCell(`${startCol}${row}`).alignment = { vertical: 'bottom', horizontal: 'right' };
            
            summarySheet.getCell(`${startCol}${row+1}`).value = value;
            summarySheet.getCell(`${startCol}${row+1}`).font = { bold: true, size: 22, color: { argb: 'FF0F172A' }, name: 'Calibri' };
            
            summarySheet.getCell(`${startCol}${row+2}`).value = subtext;
            summarySheet.getCell(`${startCol}${row+2}`).font = { size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
            summarySheet.getCell(`${startCol}${row+2}`).alignment = { vertical: 'top', horizontal: 'right' };

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
        currentRow += 4;

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

        // Income
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "סה\"כ הכנסות";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = totals.eur.income;
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = totals.shekel.income;
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = totals.usd.income;
        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FF16A34A' }, bold: true }; 
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        summarySheet.getRow(currentRow).height = 25;
        currentRow++;

        // Expenses
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "סה\"כ הוצאות";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = totals.eur.expenses;
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = totals.shekel.expenses;
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = totals.usd.expenses;
        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        summarySheet.getRow(currentRow).height = 25;
        currentRow++;

        // Balance
        summarySheet.getCell(`${colMap.desc}${currentRow}`).value = "יתרה בקופה";
        summarySheet.getCell(`${colMap.eur}${currentRow}`).value = totals.eur.income - totals.eur.expenses;
        summarySheet.getCell(`${colMap.ils}${currentRow}`).value = totals.shekel.income - totals.shekel.expenses;
        summarySheet.getCell(`${colMap.usd}${currentRow}`).value = totals.usd.income - totals.usd.expenses;
        ['B','C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.font = { bold: true, size: 12 };
            cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (col !== 'B') cell.numFmt = '#,##0';
        });
        summarySheet.getRow(currentRow).height = 35;
        currentRow++;

        // Bit Footer
        summarySheet.getCell(`B${currentRow}`).value = "סיכום ביט";
        summarySheet.mergeCells(`C${currentRow}:E${currentRow}`);
        summarySheet.getCell(`C${currentRow}`).value = `קשרי תעופה: ₪${totals.bitKishrei.toLocaleString()}  |  נטו פאן: ₪${totals.bitNeto.toLocaleString()}  |  סה"כ: ₪${totals.bit.income.toLocaleString()}`;
        ['B', 'C'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            cell.font = { color: { argb: 'FF1E40AF' }, bold: true };
            cell.border = { top: { style: 'thin', color: { argb: 'FFBFDBFE' } } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        summarySheet.getRow(currentRow).height = 35;
        currentRow += 3;

        // Side Tables
        const listStartRow = currentRow;
        
        // Reps
        summarySheet.mergeCells(`B${listStartRow}:C${listStartRow}`);
        const repHeader = summarySheet.getCell(`B${listStartRow}`);
        repHeader.value = "🏆 מכירות לפי נציג (יורו)";
        repHeader.font = { bold: true, color: { argb: 'FF0F172A' }, size: 12 };
        repHeader.border = { bottom: { style: 'thick', color: { argb: 'FFCBD5E1' } } };
        
        let repRow = listStartRow + 1;
        Object.entries(salesRepStats).sort(([,a], [,b]) => b - a).forEach(([name, val]) => {
            summarySheet.getCell(`B${repRow}`).value = name;
            summarySheet.getCell(`C${repRow}`).value = val;
            summarySheet.getCell(`C${repRow}`).numFmt = '#,##0 €';
            if ((repRow - listStartRow) % 2 === 0) {
                 summarySheet.getCell(`B${repRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                 summarySheet.getCell(`C${repRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
            repRow++;
        });

        // Expenses Categories
        summarySheet.mergeCells(`G${listStartRow}:H${listStartRow}`);
        const expHeader = summarySheet.getCell(`G${listStartRow}`);
        expHeader.value = "📉 הוצאות לפי קטגוריה (יורו)";
        expHeader.font = { bold: true, color: { argb: 'FF0F172A' }, size: 12 };
        expHeader.border = { bottom: { style: 'thick', color: { argb: 'FFCBD5E1' } } };

        let expRow = listStartRow + 1;
        Object.entries(categoryStats).sort(([,a], [,b]) => b - a).forEach(([name, val]) => {
            summarySheet.getCell(`G${expRow}`).value = name;
            summarySheet.getCell(`H${expRow}`).value = val;
            summarySheet.getCell(`H${expRow}`).numFmt = '#,##0 €';
            if ((expRow - listStartRow) % 2 === 0) {
                 summarySheet.getCell(`G${expRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                 summarySheet.getCell(`H${expRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
            expRow++;
        });

        // Upload
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