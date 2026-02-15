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