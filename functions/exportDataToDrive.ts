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

        // פונקציית עזר ליצירת גיליון
        const addSheet = (data, sheetName, headers) => {
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
            });

            // הגדרת עמודות
            const columns = Object.keys(headers).map(key => ({
                header: headers[key],
                key: key,
                width: 20
            }));
            
            sheet.columns = columns;

            // עיצוב שורת כותרת
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 20;

            // הוספת הנתונים
            data.forEach(item => {
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
                sheet.addRow(rowData);
            });

            // עיצוב עמודות מספרים
            sheet.columns.forEach(col => {
                if (['amount', 'eur', 'shekel', 'dollar', 'bit'].some(k => col.key.toLowerCase().includes(k))) {
                    col.numFmt = '#,##0.00';
                }
            });
        };

        // 3. הוספת הגיליונות המקוריים
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
        });

        addSheet(expenses, "הוצאות", {
            expense_date: "תאריך",
            reason: "סיבה",
            recipient: "עבור מי",
            amount: "סכום",
            currency: "מטבע",
            sales_rep: "נציג",
            notes: "הערות"
        });

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
        });

        addSheet(tasks, "משימות", {
            title: "כותרת",
            description: "תיאור",
            status: "סטטוס",
            due_date: "תאריך יעד",
            sales_rep: "נציג אחראי",
            task_type: "סוג משימה",
            amount: "סכום",
            currency: "מטבע"
        });

        addSheet(caspars, "כספרים", {
            full_name: "שם מלא",
            phone_number: "טלפון",
            hotel: "מלון",
            departure_date: "תאריך עזיבה",
            people_count: "כמות אנשים",
            notification_sent: "התראה נשלחה"
        });

        addSheet(moneyLocations, "מיקומי כסף", {
            name: "שם המיקום",
            amount: "סכום",
            currency: "מטבע"
        });

        // 4. יצירת גיליון סיכום (טבלת בנק)
        const bankSheet = workbook.addWorksheet("טבלת בנק (סיכום)", {
            views: [{ rightToLeft: true, showGridLines: false }]
        });

        // חישוב סיכומים
        const stats = {
            EUR: { income: 0, expenses: 0 },
            ILS: { income: 0, expenses: 0 }, // מזומן
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

        // עיצוב וטבלה
        bankSheet.getColumn(1).width = 20; // כותרות
        bankSheet.getColumn(2).width = 20; // EUR
        bankSheet.getColumn(3).width = 20; // ILS
        bankSheet.getColumn(4).width = 20; // USD

        // כותרת
        bankSheet.mergeCells('A1:D1');
        const title = bankSheet.getCell('A1');
        title.value = 'סיכום כספי - טבלת בנק';
        title.font = { bold: true, size: 16 };
        title.alignment = { horizontal: 'center' };

        // כותרות עמודות
        const headers = ['תיאור', 'יורו (EUR)', 'שקל (מזומן)', 'דולר (USD)'];
        const headerRow = bankSheet.getRow(3);
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            cell.alignment = { horizontal: 'center' };
            cell.border = { bottom: { style: 'thin' } };
        });

        // נתונים
        const addRow = (label, eur, ils, usd, isBold = false) => {
            const row = bankSheet.addRow([label, eur, ils, usd]);
            row.alignment = { horizontal: 'center' };
            if (isBold) row.font = { bold: true };
            row.getCell(2).numFmt = '#,##0.00 €';
            row.getCell(3).numFmt = '#,##0.00 ₪';
            row.getCell(4).numFmt = '#,##0.00 $';
        };

        addRow('הכנסות', stats.EUR.income, stats.ILS.income, stats.USD.income);
        addRow('הוצאות', stats.EUR.expenses, stats.ILS.expenses, stats.USD.expenses);
        
        // יתרה
        const balanceRow = bankSheet.addRow([
            'יתרה בקופה', 
            stats.EUR.income - stats.EUR.expenses,
            stats.ILS.income - stats.ILS.expenses,
            stats.USD.income - stats.USD.expenses
        ]);
        balanceRow.font = { bold: true };
        balanceRow.alignment = { horizontal: 'center' };
        balanceRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF8FF' } }; // Light blue
        balanceRow.getCell(2).numFmt = '#,##0.00 €';
        balanceRow.getCell(3).numFmt = '#,##0.00 ₪';
        balanceRow.getCell(4).numFmt = '#,##0.00 $';

        // רווח ריק
        bankSheet.addRow([]);
        bankSheet.addRow([]);

        // סיכום ביט
        bankSheet.mergeCells(`A${bankSheet.rowCount + 1}:C${bankSheet.rowCount + 1}`);
        const bitTitle = bankSheet.getCell(`A${bankSheet.rowCount}`);
        bitTitle.value = 'סיכום ביט';
        bitTitle.font = { bold: true, size: 14 };
        bitTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

        const bitHeaders = bankSheet.addRow(['סה"כ ביט', 'נטו פאן', 'קשרי תעופה']);
        bitHeaders.font = { bold: true };
        bitHeaders.alignment = { horizontal: 'center' };

        const bitData = bankSheet.addRow([stats.BIT.income, stats.BIT.neto, stats.BIT.kishrei]);
        bitData.alignment = { horizontal: 'center' };
        bitData.eachCell((cell, colNumber) => {
            cell.numFmt = '#,##0.00 ₪';
        });

        // רווח ריק
        bankSheet.addRow([]);
        bankSheet.addRow([]);

        // מיקומי כסף
        bankSheet.mergeCells(`A${bankSheet.rowCount + 1}:C${bankSheet.rowCount + 1}`);
        const locTitle = bankSheet.getCell(`A${bankSheet.rowCount}`);
        locTitle.value = 'מיקומי כסף (פירוט)';
        locTitle.font = { bold: true, size: 14 };
        locTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };

        const locHeaders = bankSheet.addRow(['שם המיקום', 'סכום', 'מטבע']);
        locHeaders.font = { bold: true };
        
        moneyLocations.forEach(loc => {
            const r = bankSheet.addRow([loc.name, parseFloat(loc.amount || 0), loc.currency]);
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