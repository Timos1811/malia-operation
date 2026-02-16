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
                    // המרת תאריכים
                    if (key.includes('date') && val) {
                        // המרה פשוטה למחרוזת תאריך אם צריך, או השארת הערך
                        // ExcelJS מטפל בזה טוב אם זה אובייקט Date, אבל מה-DB מגיע string
                        // נשאיר כ-string אלא אם נרצה לפרמט
                    }
                    // המרת מספרים
                    if (['amount', 'people_count', 'nights', 'price_eur', 'buyers_count', 'scanned_count', 'eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount'].some(k => key.includes(k))) {
                        const num = parseFloat(val);
                        val = isNaN(num) ? 0 : num;
                    }
                    // המרת בוליאני
                    if (typeof val === 'boolean') {
                        val = val ? 'כן' : 'לא';
                    }
                    
                    rowData[key] = val;
                });
                sheet.addRow(rowData);
            });

            // עיצוב עמודות מספרים ותאריכים
            sheet.columns.forEach(col => {
                if (['amount', 'eur', 'shekel', 'dollar', 'bit'].some(k => col.key.toLowerCase().includes(k))) {
                    col.numFmt = '#,##0.00';
                }
            });
        };

        // 3. הגדרת העמודות לכל טבלה והוספת הגיליונות
        
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
        });

        // טבלת כספרים (CasparFilling)
        addSheet(caspars, "כספרים", {
            full_name: "שם מלא",
            phone_number: "טלפון",
            hotel: "מלון",
            departure_date: "תאריך עזיבה",
            people_count: "כמות אנשים",
            notification_sent: "התראה נשלחה"
        });

        // טבלת מיקומי כסף (MoneyLocation)
        addSheet(moneyLocations, "מיקומי כסף", {
            name: "שם המיקום",
            amount: "סכום",
            currency: "מטבע"
        });

        // 4. העלאה לדרייב
        const buffer = await workbook.xlsx.writeBuffer();
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        
        if (!accessToken) {
            return Response.json({ error: "No Google Drive token. Please authorize Google Drive in the app." }, { status: 400 });
        }

        const folderName = "אקסל";
        let folderId = null;
        
        // חיפוש או יצירת תיקייה
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
        const fileName = `Full_Backup_${dateStr}.xlsx`;
        
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