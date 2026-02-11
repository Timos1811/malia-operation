import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Secrets
        const idInstance = Deno.env.get("GREEN_API_ID_INSTANCE");
        const apiTokenInstance = Deno.env.get("GREEN_API_API_TOKEN_INSTANCE");
        const targetPhone = Deno.env.get("GREEN_API_PHONE_NUMBER");

        if (!idInstance || !apiTokenInstance || !targetPhone) {
            return Response.json({ error: "Missing Green API secrets" }, { status: 500 });
        }

        // Get today's day index (0 = Sunday, 1 = Monday, etc.)
        // Note: Deno deploy might be in UTC. We need Israel time.
        // Israel is UTC+2 or UTC+3. 
        // Best to use a library or simple offset. 
        // Let's assume the user set the automation for 13:00 Israel time.
        // But here we need to know "what day is it in Israel right now".
        
        const israelTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
        const todayIndex = new Date(israelTime).getDay(); 

        // Fetch recurring tasks
        // We have to fetch all recurring tasks and filter by day because query by array containment might vary
        // or we can try to filter if the DB supports it, but filtering in code is safer for small datasets.
        const recurringTasks = await base44.asServiceRole.entities.Task.filter({ 
            is_recurring: true 
        });

        // Filter for tasks that run today
        const todaysTasks = recurringTasks.filter(task => 
            task.recurring_days && task.recurring_days.includes(todayIndex)
        );

        if (todaysTasks.length === 0) {
            return Response.json({ message: "No recurring tasks for today" });
        }

        // Construct message
        let message = `*משימות קבועות להיום (${new Date(israelTime).toLocaleDateString('he-IL')}):*\n\n`;
        
        todaysTasks.forEach((task, index) => {
            message += `${index + 1}. *${task.title}*\n`;
            if (task.description) message += `   ${task.description}\n`;
            message += `\n`;
        });

        // Send to Green API
        const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: `${targetPhone}@c.us`,
                message: message
            })
        });
        
        const result = await response.json();
        
        return Response.json({ 
            success: true, 
            tasks_count: todaysTasks.length, 
            green_api_result: result 
        });

    } catch (error) {
        console.error("Error sending recurring notifications:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});