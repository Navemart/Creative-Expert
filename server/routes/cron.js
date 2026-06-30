// ── Vercel Cron endpoints ─────────────────────────────────────
// Vercel serverless functions don't keep a process alive, so in-process
// node-cron timers (used for local dev) never reliably fire in production.
// Vercel's native Cron Jobs feature instead makes an HTTP GET to these
// routes on schedule (see vercel.json "crons"), which works correctly
// because Vercel itself invokes the function fresh each time.

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow (dev convenience)
  return req.headers['authorization'] === `Bearer ${secret}`;
}

function sb() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
}

// ── Instagram daily refresh (06:00) ───────────────────────────
router.get('/instagram-refresh', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { dailyRefreshAll } = await import('./instagram-apify.js');
    const count = await dailyRefreshAll();
    console.log(`[cron] Instagram refresh done — ${count} profiles updated`);
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[cron] Instagram refresh error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Notion nightly summary sync (03:00) ───────────────────────
router.get('/notion-sync', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.NOTION_TOKEN) return res.json({ ok: true, skipped: true });
  try {
    const { syncAllNotionSummaries } = await import('./zoom.js');
    const count = await syncAllNotionSummaries();
    console.log(`[cron] Synced ${count} new summaries from Notion`);
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[cron] Notion sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Slack retry — unposted wins & deals (09:00) ───────────────
router.get('/slack-retry', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await retrySlackPosts();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] Slack retry error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export async function retrySlackPosts() {
  const db      = sb();
  const token   = process.env.SLACK_BOT_TOKEN;
  const winsCh  = process.env.SLACK_WINS_CHANNEL;
  const dealsCh = 'cha-ching';
  if (!token) return { skipped: true };

  const since     = new Date(Date.now() - 72 * 3600000).toISOString();
  const clerkKey  = process.env.CLERK_SECRET_KEY;

  async function getClerkName(userId) {
    if (!clerkKey) return null;
    try {
      const r = await fetch(`https://api.clerk.com/v1/users/${userId}`, { headers: { Authorization: `Bearer ${clerkKey}` } });
      const u = await r.json();
      return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || null;
    } catch { return null; }
  }

  let winsCount = 0, dealsCount = 0;

  const { data: wins } = await db.from('sunday_wins').select('*').is('slack_posted_at', null).gte('created_at', since);
  for (const w of wins || []) {
    const name  = w.user_name || await getClerkName(w.user_id) || 'תלמיד';
    const lines = [
      `*שם*\n${name}`,
      w.win_1           ? `*הנצחון הכי משמעותי מהשבוע שעבר*\n${w.win_1}` : null,
      w.win_2           ? `*הנצחון ה-2 הכי משמעותי*\n${w.win_2}` : null,
      w.win_3           ? `*הנצחון ה-3 הכי משמעותי*\n${w.win_3}` : null,
      w.focus_next_week ? `*מה הדבר האחד הבא שאני הולך להתמקד בו בשבוע הקרוב*\n${w.focus_next_week}` : null,
      w.blocker         ? `*מה הדבר האחד שחוסם אותך כרגע*\n${w.blocker}` : null,
      `*תאריך:*\n${w.week_date || ''}`,
    ].filter(Boolean).join('\n\n');
    const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: lines } }];
    const r = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ channel: winsCh, blocks, text: `נצחונות שבועיים — ${name}` }) });
    const d = await r.json();
    if (d.ok) { await db.from('sunday_wins').update({ slack_posted_at: new Date().toISOString(), user_name: name }).eq('id', w.id); winsCount++; }
  }

  const { data: deals } = await db.from('deals').select('*').is('slack_posted_at', null).gte('created_at', since);
  for (const deal of deals || []) {
    const name = deal.user_name || await getClerkName(deal.user_id) || 'תלמיד';
    const text = `🎉🏆 !!!אליפותתתתממממ\nהאגדה: ${name}\nסכום: ₪${Number(deal.total_amount || 0).toLocaleString()}\nדרגה: ${deal.next_rank || ''}`;
    const r = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ channel: dealsCh, text }) });
    const rd = await r.json();
    if (rd.ok) { await db.from('deals').update({ slack_posted_at: new Date().toISOString(), user_name: name }).eq('id', deal.id); dealsCount++; }
  }

  console.log(`[cron] Slack retry — ${winsCount} wins, ${dealsCount} deals posted`);
  return { winsCount, dealsCount };
}

// ── Daily DB backup (04:00) ────────────────────────────────────
router.get('/db-backup', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await runDbBackup();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] Backup error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const BACKUP_TABLES = ['zoom_meta', 'monthly_submissions', 'deals', 'sunday_wins', 'routine_tasks'];

export async function runDbBackup() {
  const db = sb();
  let backed = 0;
  for (const table of BACKUP_TABLES) {
    const { data, error } = await db.from(table).select('*');
    if (error) { console.error(`[cron] backup read error (${table}):`, error.message); continue; }
    await db.from('db_backups').insert({ table_name: table, snapshot: data || [] });
    backed++;
  }
  const cutoff = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
  await db.from('db_backups').delete().lt('created_at', cutoff);
  console.log(`[cron] Backed up ${backed} tables`);
  return { tablesBackedUp: backed };
}

export default router;
