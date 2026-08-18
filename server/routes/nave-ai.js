import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

// Fetch student context from Supabase
async function getStudentContext(userId) {
  if (!userId) return '';

  const [profileRes, submissionsRes, pipelineRes] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('full_name, business_name, niche, goal, monthly_target')
      .eq('clerk_user_id', userId)
      .single(),
    supabase
      .from('monthly_submissions')
      .select('month, total_income, total_new_deals, new_clients, active_clients, software_expenses, variable_expenses, paid_ads')
      .eq('clerk_user_id', userId)
      .order('month', { ascending: false })
      .limit(6),
    supabase
      .from('pipeline_deals')
      .select('title, stage, value, contact_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const profile = profileRes.data;
  const submissions = submissionsRes.data || [];
  const pipeline = pipelineRes.data || [];

  let ctx = '';
  if (profile) {
    ctx += `## פרטי תלמיד\nשם: ${profile.full_name || '—'}\nעסק: ${profile.business_name || '—'}\nנישה: ${profile.niche || '—'}\nיעד חודשי: ₪${profile.monthly_target || '—'}\n\n`;
  }
  if (submissions.length) {
    ctx += `## נתונים חודשיים (6 חודשים אחרונים)\n`;
    submissions.forEach(s => {
      const expenses =
        (s.software_expenses || 0) + (s.variable_expenses || 0) + (s.paid_ads || 0);
      const profit = (s.total_income || 0) - expenses;
      ctx += `- ${s.month?.slice(0, 7)}: הכנסה ₪${s.total_income || 0}, עסקאות ${s.total_new_deals || 0}, רווח נקי ₪${profit}\n`;
    });
    ctx += '\n';
  }
  if (pipeline.length) {
    ctx += `## Pipeline נוכחי\n`;
    pipeline.forEach(d => {
      ctx += `- ${d.title || d.contact_name}: שלב ${d.stage}, ₪${d.value || 0}\n`;
    });
  }

  return ctx;
}

// POST /api/nave-ai/chat
router.post('/chat', async (req, res) => {
  const { messages, agentId, userId } = req.body;
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  // Fetch agent system prompt from gpt_tools table
  let agentSystemPrompt = '';
  let agentName = 'NaveAI';
  if (agentId) {
    const { data } = await supabase
      .from('gpt_tools')
      .select('name, system_prompt, description')
      .eq('id', agentId)
      .single();
    if (data) {
      agentName = data.name;
      agentSystemPrompt = data.system_prompt || '';
    }
  }

  // Build student context
  const studentContext = await getStudentContext(userId);

  const systemPrompt = [
    agentSystemPrompt || `אתה NaveAI — עוזר חכם של Nave Branding. אתה עונה בעברית, מקצועי, ישיר ותמציתי.`,
    studentContext ? `\n## הנתונים של התלמיד\n${studentContext}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[nave-ai] Anthropic error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'שגיאה בתקשורת עם ה-AI' })}\n\n`);
    res.end();
  }
});

// GET /api/nave-ai/agents — return agents from gpt_tools
router.get('/agents', async (_req, res) => {
  const { data, error } = await supabase
    .from('gpt_tools')
    .select('id, name, description, category, category_label, sort_order')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

export default router;
