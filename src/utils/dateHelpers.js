export function getNextEventDate(eventDays, startTimeStr) {
    if (!eventDays || eventDays.length === 0 || !startTimeStr) return null;
    
    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    if (isNaN(startHour) || isNaN(startMin)) return null;

    const now = new Date();
    const sortedDays = [...eventDays].sort((a,b) => a-b);
    
    for (let i = 0; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const dayOfWeek = d.getDay();
        
        if (sortedDays.includes(dayOfWeek)) {
            d.setHours(startHour, startMin, 0, 0);
            
            // האירוע נשאר "האירוע הנוכחי" עד 4 שעות אחרי תחילתו
            const cutoffTime = new Date(d);
            cutoffTime.setHours(cutoffTime.getHours() + 4);
            
            if (now <= cutoffTime) {
                // Return YYYY-MM-DD
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
    }
    
    return null;
}