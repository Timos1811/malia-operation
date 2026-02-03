import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all wristbands (up to 1000)
        const wristbands = await base44.entities.Wristband.list('-created_date', 1000);
        
        let updatedCount = 0;
        let skippedCount = 0;
        const updates = [];

        // Find wristbands that need fixing
        const toFix = wristbands.filter(wb => wb.nfc_id && wb.nfc_id.includes(':'));

        for (const wb of toFix) {
            const newId = wb.nfc_id.replace(/:/g, '');
            
            // Check if cleaned ID already exists to avoid duplicates
            const existing = await base44.entities.Wristband.filter({ nfc_id: newId });
            
            if (existing.length > 0 && existing[0].id !== wb.id) {
                skippedCount++;
                continue;
            }

            // Update
            updates.push(base44.entities.Wristband.update(wb.id, { nfc_id: newId }));
            updatedCount++;
        }

        // Run updates in parallel
        await Promise.all(updates);

        return Response.json({ 
            success: true,
            totalScanned: wristbands.length,
            foundToFix: toFix.length,
            updated: updatedCount,
            skipped: skippedCount
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});