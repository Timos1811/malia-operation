import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { question, user_id, user_role, user_name } = await req.json();
    if (!question) return Response.json({ error: 'Question is required' }, { status: 400 });

    const isAdmin = user_role === 'admin';

    // Fetch all relevant data in parallel
    const [income, expenses, tasks, wristbands, pendingSales, caspars, moneyLocations] = await Promise.all([
      supabase.from('table_data').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(500),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('wristbands').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('pending_sales').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('caspar_fillings').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('money_locations').select('*'),
    ]);

    // For non-admin: filter to own data only
    const myIncome = isAdmin
      ? income.data || []
      : (income.data || []).filter((r: { sales_rep?: string }) => r.sales_rep === user_name);
    const myExpenses = isAdmin
      ? expenses.data || []
      : (expenses.data || []).filter((r: { sales_rep?: string }) => r.sales_rep === user_name);

    // Pre-calculate per-rep stats (admin only)
    let repsStats = {};
    if (isAdmin && income.data) {
      const stats: Record<string, {
        total_income_eur: number; total_customers: number;
        full_refunds: number; partial_refunds: number;
        withdrawals: number; groups_count: number;
      }> = {};
      for (const row of income.data) {
        const rep = row.sales_rep || 'לא ידוע';
        if (!stats[rep]) stats[rep] = { total_income_eur: 0, total_customers: 0, full_refunds: 0, partial_refunds: 0, withdrawals: 0, groups_count: 0 };
        stats[rep].total_income_eur += parseFloat(row.eur_amount || '0');
        stats[rep].total_customers += 1;
        stats[rep].groups_count += 1;
      }
      repsStats = stats;
    }

    const dataset = {
      income: myIncome,
      expenses: myExpenses,
      tasks: tasks.data || [],
      wristbands: wristbands.data || [],
      pending_sales: pendingSales.data || [],
      caspars: caspars.data || [],
      money_locations: moneyLocations.data || [],
      ...(isAdmin ? { reps_stats: repsStats } : {}),
    };

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const systemPrompt = isAdmin
      ? `אתה עוזר אנליטיקה לניהול אירועים. יש לך גישה לכל הנתונים של העסק. ענה בעברית, תהיה ספציפי ומועיל.`
      : `אתה עוזר אנליטיקה לנציג מכירות בשם ${user_name}. הנתונים שלך מסוננים לפי ההזמנות שלך בלבד. ענה בעברית.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `נתונים: ${JSON.stringify(dataset)}\n\nשאלה: ${question}`,
      }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';
    return Response.json({ answer });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
