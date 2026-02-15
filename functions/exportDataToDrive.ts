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

        // Pre-process income to extract customer count
        income.forEach(item => {
            const match = String(item.customer || '').match(/\d+/);
            item.extracted_customer_count = match ? parseInt(match[0]) : 0;
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Base44 System';
        workbook.created = new Date();
        workbook.views = [{
            x: 0, y: 0, width: 10000, height: 20000,
            firstSheet: 0, activeTab: 0, visibility: 'visible',
            rtl: true
        }];

        // --- Dropdown Lists (Validations) ---
        const dropdowns = {
            gender: "\"זכר,נקבה\"",
            company: "\"נטו פאן,קשרי תעופה\"",
            boolean: "\"כן,לא\"",
            currency: "\"EUR,ILS,USD,BIT\"",
            taskStatus: "\"todo,done\"", // Using raw values to match conditional formatting
            taskType: "\"general,refund,supplier_payment,add_event\"",
            expenseReason: "\"יצא מהיעד,החזר מלא,החזר חלקי,רכב,אחר,משיכה לאדם,תשלום לספק,פיצוי קשרי תעופה,פיצוי נטו פאן,פינוק ללקוחות,פינוק לנציגים,אשל\""
        };

        // --- Config ---
        const sheetConfigs = {
            TableData: {
                headers: {
                    order_number: "מספר הזמנה",
                    customer: "לקוח/ות",
                    extracted_customer_count: "כמות לקוחות",
                    departure_date: "תאריך עזיבה",
                    nights: "לילות",
                    gender: "מגדר",
                    hotel: "מלון",
                    company: "חברה",
                    sales_rep: "נציג מטפל",
                    eur_amount: "יורו",
                    shekel_amount: "שקל",
                    dollar_amount: "דולר",
                    bit_amount: "ביט",
                    comments: "הערות",
                    requested_amount: "סכום מבוקש"
                },
                calculatedColumns: [
                    { 
                        header: "שווי ביורו", 
                        formula: (r, kMap) => `=IFERROR(N(${kMap.eur_amount}${r}) + N(${kMap.shekel_amount}${r})*0.26 + N(${kMap.dollar_amount}${r})*0.95 + N(${kMap.bit_amount}${r})*0.26, 0)` 
                    },
                    { 
                        header: "סטטוס", 
                        formula: (r, kMap, nMap) => `=IFERROR(ROUND(${nMap['שווי ביורו']}${r} - N(${kMap.requested_amount}${r}), 2), 0)` 
                    }
                ],
                validations: {
                    gender: dropdowns.gender,
                    company: dropdowns.company
                },
                tableName: "IncomeTable"
            },
            Expense: {
                headers: {
                    expense_date: "תאריך",
                    reason: "סיבה",
                    recipient: "עבור מי",
                    amount: "סכום",
                    currency: "מטבע",
                    sales_rep: "נציג",
                    notes: "הערות"
                },
                calculatedColumns: [
                    { 
                        header: "שווי ביורו", 
                        formula: (r, kMap) => `=IFERROR(IF(${kMap.currency}${r}="ILS", N(${kMap.amount}${r})*0.26, IF(${kMap.currency}${r}="USD", N(${kMap.amount}${r})*0.95, N(${kMap.amount}${r}))), 0)` 
                    }
                ],
                validations: {
                    currency: dropdowns.currency,
                    reason: dropdowns.expenseReason
                },
                tableName: "ExpenseTable"
            },
            PendingSale: {
                headers: {
                    order_number: "מספר הזמנה",
                    customer: "לקוח/ות",
                    sales_rep: "נציג",
                    eur_amount: "יורו",
                    shekel_amount: "שקל",
                    dollar_amount: "דולר",
                    bit_amount: "ביט",
                    envelope_received: "התקבל מעטפה?",
                    comments: "הערות"
                },
                validations: {
                    envelope_received: dropdowns.boolean
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
                validations: {
                    status: dropdowns.taskStatus,
                    task_type: dropdowns.taskType,
                    currency: dropdowns.currency
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
                validations: {
                    notification_sent: dropdowns.boolean
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
                     { 
                        header: "שווי ביורו", 
                        formula: (r, kMap) => `=IFERROR(IF(${kMap.currency}${r}="ILS", N(${kMap.amount}${r})*0.26, IF(${kMap.currency}${r}="USD", N(${kMap.amount}${r})*0.95, N(${kMap.amount}${r}))), 0)` 
                     }
                ],
                validations: {
                    currency: dropdowns.currency
                },
                tableName: "LocationTable"
            }
        };

        // --- Helper: Add Smart Sheet (Manual Mode) ---
        const addSmartSheet = (data, sheetName, entityType) => {
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: 1 }]
            });

            const config = sheetConfigs[entityType] || { headers: {} };
            const mapping = config.headers;
            
            // 1. Prepare Columns Headers and Keys
            let columns = [];
            const sample = data.length > 0 ? data[0] : {};
            const dataKeys = Object.keys(sample).filter(k => 
                !['id', 'created_by', 'updated_date', 'created_date', 'eur_status'].includes(k)
            );

            // Add mapped columns first
            Object.entries(mapping).forEach(([key, label]) => {
                columns.push({ name: label, key: key });
            });
            
            // Add remaining data keys
            dataKeys.forEach(key => {
                if (!mapping[key]) columns.push({ name: key, key: key });
            });

            // Add calculated columns definition
            if (config.calculatedColumns) {
                config.calculatedColumns.forEach(calc => {
                    columns.push({ name: calc.header, isCalculated: true });
                });
            }

            if (columns.length === 0) {
                sheet.addRow(["אין נתונים"]);
                return;
            }

            // 2. Write Header Row
            const headerRow = sheet.addRow(columns.map(c => c.name));
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }; // Blue header
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 20;

            // 3. Write Data Rows
            const startRow = 2;
            data.forEach((item, index) => {
                const rowValues = [];
                columns.forEach(col => {
                    if (col.isCalculated) {
                        rowValues.push(null); // Placeholder for formula
                    } else if (col.key) {
                        let val = item[col.key];
                        if (col.key.includes('date') && val) val = new Date(val);
                        if (typeof val === 'boolean') val = val ? 'כן' : 'לא';
                        
                        // Numeric handling
                        if (['amount', 'people_count', 'nights'].some(k => col.key.includes(k))) {
                            const parsed = parseFloat(val);
                            val = isNaN(parsed) ? 0 : parsed;
                        }
                        rowValues.push(val);
                    } else {
                        rowValues.push(null);
                    }
                });
                sheet.addRow(rowValues);
            });

            const lastDataRow = startRow + data.length - 1;

            // 4. Map Columns for References
            const keyToLetter = {};
            const nameToLetter = {};
            columns.forEach((col, idx) => {
                const letter = sheet.getColumn(idx + 1).letter;
                nameToLetter[col.name] = letter;
                if (col.key) keyToLetter[col.key] = letter;
                
                // Set Width and Alignment
                sheet.getColumn(idx + 1).width = 18;
                sheet.getColumn(idx + 1).alignment = { vertical: 'middle', horizontal: 'center' };
                
                // Format Amounts/Dates
                if ((col.key && col.key.includes('amount')) || (col.name && col.name.includes('ערך')) || col.isCalculated) {
                    if (!col.key || !col.key.includes('people')) { // Don't format people count as currency/decimal usually
                         sheet.getColumn(idx + 1).numFmt = '#,##0.00';
                    }
                }
                if (col.key && col.key.includes('date')) {
                    sheet.getColumn(idx + 1).numFmt = 'dd/mm/yyyy';
                }
            });

            // 5. Apply Formulas to Data Rows
            if (config.calculatedColumns && data.length > 0) {
                config.calculatedColumns.forEach(calc => {
                    const colIndex = columns.findIndex(c => c.name === calc.header);
                    if (colIndex !== -1) {
                        const targetColLetter = sheet.getColumn(colIndex + 1).letter;
                        for (let r = startRow; r <= lastDataRow; r++) {
                            const formula = typeof calc.formula === 'function' 
                                ? calc.formula(r, keyToLetter, nameToLetter)
                                : calc.formula;
                            sheet.getCell(`${targetColLetter}${r}`).value = { formula: formula };
                        }
                    }
                });
            }

            // 6. Add Totals Row
            if (data.length > 0) {
                const totalRowIndex = lastDataRow + 1;
                const totalRow = sheet.getRow(totalRowIndex);
                
                // First column label
                sheet.getCell(`A${totalRowIndex}`).value = "סה\"כ";
                
                columns.forEach((col, idx) => {
                    const colLetter = sheet.getColumn(idx + 1).letter;
                    // Check if should sum
                    const shouldSum = (col.key && (col.key.includes('amount') || col.key === 'people_count')) || col.isCalculated;
                    
                    if (shouldSum) {
                        sheet.getCell(`${colLetter}${totalRowIndex}`).value = { formula: `=SUM(${colLetter}${startRow}:${colLetter}${lastDataRow})` };
                    }
                });
                
                totalRow.font = { bold: true };
                totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            }

            // 7. Auto Filter
            sheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: lastDataRow, column: columns.length }
            };

            // 8. Validations (Extend to 1000 rows for future editing)
            const validationRangeEnd = 1000;
            columns.forEach((col, idx) => {
                const colLetter = sheet.getColumn(idx + 1).letter;
                const colKey = col.key;
                if (colKey && config.validations && config.validations[colKey]) {
                    for (let r = startRow; r <= validationRangeEnd; r++) {
                         sheet.getCell(`${colLetter}${r}`).dataValidation = {
                            type: 'list',
                            allowBlank: true,
                            formulae: [config.validations[colKey]],
                            showErrorMessage: true,
                            errorStyle: 'warning',
                            errorTitle: 'ערך לא חוקי',
                            error: 'אנא בחר ערך מהרשימה'
                        };
                    }
                }
            });

            // 9. Conditional Formatting
             if (entityType === 'TableData') {
                const statusColIndex = columns.findIndex(c => c.name === 'סטטוס');
                if (statusColIndex !== -1) {
                    const colLetter = sheet.getColumn(statusColIndex + 1).letter;
                    sheet.addConditionalFormatting({
                        ref: `${colLetter}2:${colLetter}1000`,
                        rules: [
                            { type: 'cellIs', operator: 'greaterThan', formulae: ['0'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }, font: { color: { argb: 'FF166534' } } } },
                            { type: 'cellIs', operator: 'lessThan', formulae: ['-0.01'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { color: { argb: 'FF991B1B' } } } },
                            { type: 'cellIs', operator: 'between', formulae: ['-0.01', '0.01'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }, font: { color: { argb: 'FF1E40AF' } } } }
                        ]
                    });
                }
            }
            
            if (entityType === 'Task') {
                const statusColIndex = columns.findIndex(c => c.key === 'status');
                if (statusColIndex !== -1) {
                     const colLetter = sheet.getColumn(statusColIndex + 1).letter;
                     sheet.addConditionalFormatting({
                        ref: `${colLetter}2:${colLetter}1000`,
                        rules: [
                            { type: 'expression', formulae: [`=$${colLetter}2="done"`], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }, font: { color: { argb: 'FF166534' }, strike: true } } },
                            { type: 'expression', formulae: [`=$${colLetter}2="todo"`], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, font: { color: { argb: 'FF991B1B' } } } }
                        ]
                    });
                }
            }
        };

        // Add Sheets
        addSmartSheet(income, "הכנסות", "TableData");
        addSmartSheet(expenses, "הוצאות", "Expense");
        addSmartSheet(pendingSales, "מכירות בהמתנה", "PendingSale");
        addSmartSheet(tasks, "משימות", "Task");
        addSmartSheet(caspars, "כספרים", "CasparFilling");
        addSmartSheet(moneyLocations, "מיקומי כסף", "MoneyLocation");

        // --- Live Summary Sheet (Same as before) ---
        const summarySheet = workbook.addWorksheet("סיכום בנק", {
            views: [{ rightToLeft: true, showGridLines: false }]
        });
        
        summarySheet.columns = [
            { width: 3 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 25 },
            { width: 3 }, { width: 25 }, { width: 20 }, { width: 3 }, { width: 3 }, { width: 25 }
        ];

        let currentRow = 2;
        summarySheet.mergeCells(`B${currentRow}:E${currentRow}`);
        const titleCell = summarySheet.getCell(`B${currentRow}`);
        titleCell.value = "טבלת בנק - סיכום חי (מקושר)";
        titleCell.font = { bold: true, size: 24, name: 'Calibri', color: { argb: 'FF1E293B' } };
        titleCell.alignment = { horizontal: 'right' };
        currentRow += 2;

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

            [0,1,2].forEach(off => {
                 const cell = summarySheet.getCell(`${startCol}${row+off}`);
                 cell.border = { left: {style:'medium', color:{argb:'FFE2E8F0'}}, right: {style:'medium', color:{argb:'FFE2E8F0'}} };
                 if(off===0) cell.border.top = {style:'medium', color:{argb:'FFE2E8F0'}};
                 if(off===2) cell.border.bottom = {style:'medium', color:{argb:'FFE2E8F0'}};
            });
        };

        // Row 1 of Cards
        drawFormulaCard('B', currentRow, "סה\"כ לקוחות", "=IFERROR(SUBTOTAL(109, IncomeTable[כמות לקוחות]), 0)", "לקוחות בכל הקבוצות");
        drawFormulaCard('E', currentRow, "סה\"כ קבוצות/מכירות", "=IFERROR(SUBTOTAL(103, IncomeTable[מספר הזמנה]), 0)", "הזמנות במערכת");
        drawFormulaCard('H', currentRow, "ממוצע ללקוח", "=IFERROR(K" + (currentRow+1) + "/B" + (currentRow+1) + ", 0)", "הכנסה ממוצעת", '#,##0 €');

        currentRow += 4;

        // Row 2 of Cards
        drawFormulaCard('B', currentRow, "יתרה במיקומים", "=IFERROR(SUBTOTAL(109, LocationTable[שווי ביורו]), 0)", "כספות וארנקים", '#,##0 €');
        drawFormulaCard('K', currentRow - 4, "סה\"כ הכנסה (משוערך)", "=IFERROR(SUBTOTAL(109, IncomeTable[שווי ביורו]), 0)", "שווי כולל ביורו", '#,##0 €'); // Hidden or placed side
        
        // Let's place Total Income clearly. I'll put it at E in 2nd row
        drawFormulaCard('E', currentRow, "סה\"כ הכנסה כוללת", "=IFERROR(SUBTOTAL(109, IncomeTable[שווי ביורו]), 0)", "שווי כולל ביורו", '#,##0 €');

        currentRow += 4;

        const colMap = { desc: 'B', eur: 'C', ils: 'D', usd: 'E' };
        
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

        summarySheet.getCell(`B${currentRow}`).value = "סה\"כ הכנסות";
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=IFERROR(SUBTOTAL(109, IncomeTable[יורו]), 0)" };
        summarySheet.getCell(`D${currentRow}`).value = { formula: "=IFERROR(SUBTOTAL(109, IncomeTable[שקל]), 0)" };
        summarySheet.getCell(`E${currentRow}`).value = { formula: "=IFERROR(SUBTOTAL(109, IncomeTable[דולר]), 0)" };
        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FF16A34A' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        currentRow++;

        summarySheet.getCell(`B${currentRow}`).value = "סה\"כ הוצאות";
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=IFERROR(SUMIF(ExpenseTable[מטבע], \"EUR\", ExpenseTable[סכום]), 0)" };
        summarySheet.getCell(`D${currentRow}`).value = { formula: "=IFERROR(SUMIF(ExpenseTable[מטבע], \"ILS\", ExpenseTable[סכום]), 0)" };
        summarySheet.getCell(`E${currentRow}`).value = { formula: "=IFERROR(SUMIF(ExpenseTable[מטבע], \"USD\", ExpenseTable[סכום]), 0)" };
        ['C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.numFmt = '#,##0';
            cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });
        summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
        currentRow++;

        summarySheet.getCell(`B${currentRow}`).value = "יתרה בקופה";
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=IFERROR(C" + (currentRow-2) + "-C" + (currentRow-1) + ", 0)" };
        summarySheet.getCell(`D${currentRow}`).value = { formula: "=IFERROR(D" + (currentRow-2) + "-D" + (currentRow-1) + ", 0)" };
        summarySheet.getCell(`E${currentRow}`).value = { formula: "=IFERROR(E" + (currentRow-2) + "-E" + (currentRow-1) + ", 0)" };
        ['B','C','D','E'].forEach(col => {
            const cell = summarySheet.getCell(`${col}${currentRow}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.font = { bold: true, size: 12 };
            cell.alignment = { horizontal: 'center' };
            if (col !== 'B') cell.numFmt = '#,##0';
        });
        currentRow++;

        summarySheet.getCell(`B${currentRow}`).value = "סה\"כ ביט";
        summarySheet.mergeCells(`C${currentRow}:E${currentRow}`);
        summarySheet.getCell(`C${currentRow}`).value = { formula: "=SUBTOTAL(109, IncomeTable[ביט])" };
        summarySheet.getCell(`C${currentRow}`).numFmt = '₪#,##0';
        ['B','C'].forEach(col => {
             const cell = summarySheet.getCell(`${col}${currentRow}`);
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
             cell.font = { color: { argb: 'FF1E40AF' }, bold: true };
        });
        currentRow += 3;
        
        const listStartRow = currentRow;
        summarySheet.mergeCells(`B${listStartRow}:C${listStartRow}`);
        summarySheet.getCell(`B${listStartRow}`).value = "🏆 מכירות לפי נציג (תמונת מצב)";
        summarySheet.getCell(`B${listStartRow}`).font = { bold: true };
        
        let repRow = listStartRow + 1;
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