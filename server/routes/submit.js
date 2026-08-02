/**
 * /api/submit/* — server-side form submissions.
 * Uses the service key so RLS cannot block writes.
 * Slack is fire-and-forget; cron retries any unposted rows.
 */
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const db = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

const SLACK_TOKEN    = () => process.env.SLACK_BOT_TOKEN;
const SLACK_WINS_CH  = () => process.env.SLACK_WINS_CHANNEL;

async function slackPost(channel, blocks, text) {
  try {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_TOKEN()}` },
      body: JSON.stringify({ channel, blocks, text }),
    });
    const d = await r.json();
    return d.ok;
  } catch {
    return false;
  }
}

// ── POST /api/submit/wins ────────────────────────────────────────
router.post('/wins', async (req, res) => {
  const { user_id, user_name, win_1, win_2, win_3, focus_next_week, blocker, week_date, submitted_at } = req.body;
  if (!user_id || !win_1) return res.status(400).json({ error: 'חסרים שדות חובה' });

  // 1. Save to Supabase
  const { data: row, error } = await db.from('sunday_wins').insert({
    user_id, user_name,
    wins: win_1, win_1, win_2, win_3,
    focus_next_week, blocker,
    week_date:    week_date    || new Date().toISOString().slice(0, 10),
    submitted_at: submitted_at || new Date().toISOString(),
  }).select('id').single();

  if (error) {
    console.error('[submit/wins] DB error:', error.message);
    return res.status(500).json({ error: 'שגיאה בשמירה: ' + error.message });
  }

  // 2. Slack — fire and forget (cron retries if fails)
  const ch = SLACK_WINS_CH();
  if (ch && SLACK_TOKEN()) {
    const lines = [
      `*שם*\n${user_name}`,
      win_1 ? `*הנצחון הכי משמעותי מהשבוע שעבר*\n${win_1}` : null,
      win_2 ? `*הנצחון ה-2 הכי משמעותי*\n${win_2}` : null,
      win_3 ? `*הנצחון ה-3 הכי משמעותי*\n${win_3}` : null,
      focus_next_week ? `*מה הדבר האחד הבא שאני הולך להתמקד בו בשבוע הקרוב*\n${focus_next_week}` : null,
      blocker ? `*מה הדבר האחד שחוסם אותך כרגע?*\n${blocker}` : null,
      `*תאריך:*\n${week_date || ''}`,
    ].filter(Boolean).join('\n\n');

    const ok = await slackPost(ch, [{ type: 'section', text: { type: 'mrkdwn', text: lines } }], `נצחונות שבועיים — ${user_name}`);
    if (ok && row?.id) {
      await db.from('sunday_wins').update({ slack_posted_at: new Date().toISOString() }).eq('id', row.id);
    }
  }

  res.json({ ok: true, id: row?.id });
});

// ── POST /api/submit/deal ────────────────────────────────────────
router.post('/deal', async (req, res) => {
  const { user_id, user_name, total_amount, received_amount, next_rank, notes, deal_date } = req.body;
  if (!user_id || !total_amount) return res.status(400).json({ error: 'חסרים שדות חובה' });

  const date = deal_date || new Date().toISOString().slice(0, 10);

  const { data: row, error } = await db.from('deals').insert({
    user_id, user_name,
    amount:          parseFloat(total_amount),
    total_amount:    parseFloat(total_amount),
    received_amount: parseFloat(received_amount) || 0,
    next_rank:       next_rank || null,
    notes:           notes || null,
    created_at:      date + 'T12:00:00.000Z',
  }).select('id').single();

  if (error) {
    console.error('[submit/deal] DB error:', error.message);
    return res.status(500).json({ error: 'שגיאה בשמירה: ' + error.message });
  }

  // Slack
  if (SLACK_TOKEN()) {
    const RANK_META = {
      'TRAINEE': '', 'CREW': '⚪ CREW / בחודש ₪5K', 'SECOND OFFICER': '🟡 SECOND OFFICER / בחודש ₪10K',
      'CO-PILOT': '🔵 CO-PILOT / בחודש ₪15K', 'CAPTAIN': '🟢 CAPTAIN / בחודש ₪20K', 'EXPERT': '🟣 EXPERT / בחודש ₪30K',
    };
    const lines = [
      '🎉🏆 !!!אליפותתתתממממ',
      `\nהאגדה:  ${user_name}`,
      `\n*סה"כ סכום העסקה כולל:*\n${Number(total_amount).toLocaleString()}₪`,
      `*כסף שנכנס בפועל:*\n${received_amount ? Number(received_amount).toLocaleString() + '₪' : '0₪'}`,
      next_rank ? `*הדרגה הבאה שאני מגיע אליה:*\n${RANK_META[next_rank] || next_rank}` : null,
      notes ? `*פרטים:*\n${notes}` : null,
      date,
    ].filter(Boolean).join('\n');

    const ok = await slackPost('cha-ching', [{ type: 'section', text: { type: 'mrkdwn', text: lines } }], `עסקה חדשה — ${user_name}`);
    if (ok && row?.id) {
      await db.from('deals').update({ slack_posted_at: new Date().toISOString() }).eq('id', row.id);
    }
  }

  res.json({ ok: true, id: row?.id });
});

// ── POST /api/submit/monthly ─────────────────────────────────────
router.post('/monthly', async (req, res) => {
  const { user_id, payload, existing_id, pending_upgrade } = req.body;
  if (!user_id || !payload) return res.status(400).json({ error: 'חסרים שדות חובה' });

  let error;
  if (existing_id) {
    ({ error } = await db.from('monthly_submissions').update(payload).eq('id', existing_id));
  } else {
    ({ error } = await db.from('monthly_submissions').insert({ user_id, ...payload }));
  }

  if (error) {
    console.error('[submit/monthly] DB error:', error.message);
    return res.status(500).json({ error: 'שגיאה בשמירה: ' + error.message });
  }

  if (pending_upgrade) {
    await db.from('rank_upgrade_requests').insert({ ...pending_upgrade, status: 'pending' }).catch(() => {});
  }

  res.json({ ok: true });
});

export default router;
