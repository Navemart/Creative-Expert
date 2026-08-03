/**
 * /api/submit/* — server-side form submissions.
 *
 * SLACK SAFETY RULES:
 * 1. Before every Slack post — re-read the row from DB.
 *    If slack_posted_at is already set → skip (already posted, never double-post).
 * 2. Deals: posted once immediately on submit. No auto-retry ever.
 *    If Slack fails → slack_failed_at is set so admin sees an alert.
 * 3. Wins: posted once immediately. Cron may retry within 24h only.
 */
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const db = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

const SLACK_TOKEN   = () => process.env.SLACK_BOT_TOKEN;
const SLACK_WINS_CH = () => process.env.SLACK_WINS_CHANNEL;

const RANK_META = {
  'TRAINEE': '', 'CREW': '⚪ CREW / בחודש ₪5K', 'SECOND OFFICER': '🟡 SECOND OFFICER / בחודש ₪10K',
  'CO-PILOT': '🔵 CO-PILOT / בחודש ₪15K', 'CAPTAIN': '🟢 CAPTAIN / בחודש ₪20K', 'EXPERT': '🟣 EXPERT / בחודש ₪30K',
};

/**
 * Post to Slack — returns true on success.
 * Always re-reads `table/id` first to confirm slack_posted_at is still NULL.
 * This is the single gate that prevents double-posting.
 */
async function safeSlackPost({ table, id, channel, blocks, text }) {
  if (!SLACK_TOKEN() || !channel) return false;

  // ── Gate: re-read from DB right before posting ──────────────
  const { data: fresh } = await db.from(table).select('slack_posted_at').eq('id', id).single();
  if (fresh?.slack_posted_at) {
    console.log(`[slack] ${table}/${id} already posted — skipping`);
    return false;
  }

  try {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_TOKEN()}` },
      body: JSON.stringify({ channel, blocks, text }),
    });
    const d = await r.json();
    if (d.ok) {
      await db.from(table).update({ slack_posted_at: new Date().toISOString(), slack_failed_at: null }).eq('id', id);
      return true;
    }
    console.error(`[slack] postMessage failed for ${table}/${id}:`, d.error);
    return false;
  } catch (e) {
    console.error(`[slack] network error for ${table}/${id}:`, e.message);
    return false;
  }
}

// ── POST /api/submit/wins ────────────────────────────────────────
router.post('/wins', async (req, res) => {
  const { user_id, user_name, win_1, win_2, win_3, focus_next_week, blocker, week_date, submitted_at } = req.body;
  if (!user_id || !win_1) return res.status(400).json({ error: 'חסרים שדות חובה' });

  // 1. Save to DB
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

  // 2. Try Slack immediately — cron may retry within 24h if this fails
  const lines = [
    `*שם*\n${user_name}`,
    win_1 ? `*הנצחון הכי משמעותי מהשבוע שעבר*\n${win_1}` : null,
    win_2 ? `*הנצחון ה-2 הכי משמעותי*\n${win_2}` : null,
    win_3 ? `*הנצחון ה-3 הכי משמעותי*\n${win_3}` : null,
    focus_next_week ? `*מה הדבר האחד הבא שאני הולך להתמקד בו בשבוע הקרוב*\n${focus_next_week}` : null,
    blocker ? `*מה הדבר האחד שחוסם אותך כרגע?*\n${blocker}` : null,
    `*תאריך:*\n${week_date || ''}`,
  ].filter(Boolean).join('\n\n');

  const winsOk = await safeSlackPost({
    table: 'sunday_wins', id: row.id,
    channel: SLACK_WINS_CH(),
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines } }],
    text: `נצחונות שבועיים — ${user_name}`,
  });

  // If Slack failed → mark so admin sees an alert (no auto-retry)
  if (!winsOk) {
    await db.from('sunday_wins').update({ slack_failed_at: new Date().toISOString() }).eq('id', row.id);
  }

  res.json({ ok: true, id: row.id, slack_ok: winsOk });
});

// ── POST /api/submit/deal ────────────────────────────────────────
router.post('/deal', async (req, res) => {
  const { user_id, user_name, total_amount, received_amount, next_rank, notes, deal_date } = req.body;
  if (!user_id || !total_amount) return res.status(400).json({ error: 'חסרים שדות חובה' });

  const date = deal_date || new Date().toISOString().slice(0, 10);

  // 1. Save to DB
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

  // 2. Try Slack once — NO auto-retry ever for deals.
  //    If fails → slack_failed_at is set → admin sees alert → manual post button.
  const lines = [
    '🎉🏆 !!!אליפותתתתממממ',
    `\nהאגדה:  ${user_name}`,
    `\n*סה"כ סכום העסקה כולל:*\n${Number(total_amount).toLocaleString()}₪`,
    `*כסף שנכנס בפועל:*\n${received_amount ? Number(received_amount).toLocaleString() + '₪' : '0₪'}`,
    next_rank ? `*הדרגה הבאה שאני מגיע אליה:*\n${RANK_META[next_rank] || next_rank}` : null,
    notes ? `*פרטים:*\n${notes}` : null,
    date,
  ].filter(Boolean).join('\n');

  const slackOk = await safeSlackPost({
    table: 'deals', id: row.id,
    channel: 'cha-ching',
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines } }],
    text: `עסקה חדשה — ${user_name}`,
  });

  // If Slack failed → mark so admin sees an alert
  if (!slackOk) {
    await db.from('deals').update({ slack_failed_at: new Date().toISOString() }).eq('id', row.id);
  }

  res.json({ ok: true, id: row.id, slack_ok: slackOk });
});

