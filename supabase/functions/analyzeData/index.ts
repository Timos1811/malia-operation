import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { question, type } = await req.json();
    if (!question) return Response.json({ error: 'Question is required' }, { status: 400 });

    let data: unknown[] = [];
    let entityName = '';

    if (type === 'expenses') {
      const { data: rows } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .limit(500);
      data = rows || [];
      entityName = 'הוצאות';
    } else if (type === 'income') {
      const { data: rows } = await supabase
        .from('table_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      data = rows || [];
      entityName = 'הכנסות/הזמנות';
    } else {
      return Response.json({ error: 'Invalid type' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `אתה עוזר אנליטיקה לעסק.
נתונים (${entityName}): ${JSON.stringify(data)}
שאלה: ${question}
ענה בעברית בצורה תמציתית ומדויקת.`,
      }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';
    return Response.json({ answer });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
