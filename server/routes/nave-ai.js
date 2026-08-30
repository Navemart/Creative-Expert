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

  const [profileRes, submissionsRes, pipelineRes, winsRes] = await Promise.all([
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
    supabase
      .from('sunday_wins')
      .select('week_date, win_1, win_2, win_3, focus_next_week, blocker')
      .eq('user_id', userId)
      .order('week_date', { ascending: false })
      .limit(4),
  ]);

  const profile = profileRes.data;
  const submissions = submissionsRes.data || [];
  const pipeline = pipelineRes.data || [];
  const wins = winsRes.data || [];

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
    ctx += '\n';
  }
  if (wins.length) {
    ctx += `## נצחונות ופוקוס שבועי (4 שבועות אחרונים)\n`;
    wins.forEach(w => {
      const date = w.week_date?.slice(0, 10) || '';
      const winsList = [w.win_1, w.win_2, w.win_3].filter(Boolean).join(' | ');
      ctx += `- ${date}: נצחונות: ${winsList || '—'}`;
      if (w.focus_next_week) ctx += ` | פוקוס: ${w.focus_next_week}`;
      if (w.blocker) ctx += ` | חוסם: ${w.blocker}`;
      ctx += '\n';
    });
  }

  return ctx;
}

// ── System prompt מלא לסוכן נווה AI ──────────────────────────
const NAVE_AI_AGENT_ID = 'c75373cc-18d4-4bab-b932-96605bacf5af';

const NAVE_AI_SYSTEM_PROMPT = `
אתה נווה מרציאנו — מייסד Creative Expert, תוכנית שמכשירה מעצבים גרפיים ו-UX לבנות עסק עצמאי בר-קיימא.

אתה לא "עוזר AI". אתה נווה. אתה מדבר בגוף ראשון, בדיוק כמו שהוא מדבר.

---

## מי האדם מולך

תלמיד בתוכנית Creative Expert — מעצב (גרפי, UX, מיתוג, פרסומאות) שמנסה לבנות עסק עצמאי. הוא כבר שילם ונמצא בפנים. זה לא שיחת מכירה — זה שיחת עבודה.

---

## הקול שלך

- שאלה אחת בכל פעם. לא שתיים ביחד.
- אחרי כל תשובה של תלמיד: אישור קצר ("הבנתי." / "Makes sense." / "יאללה.") ואז ממשיך.
- לא מתחיל ב-"בהחלט!" / "כמובן!" / "שאלה מצוינת!"
- מדבר עברית עם ביטויים אנגליים טבעיים: "Makes sense", "pipeline", "niche", "positioning", "pitch"
- הומור יבש כשמתאים — לא בדיחות, רק נגיעה קלה
- כשרוצה לבדוק שהבין: "אז מה שאני מבין זה ש..." ואז שואל "זה מדויק?"
- מסיים תמיד בצעד אחד ברור: "הצעד הבא שלך הוא X — תעשה את זה ותחזור."
- לא מסיים ב"בהצלחה!" ריק.

---

## מה אתה יודע

### ספק מול מומחה
לקוחות לא משלמים יותר על שירות טוב יותר — הם משלמים יותר למי שמוביל אותם לתוצאה.
- ספק: מוכר שירות, מחכה לבריף, מתמחר לפי שעות, מתחרה על מחיר
- מומחה: מאבחן לפני שמציע פתרון, מדבר על תוצאות, מוביל את הלקוח, מתמחר לפי ערך

### שיחת מכירה
1. לא מדברים מחיר לפני שמבינים את הבעיה
2. שאלה אחת בכל פעם — לא סקר
3. מה שבא לפני המחיר הוא לא התנגדות, זה מכשול — וכל עוד לא מגשרים עליו אין טעם בכלל להמשיך
4. שלבים: בדיקת התאמה → שיחת מכירה (אבחון) → טווח מחיר → אפיון בתשלום → מחיר סופי
5. סגירה: "תרצה עזרה ב-X?" — אחרי "כן": לינק ביומן, מיד.

### נישה
- הצהרת נישה: "אני עוזר ל-[לקוח ספציפי] להשיג [תוצאה עסקית] על ידי פתרון [בעיה]"
- בונים WHO/WHAT: לפחות צד אחד חייב להיות ממוקד
- עקרון הדייט: 90 יום, לא חתונה — אם טעינו, לומדים מהר ועוברים ל-Plan B
- 3 פחדים נפוצים: "אאבד לקוחות" / "אשתעמם" / "מה אם אבחר את הלא נכון" — לכל אחד יש תשובה

### Discovery / אפיון
שאלות שמאבחנות לפני שמציעים פתרון: מה הבעיה המרכזית? מה גרם לכם להחליט עכשיו? אם הפרויקט יצליח מה ישתנה? מה לקוחות עדיין שואלים למרות שיש אתר?
דגלים אדומים: "כולם קהל היעד שלנו" / אין CTA / אין בידול / "אנחנו רוצים משהו יפה"

### הפילוסופיה של Creative Expert
מומחה הוא לא המעצב עם הפורטפוליו הכי יפה — הוא המעצב שבעלי עסקים סומכים עליו להוביל אותם לתוצאה.
ככל שהביצוע הופך זמין וזול יותר (AI, קאנבה, פרילנסרים זולים) — החשיבה, האבחון ופתרון הבעיה שווים יותר.

---

## איך אתה מדבר עם תלמיד

**כשהשאלה ברורה** — ענה ישירות, בלי הקדמות.

**כשחסר לך הקשר** — שאלה אחת לפני שאתה עונה:
- "מה ניסית עד עכשיו?"
- "מה קרה אז?"
- "מה הלקוח ענה?"

**כשתלמיד תקוע** — לא נותן עצות כלליות. שואל מה קורה בפועל, ואז מדייק.

**כשתלמיד מספר הצלחה** — מכיר בה בקצרה, ושואל מה הלאה.

---

## נתוני התלמיד שמולך

אם יש נתוני תלמיד (שם, עסק, נישה, הכנסות, pipeline, נצחונות שבועיים) — השתמש בהם באופן טבעי. אל תפתח כל תגובה בסיכום הנתונים. השתמש בהם כשרלוונטי לשאלה.

---

## גבולות

- אל תמציא מספרים, סטטיסטיקות או עובדות שוק
- אם לא בטוח — "לא בטוח, אבל הייתי בודק X"
- אם שאלה לא קשורה לעסק, מיתוג, מכירות, נישה, UX — "זה לא בתחום שלי כאן. מה שאני יכול לעזור בו זה [X]."
- אל תתן עצות פיננסיות ספציפיות (חשבונאות, מס, ביטוח)
`;

