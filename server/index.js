import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import healthRouter from './routes/health.js';
import membersRouter from './routes/members.js';
import contentRouter from './routes/content.js';
import analyticsRouter from './routes/analytics.js';
import slackRouter from './routes/slack.js';
import transcriptionsRouter from './routes/transcriptions.js';
import instagramRouter     from './routes/instagram.js';
import facebookRouter     from './routes/facebook.js';
import zoomRouter         from './routes/zoom.js';
import authRouter         from './routes/auth.js';
import adminRouter           from './routes/admin.js';
import instagramApifyRouter  from './routes/instagram-apify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check — handy for deploys and uptime monitors.
app.use('/health', healthRouter);

// Placeholder API. Swap these out for real Supabase queries
// when you wire up the database (see CLAUDE.md).
app.use('/api/members', membersRouter);
app.use('/api/content', contentRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/slack', slackRouter);
app.use('/api/transcriptions', transcriptionsRouter);
app.use('/api/instagram',     instagramRouter);
app.use('/api/facebook',      facebookRouter);
app.use('/api/zoom',          zoomRouter);
app.use('/api/auth',          authRouter);
app.use('/api/admin',         adminRouter);
app.use('/api/instagram-apify', instagramApifyRouter);

// -----------------------------------------------------------------------------
// In production, serve the built frontend from /dist so everything runs on one
// port. In dev, Vite handles the frontend and proxies /api here.
// -----------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Only listen when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  API server listening on http://localhost:${PORT}\n`);
  });
}

export default app;

// ── Nightly Notion sync ───────────────────────────────────────
// Every night at 03:00 — fetch Notion summaries for any new recordings
// that don't yet have a cached summary_he in zoom-meta.json
// Requires: NOTION_TOKEN in .env
if (process.env.NOTION_TOKEN) {
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('[cron] Starting nightly Notion summary sync...');
      // Dynamic import to avoid circular deps; zoom router exports the helpers
      const { syncAllNotionSummaries } = await import('./routes/zoom.js');
      if (typeof syncAllNotionSummaries === 'function') {
        const count = await syncAllNotionSummaries();
        console.log(`[cron] Synced ${count} new summaries from Notion`);
      }
    } catch (e) {
      console.error('[cron] Notion sync error:', e.message);
    }
  });
  console.log('  ⏰  Notion nightly sync scheduled (03:00)');
}

// ── Daily Instagram refresh (all connected profiles) ──────────
// Every day at 06:00 — refresh all users who have a connected Apify Instagram profile
cron.schedule('0 6 * * *', async () => {
  try {
    console.log('[cron] Starting daily Instagram refresh...');
    const { dailyRefreshAll } = await import('./routes/instagram-apify.js');
    if (typeof dailyRefreshAll === 'function') {
      const count = await dailyRefreshAll();
      console.log(`[cron] Instagram refresh done — ${count} profiles updated`);
    }
  } catch (e) {
    console.error('[cron] Instagram refresh error:', e.message);
  }
});
console.log('  ⏰  Instagram daily refresh scheduled (06:00)');

// ── Slack retry — unposted wins & deals ───────────────────────
// Every day at 09:00 — retry any wins/deals from last 48h not posted to Slack
cron.schedule('0 9 * * *', async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
    const token   = process.env.SLACK_BOT_TOKEN;
    const winsCh  = process.env.SLACK_WINS_CHANNEL;
    const dealsCh = 'cha-ching';
    if (!token) return;

    const since = new Date(Date.now() - 48 * 3600000).toISOString();

    // Retry unposted wins
    const { data: wins } = await sb.from('sunday_wins').select('*').is('slack_posted_at', null).gte('created_at', since);
    for (const w of wins || []) {
      const lines = [`האגדה: ${w.user_name || 'תלמיד'}`, w.win_1, w.win_2, w.win_3, w.focus_next_week, w.blocker].filter(Boolean).join('\n\n');
      const r = await fetch('https://slack.com/api/chat.postMessage', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ channel: winsCh, text: lines }) });
      const d = await r.json();
      if (d.ok) await sb.from('sunday_wins').update({ slack_posted_at: new Date().toISOString() }).eq('id', w.id);
    }
    if (wins?.length) console.log(`[cron] Retried ${wins.length} unposted wins`);

    // Retry unposted deals
    const { data: deals } = await sb.from('deals').select('*').is('slack_posted_at', null).gte('created_at', since);
    for (const d of deals || []) {
      const text = `🎉🏆 !!!אליפותתתתממממ\nהאגדה: ${d.user_name || 'תלמיד'}\nסכום: ₪${Number(d.total_amount||0).toLocaleString()}\nדרגה: ${d.next_rank||''}`;
      const r = await fetch('https://slack.com/api/chat.postMessage', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ channel: dealsCh, text }) });
      const rd = await r.json();
      if (rd.ok) await sb.from('deals').update({ slack_posted_at: new Date().toISOString() }).eq('id', d.id);
    }
    if (deals?.length) console.log(`[cron] Retried ${deals.length} unposted deals`);
  } catch (e) {
    console.error('[cron] Slack retry error:', e.message);
  }
});
console.log('  ⏰  Slack retry scheduled (09:00)');
