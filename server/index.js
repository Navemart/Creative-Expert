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
