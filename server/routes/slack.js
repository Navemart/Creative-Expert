import express from 'express';

const router = express.Router();

const RANK_META = {
  'TRAINEE':        { emoji: '',   amount: '₪0'   },
  'CREW':           { emoji: '⚪', amount: '₪5K'  },
  'SECOND OFFICER': { emoji: '🟡', amount: '₪10K' },
  'CO-PILOT':       { emoji: '🔵', amount: '₪15K' },
  'CAPTAIN':        { emoji: '🟢', amount: '₪20K' },
  'EXPERT':         { emoji: '🟣', amount: '₪30K' },
};

router.post('/wins', async (req, res) => {
  const { name, win_1, win_2, win_3, focus_next_week, blocker, date } = req.body;

  const token   = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_WINS_CHANNEL;

  if (!token || !channel) {
    return res.status(500).json({ error: 'Slack לא מוגדר' });
  }

  // בנה את ההודעה בפורמט זהה ל-Airtable
  const lines = [
    `*שם*\n${name}`,
    win_1          ? `*הנצחון הכי משמעותי מהשבוע שעבר*\n${win_1}` : null,
    win_2          ? `*הנצחון ה-2 הכי משמעותי*\n${win_2}` : null,
    win_3          ? `*הנצחון ה-3 הכי משמעותי*\n${win_3}` : null,
    focus_next_week ? `*מה הדבר האחד הבא שאני הולך להתמקד בו בשבוע הקרוב*\n${focus_next_week}` : null,
    blocker        ? `*מה הדבר האחד שחוסם אותך כרגע? מה אתה יכול לשאול אותי כדי לפתור את זה*\n${blocker}` : null,
    `*תאריך:*\n${date}`,
  ].filter(Boolean);

  const text = lines.join('\n\n');

  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, blocks, text: `נצחונות שבועיים — ${name}` }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack error:', data.error);
      return res.status(500).json({ error: data.error });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Slack fetch error:', err);
    res.status(500).json({ error: 'שגיאה בשליחה לסלאק' });
  }
});

router.post('/deals', async (req, res) => {
  const { name, total_amount, received_amount, next_rank, notes, date } = req.body;

  const token   = process.env.SLACK_BOT_TOKEN;
  const channel = 'cha-ching';

  if (!token) return res.status(500).json({ error: 'Slack לא מוגדר' });

  const fields = [
    `*שם*\n${name}`,
    total_amount    ? `*סה"כ סכום העסקה*\n₪${Number(total_amount).toLocaleString()}` : null,
    received_amount ? `*כסף שנכנס בפועל*\n₪${Number(received_amount).toLocaleString()}` : null,
    next_rank       ? `*הדרגה הבאה*\n${RANK_META[next_rank]?.emoji ? RANK_META[next_rank].emoji + ' ' : ''}${next_rank} · ${RANK_META[next_rank]?.amount ?? ''}` : null,
    notes           ? `*פרטים נוספים*\n${notes}` : null,
    `*תאריך:*\n${date}`,
  ].filter(Boolean);

  const lines = fields;

  const text = lines.join('\n\n');

  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, blocks, text: `עסקה חדשה — ${name}` }),
    });

    const data = await response.json();
    if (!data.ok) return res.status(500).json({ error: data.error });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשליחה לסלאק' });
  }
});

router.post('/rank-upgrade', async (req, res) => {
  const { name, current_rank, proposed_rank, avg_income } = req.body;
  const token   = process.env.SLACK_BOT_TOKEN;
  const channel = 'level-ups';

  if (!token) return res.status(500).json({ error: 'Slack לא מוגדר' });

  const newMeta = RANK_META[proposed_rank] || {};
  const oldMeta = RANK_META[current_rank]  || {};

  const text = [
    `🎉 *עליית דרגה!* 🎉`,
    `*שם התלמיד:* ${name}`,
    `*מהדרגה:* ${oldMeta.emoji ? oldMeta.emoji + ' ' : ''}${current_rank}`,
    `*לדרגה:* ${newMeta.emoji ? newMeta.emoji + ' ' : ''}*${proposed_rank}* · ${newMeta.amount || ''}`,
    `*ממוצע הכנסה שהביא לשדרוג:* ₪${Number(avg_income || 0).toLocaleString()}`,
    `מזל טוב! 🚀`,
  ].join('\n');

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        channel,
        text,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }],
      }),
    });
    const data = await response.json();
    if (!data.ok) return res.status(500).json({ error: data.error });
    res.json({ ok: true });
  } catch (err) {
    console.error('Slack rank-upgrade error:', err);
    res.status(500).json({ error: 'שגיאה בשליחה לסלאק' });
  }
});

export default router;
