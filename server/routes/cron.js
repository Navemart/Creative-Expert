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

// Slack retry is intentionally disabled.
// Deals and wins are posted once on submit via /api/submit/*.
// If Slack fails → slack_failed_at is set → admin sees alert → manual post button.
// The cron no longer touches Slack to prevent flooding.
export async function retrySlackPosts() {
  return { skipped: true, reason: 'manual-only mode' };
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

// ── Zoom upcoming meetings daily sync (07:00) ─────────────────
router.get('/zoom-upcoming-sync', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { syncUpcomingMeetings } = await import('./zoom.js');
    const count = await syncUpcomingMeetings();
    console.log(`[cron] Zoom upcoming sync done — ${count} meetings cached`);
    res.json({ ok: true, count });
  } catch (e) {
    console.error('[cron] Zoom upcoming sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
