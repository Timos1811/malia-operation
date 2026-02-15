import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Fetch Data (Limit 1000 most recent records per entity)
        const [income, expenses, pendingSales, tasks, caspars] = await Promise.all([
            base44.asServiceRole.entities.TableData.list('-created_date', 1000),
            base44.asServiceRole.entities.Expense.list('-created_date', 1000),
            base44.asServiceRole.entities.PendingSale.list('-created_date', 1000),
            base44.asServiceRole.entities.Task.list('-created_date', 1000),
            base44.asServiceRole.entities.CasparFilling.list('-created_date', 1000)
        ]);

        // 2. Create Workbook
        const wb = XLSX.utils.book_new();

        // Helper to add sheet if data exists
        const addSheet = (data, name) => {
            if (data && data.length > 0) {
                // Remove internal fields for cleaner export
                const cleanData = data.map(item => {
                    const { id, created_by, updated_date, ...rest } = item;
                    return rest;
                });
                const ws = XLSX.utils.json_to_sheet(cleanData);
                XLSX.utils.book_append_sheet(wb, ws, name);
            } else {
                // Add empty sheet with headers if possible, or just skip
                const ws = XLSX.utils.json_to_sheet([{info: "אין נתונים"}]);
                XLSX.utils.book_append_sheet(wb, ws, name);
            }
        };

        addSheet(income, "הכנסות");
        addSheet(expenses, "הוצאות");
        addSheet(pendingSales, "מכירות בהמתנה");
        addSheet(tasks, "משימות");
        addSheet(caspars, "כספרים");

        // 3. Write to Buffer
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        // 4. Upload to Google Drive
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        
        if (!accessToken) {
            console.error("No Google Drive token available. Please re-authorize.");
            return Response.json({ error: "No Google Drive access token found" }, { status: 400 });
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Backup_Data_${dateStr}.xlsx`;

        // Multipart Upload Metadata
        const metadata = {
            name: fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

        const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: formData
        });

        if (!driveRes.ok) {
            const errText = await driveRes.text();
            throw new Error(`Drive Upload Failed: ${errText}`);
        }

        const driveData = await driveRes.json();

        return Response.json({ success: true, fileId: driveData.id, fileName });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});