// ── POST /api/submit/deal/:id/post-slack (manual admin retry) ───
router.post('/deal/:id/post-slack', async (req, res) => {
  const { id } = req.params;

  const { data: deal, error } = await db.from('deals').select('*').eq('id', id).single();
  if (error || !deal) return res.status(404).json({ error: 'עסקה לא נמצאה' });

  const lines = [
    '🎉🏆 !!!אליפותתתתממממ',
    `\nהאגדה:  ${deal.user_name}`,
    `\n*סה"כ סכום העסקה כולל:*\n${Number(deal.total_amount).toLocaleString()}₪`,
    `*כסף שנכנס בפועל:*\n${deal.received_amount ? Number(deal.received_amount).toLocaleString() + '₪' : '0₪'}`,
    deal.next_rank ? `*הדרגה הבאה שאני מגיע אליה:*\n${RANK_META[deal.next_rank] || deal.next_rank}` : null,
    deal.notes ? `*פרטים:*\n${deal.notes}` : null,
    (deal.created_at || '').slice(0, 10),
  ].filter(Boolean).join('\n');

  const ok = await safeSlackPost({
    table: 'deals', id,
    channel: 'cha-ching',
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines } }],
    text: `עסקה חדשה — ${deal.user_name}`,
  });

  if (!ok) return res.status(500).json({ error: 'שגיאת Slack' });
  res.json({ ok: true });
});

// ── POST /api/submit/wins/:id/post-slack (manual admin retry) ───
router.post('/wins/:id/post-slack', async (req, res) => {
  const { id } = req.params;

  const { data: w, error } = await db.from('sunday_wins').select('*').eq('id', id).single();
  if (error || !w) return res.status(404).json({ error: 'נצחון לא נמצא' });

  const lines = [
    `*שם*\n${w.user_name}`,
    w.win_1 ? `*הנצחון הכי משמעותי מהשבוע שעבר*\n${w.win_1}` : null,
    w.win_2 ? `*הנצחון ה-2 הכי משמעותי*\n${w.win_2}` : null,
    w.win_3 ? `*הנצחון ה-3 הכי משמעותי*\n${w.win_3}` : null,
    w.focus_next_week ? `*מה הדבר האחד הבא שאני הולך להתמקד בו בשבוע הקרוב*\n${w.focus_next_week}` : null,
    w.blocker ? `*מה הדבר האחד שחוסם אותך כרגע?*\n${w.blocker}` : null,
    `*תאריך:*\n${w.week_date || ''}`,
  ].filter(Boolean).join('\n\n');

  const ok = await safeSlackPost({
    table: 'sunday_wins', id,
    channel: SLACK_WINS_CH(),
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines } }],
    text: `נצחונות שבועיים — ${w.user_name}`,
  });

  if (!ok) return res.status(500).json({ error: 'שגיאת Slack' });
  res.json({ ok: true });
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