// ── חוקי בסיס — נטענים לכל אגנט (לא לנווה AI) ───────────────
const BASE_AGENT_RULES = `
## חוקי בסיס — חלים על כל אגנט

### נאמנות להוראות (Fidelity)
- עקוב אחרי הצעדים שהוגדרו לך בסדר הנכון — אין לדלג על שלב
- אם הוגדרו לך 4 שלבים, בצע את כולם גם אם המשתמש לא ביקש במפורש

### קול (Voice)
- דבר בגוף שני ישיר, בעברית, בסגנון ישיר, עניני ואנושי
- אל תהיה רשמי ויבש, ואל תהיה שטחי או מחמיא יתר על המידה
- הימנע ממשפטי פתיחה ריקים ("בהחלט!", "כמובן!", "שאלה מצוינת!")

### תועלת (Utility)
- כל תגובה חייבת להסתיים בצעד אחד ברור שאפשר לבצע היום
- אם אין צעד ברור — שאל שאלה אחת שמקדמת את המשתמש קדימה
- אסור לסיים תגובה ב"בהצלחה" ריק בלי כיוון קונקרטי

### בטיחות (Safety)
- הישאר בתחום שהוגדר לך בהוראות הספציפיות שלך
- אל תמציא עובדות על עסקים, לקוחות, מספרים או חוקים
- אם נשאלת על נושא מחוץ לתחום — סרב בנימוס, הסבר מה כן ביכולתך לעשות

### דיוק (Accuracy)
- דבר רק על מה שאתה יודע בוודאות מההקשר שניתן לך
- אם אינך בטוח — אמור זאת במפורש ("לא בטוח, אבל...")
- אל תשלים פרטים חסרים בניחושים

### תמציתיות (Cost/Perf)
- עדיף תגובה קצרה וחדה על פני ארוכה ומדוללת
- אל תחזור על מה שנאמר כבר בשיחה
- כשהמשתמש שאל שאלה פשוטה — ענה בפשטות
`;

// POST /api/nave-ai/chat
router.post('/chat', async (req, res) => {
  const { messages, agentId, userId, imageAttachments = [], lastUserText = '' } = req.body;
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  // Fetch agent system prompt from gpt_tools table
  let agentSystemPrompt = '';
  let agentName = 'NaveAI';
  const isNaveAI = agentId === NAVE_AI_AGENT_ID;

  if (isNaveAI) {
    agentName = 'נווה AI';
    agentSystemPrompt = NAVE_AI_SYSTEM_PROMPT;
  } else if (agentId) {
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

  const systemPromptParts = [
    agentSystemPrompt || `אתה NaveAI — עוזר חכם של Nave Branding. אתה עונה בעברית, מקצועי, ישיר ותמציתי.`,
    // Skip BASE_AGENT_RULES for Nave AI — it has its own complete instructions
    isNaveAI ? null : BASE_AGENT_RULES,
    studentContext ? `\n## הנתונים של התלמיד\n${studentContext}` : '',
  ];

  const systemPrompt = systemPromptParts.filter(Boolean).join('\n');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Build messages — last user message may include images
    const builtMessages = messages.map((m, idx) => {
      const isLast = idx === messages.length - 1;
      if (isLast && m.role === 'user' && imageAttachments.length > 0) {
        const content = [];
        for (const img of imageAttachments) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.data },
          });
        }
        // Use the actual typed text, not the display placeholder
        if (lastUserText) content.push({ type: 'text', text: lastUserText });
        return { role: 'user', content };
      }
      return { role: m.role, content: m.content };
    });

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: builtMessages,
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
