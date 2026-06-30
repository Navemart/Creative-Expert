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
import cronRouter            from './routes/cron.js';

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
app.use('/api/cron',          cronRouter);

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

// ── Local-dev cron only ────────────────────────────────────────
// On Vercel, in-process timers like node-cron don't reliably fire because
// serverless functions don't stay alive between requests. In production,
// Vercel's native Cron Jobs (see vercel.json "crons") hit the /api/cron/*
// routes on schedule instead. These node-cron blocks exist purely so the
// same jobs still run automatically when developing locally with `npm run dev`.
if (!process.env.VERCEL) {
  if (process.env.NOTION_TOKEN) {
    cron.schedule('0 3 * * *', async () => {
      try {
        const { syncAllNotionSummaries } = await import('./routes/zoom.js');
        const count = await syncAllNotionSummaries();
        console.log(`[cron] Synced ${count} new summaries from Notion`);
      } catch (e) {
        console.error('[cron] Notion sync error:', e.message);
      }
    });
    console.log('  ⏰  Notion nightly sync scheduled locally (03:00)');
  }

  cron.schedule('0 6 * * *', async () => {
    try {
      const { dailyRefreshAll } = await import('./routes/instagram-apify.js');
      const count = await dailyRefreshAll();
      console.log(`[cron] Instagram refresh done — ${count} profiles updated`);
    } catch (e) {
      console.error('[cron] Instagram refresh error:', e.message);
    }
  });
  console.log('  ⏰  Instagram daily refresh scheduled locally (06:00)');

  cron.schedule('0 9 * * *', async () => {
    try {
      const { retrySlackPosts } = await import('./routes/cron.js');
      await retrySlackPosts();
    } catch (e) {
      console.error('[cron] Slack retry error:', e.message);
    }
  });
  console.log('  ⏰  Slack retry scheduled locally (09:00)');

  cron.schedule('0 4 * * *', async () => {
    try {
      const { runDbBackup } = await import('./routes/cron.js');
      await runDbBackup();
    } catch (e) {
      console.error('[cron] Backup error:', e.message);
    }
  });
  console.log('  ⏰  Daily DB backup scheduled locally (04:00)');
} else {
  console.log('  ⏰  Running on Vercel — cron jobs handled by vercel.json (see /api/cron/*)');
}
