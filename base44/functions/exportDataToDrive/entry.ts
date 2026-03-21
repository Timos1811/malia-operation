import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import ExcelJS from 'npm:exceljs@4.4.0';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. שליפת כל הנתונים מהטבלאות
        const [income, expenses, pendingSales, tasks, caspars, moneyLocations] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 2000),
            base44.asServiceRole.entities.Expense.list('-expense_date', 2000), 
            base44.asServiceRole.entities.PendingSale.list('-created_date', 2000),
            base44.asServiceRole.entities.Task.list('-due_date', 2000),
            base44.asServiceRole.entities.CasparFilling.list('-created_date', 2000),
            base44.asServiceRole.entities.MoneyLocation.list('-created_date', 2000)
        ]);

        // 2. יצירת קובץ אקסל חדש
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Base44 System';
        workbook.created = new Date();
        workbook.views = [{
            x: 0, y: 0, width: 10000, height: 20000,
            firstSheet: 0, activeTab: 0, visibility: 'visible',
            rtl: true
        }];

        // פונקציית עזר ליצירת גיליון עם עיצוב משופר
        const addSheet = (data, sheetName, headers, rowStyleCallback) => {
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
            });

            // הגדרת עמודות
            const columns = Object.keys(headers).map(key => ({
                header: headers[key],
                key: key,
                width: 22,
                style: { font: { name: 'Arial', size: 10 } }
            }));
            
            sheet.columns = columns;

            // עיצוב שורת כותרת
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // Slate 700
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 24;

            // הוספת הנתונים
            data.forEach((item, index) => {
                const rowData = {};
                Object.keys(headers).forEach(key => {
                    let val = item[key];
                    if (['amount', 'people_count', 'nights', 'price_eur', 'buyers_count', 'scanned_count', 'eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount'].some(k => key.includes(k))) {
                        const num = parseFloat(val);
                        val = isNaN(num) ? 0 : num;
                    }
                    if (typeof val === 'boolean') {
                        val = val ? 'כן' : 'לא';
                    }
                    rowData[key] = val;
                });
                const row = sheet.addRow(rowData);
                
                // עיצוב שורה בסיסי - זברה
                if (index % 2 === 1) {
                    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Slate 50
                }

                // גבולות עדינים
                row.eachCell((cell) => {
                    cell.border = { bottom: { style: 'dotted', color: { argb: 'FFE2E8F0' } } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                });

                // קולבק לעיצוב מותנה
                if (rowStyleCallback) {
                    rowStyleCallback(row, item);
                }
            });

            // עיצוב עמודות מספרים
            sheet.columns.forEach(col => {
                if (['amount', 'eur', 'shekel', 'dollar', 'bit'].some(k => col.key.toLowerCase().includes(k))) {
                    col.numFmt = '#,##0.00';
                }
            });
            
            // Auto-filter
            sheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: data.length + 1, column: columns.length }
            };
        };

        // 3. הוספת הגיליונות המקוריים עם עיצוב מותנה

        // טבלת הכנסות (TableData)
        addSheet(income, "הכנסות", {
            order_number: "מספר הזמנה",
            customer: "לקוח/ות",
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
        }, (row, item) => {
            // אם יש החזר (סכום שלילי), צבע באדום
            const isNegative = ['eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount'].some(k => parseFloat(item[k] || 0) < 0);
            if (isNegative) {
                row.font = { color: { argb: 'FFDC2626' } }; // Red text
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }; // Light Red BG
            }
        });

        // טבלת הוצאות (Expense)
        addSheet(expenses, "הוצאות", {
            expense_date: "תאריך",
            reason: "סיבה",
            recipient: "עבור מי",
            amount: "סכום",
            currency: "מטבע",
            sales_rep: "נציג",
            notes: "הערות"
        }, (row, item) => {
            // הוצאות תמיד באדום עדין
            // row.font = { color: { argb: 'FFBE123C' } }; 
        });

        // טבלת מכירות בהמתנה (PendingSale)
        addSheet(pendingSales, "מכירות בהמתנה", {
            order_number: "מספר הזמנה",
            customer: "לקוח/ות",
            sales_rep: "נציג",
            eur_amount: "יורו",
            shekel_amount: "שקל",
            dollar_amount: "דולר",
            bit_amount: "ביט",
            envelope_received: "התקבל מעטפה?",
            comments: "הערות"
        }, (row, item) => {
            // אם לא התקבלה מעטפה - אדום, אחרת ירוק
            if (!item.envelope_received) {
                row.getCell('envelope_received').font = { color: { argb: 'FFDC2626' }, bold: true };
            } else {
                row.getCell('envelope_received').font = { color: { argb: 'FF16A34A' }, bold: true };
            }
        });

        // טבלת משימות (Task)
        addSheet(tasks, "משימות", {
            title: "כותרת",
            description: "תיאור",
            status: "סטטוס",
            due_date: "תאריך יעד",
            sales_rep: "נציג אחראי",
            task_type: "סוג משימה",
            amount: "סכום",
            currency: "מטבע"
        }, (row, item) => {
            // סטטוס
            const statusCell = row.getCell('status');
            if (item.status === 'done') {
                statusCell.font = { color: { argb: 'FF16A34A' }, strike: true }; // Green + Strike
                row.font = { color: { argb: 'FF94A3B8' } }; // Gray out entire row
            } else {
                statusCell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
                // תאריך יעד עבר?
                if (item.due_date && new Date(item.due_date) < new Date()) {
                    row.getCell('due_date').font = { color: { argb: 'FFDC2626' }, bold: true };
                }
            }
        });

        // טבלת כספרים (CasparFilling)
        addSheet(caspars, "כספרים", {
            full_name: "שם מלא",
            phone_number: "טלפון",
            hotel: "מלון",
            departure_date: "תאריך עזיבה",
            people_count: "כמות אנשים",
            notification_sent: "התראה נשלחה"
        }, (row, item) => {
            if (item.notification_sent) {
                row.getCell('notification_sent').font = { color: { argb: 'FF16A34A' } };
            } else {
                row.getCell('notification_sent').font = { color: { argb: 'FFDC2626' } };
            }
        });

        // טבלת מיקומי כסף (MoneyLocation)
        addSheet(moneyLocations, "מיקומי כסף", {
            name: "שם המיקום",
            amount: "סכום",
            currency: "מטבע"
        }, (row, item) => {
            row.getCell('amount').font = { bold: true };
        });

        // 4. יצירת גיליון סיכום (טבלת בנק) - עיצוב משופר
        const bankSheet = workbook.addWorksheet("טבלת בנק (סיכום)", {
            views: [{ rightToLeft: true, showGridLines: false }]
        });

        // חישוב סיכומים
        const stats = {
            EUR: { income: 0, expenses: 0 },
            ILS: { income: 0, expenses: 0 },
            USD: { income: 0, expenses: 0 },
            BIT: { income: 0, neto: 0, kishrei: 0 }
        };

        income.forEach(row => {
            stats.EUR.income += parseFloat(row.eur_amount || 0);
            stats.ILS.income += parseFloat(row.shekel_amount || 0);
            stats.USD.income += parseFloat(row.dollar_amount || 0);
            
            const bit = parseFloat(row.bit_amount || 0);
            stats.BIT.income += bit;
            if (row.company === 'נטו פאן') stats.BIT.neto += bit;
            else stats.BIT.kishrei += bit;
        });

        expenses.forEach(row => {
            const amount = parseFloat(row.amount || 0);
            const curr = row.currency || 'EUR';
            if (stats[curr]) stats[curr].expenses += amount;
        });

        // הגדרת רוחב עמודות
        bankSheet.columns = [
            { width: 25 }, // תיאור
            { width: 20 }, // יורו
            { width: 20 }, // שקל
            { width: 20 }, // דולר
            { width: 5 }   // רווח
        ];

        // פונקציית עזר לעיצוב תא כותרת
        const styleHeaderCell = (cell, color = 'FF475569') => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        };

        // פונקציית עזר לעיצוב תא נתונים
        const styleDataCell = (cell, isBold = false, color = null) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            if (isBold) cell.font = { bold: true };
            if (color) cell.font = { ...cell.font, color: { argb: color } };
        };

        // כותרת ראשית
        bankSheet.mergeCells('A1:D2');
        const mainTitle = bankSheet.getCell('A1');
        mainTitle.value = 'דוח סיכום כספי - טבלת בנק';
        mainTitle.font = { bold: true, size: 20, color: { argb: 'FF1E293B' } };
        mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        mainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        // כותרות הטבלה הראשית
        const headerRow = bankSheet.getRow(4);
        headerRow.height = 30;
        
        const headers = ['תיאור', 'יורו (€)', 'שקל (₪)', 'דולר ($)'];
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            styleHeaderCell(cell, 'FF334155'); // Slate 700
        });

        // נתונים - הכנסות
        const incRow = bankSheet.getRow(5);
        incRow.height = 25;
        incRow.getCell(1).value = 'הכנסות';
        styleDataCell(incRow.getCell(1), true);
        
        incRow.getCell(2).value = stats.EUR.income;
        incRow.getCell(3).value = stats.ILS.income;
        incRow.getCell(4).value = stats.USD.income;
        
        [2,3,4].forEach(c => {
            styleDataCell(incRow.getCell(c), true, 'FF16A34A'); // Green
            incRow.getCell(c).numFmt = '#,##0.00';
        });

        // נתונים - הוצאות
        const expRow = bankSheet.getRow(6);
        expRow.height = 25;
        expRow.getCell(1).value = 'הוצאות';
        styleDataCell(expRow.getCell(1), true);

        expRow.getCell(2).value = stats.EUR.expenses;
        expRow.getCell(3).value = stats.ILS.expenses;
        expRow.getCell(4).value = stats.USD.expenses;

        [2,3,4].forEach(c => {
            styleDataCell(expRow.getCell(c), true, 'FFDC2626'); // Red
            expRow.getCell(c).numFmt = '#,##0.00';
        });

        // נתונים - יתרה
        const balRow = bankSheet.getRow(7);
        balRow.height = 35;
        balRow.getCell(1).value = 'יתרה בקופה';
        
        const balEur = stats.EUR.income - stats.EUR.expenses;
        const balIls = stats.ILS.income - stats.ILS.expenses;
        const balUsd = stats.USD.income - stats.USD.expenses;

        balRow.getCell(2).value = balEur;
        balRow.getCell(3).value = balIls;
        balRow.getCell(4).value = balUsd;

        [1,2,3,4].forEach(c => {
            const cell = balRow.getCell(c);
            cell.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } }; // Default Dark Blue
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Default Light Blue
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
            if (c > 1) {
                cell.numFmt = '#,##0.00';
                // אם שלילי - צבע אדום
                if (cell.value < 0) {
                    cell.font = { bold: true, size: 14, color: { argb: 'FFDC2626' } }; // Red
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light Red
                }
            }
        });

        // ביט - אזור נפרד מעוצב
        bankSheet.mergeCells('A10:C10');
        const bitTitle = bankSheet.getCell('A10');
        bitTitle.value = 'סיכום ביט';
        styleHeaderCell(bitTitle, 'FF2563EB'); // Blue 600
        bitTitle.alignment = { horizontal: 'center', vertical: 'middle' };

        const bitLabels = bankSheet.getRow(11);
        bitLabels.getCell(1).value = 'סה"כ ביט';
        bitLabels.getCell(2).value = 'נטו פאן';
        bitLabels.getCell(3).value = 'קשרי תעופה';
        [1,2,3].forEach(c => styleDataCell(bitLabels.getCell(c), true));
        bitLabels.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        const bitValues = bankSheet.getRow(12);
        bitValues.height = 25;
        bitValues.getCell(1).value = stats.BIT.income;
        bitValues.getCell(2).value = stats.BIT.neto;
        bitValues.getCell(3).value = stats.BIT.kishrei;
        [1,2,3].forEach(c => {
            styleDataCell(bitValues.getCell(c), true, 'FF0F172A');
            bitValues.getCell(c).numFmt = '#,##0.00 ₪';
            bitValues.getCell(c).font = { size: 12, bold: true };
        });

        // מיקומי כסף - אזור נפרד
        const locStartRow = 15;
        bankSheet.mergeCells(`A${locStartRow}:C${locStartRow}`);
        const locTitle = bankSheet.getCell(`A${locStartRow}`);
        locTitle.value = 'מיקומי כסף (פירוט)';
        styleHeaderCell(locTitle, 'D97706'); // Amber 600

        const locHeaderRow = bankSheet.getRow(locStartRow + 1);
        ['שם המיקום', 'סכום', 'מטבע'].forEach((h, i) => {
            const cell = locHeaderRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // Light Amber
            cell.alignment = { horizontal: 'center' };
            cell.border = { bottom: { style: 'thin' } };
        });

        moneyLocations.forEach((loc, idx) => {
            const r = bankSheet.getRow(locStartRow + 2 + idx);
            r.getCell(1).value = loc.name;
            r.getCell(2).value = parseFloat(loc.amount || 0);
            r.getCell(3).value = loc.currency;
            
            [1,2,3].forEach(c => {
                const cell = r.getCell(c);
                cell.alignment = { horizontal: 'center' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            });
            r.getCell(2).numFmt = '#,##0.00';
        });

        // 5. העלאה לדרייב (אותו קוד)
        const buffer = await workbook.xlsx.writeBuffer();
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        
        if (!accessToken) {
            return Response.json({ error: "No Google Drive token" }, { status: 400 });
        }

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
        const fileName = `Full_Backup_With_Bank_${dateStr}.xlsx`;
        
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
        return Response.json({ success: true, fileId: (await uploadRes.json()).id });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});