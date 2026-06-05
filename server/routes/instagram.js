/**
 * Instagram API — OAuth + data fetching
 *
 * Uses "Instagram API with Instagram Login" (Meta's current recommended approach).
 * Requires a Business or Creator Instagram account.
 *
 * Env vars needed (.env):
 *   INSTAGRAM_APP_ID        — Meta App ID
 *   INSTAGRAM_APP_SECRET    — Meta App Secret
 *   INSTAGRAM_REDIRECT_URI  — e.g. http://localhost:3001/api/instagram/callback
 *   APP_URL                 — Frontend URL  e.g. http://localhost:5173
 *
 * Supabase table (run once):
 * ─────────────────────────────────────────────────────────────
 *  create table instagram_connections (
 *    id               uuid primary key default gen_random_uuid(),
 *    user_id          text not null unique,
 *    ig_user_id       text not null,
 *    username         text,
 *    access_token     text not null,
 *    token_expires_at timestamptz,
 *    created_at       timestamptz default now(),
 *    updated_at       timestamptz default now()
 *  );
 *  alter table instagram_connections enable row level security;
 *  create policy "open" on instagram_connections
 *    for all using (true) with check (true);
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  : null;

const APP_ID       = process.env.INSTAGRAM_APP_ID;
const APP_SECRET   = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3001/api/instagram/callback';
const APP_URL      = process.env.APP_URL || 'http://localhost:5173';

// ── Helper: fetch with timeout ────────────────────────────────
async function igFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

// ── Helper: load connection row ───────────────────────────────
async function getConn(userId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('instagram_connections')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data || null;
}

// ── GET /api/instagram/connect?userId=... ─────────────────────
// Redirects the browser to Instagram's OAuth consent screen.
router.get('/connect', (req, res) => {
  const { userId } = req.query;
  if (!userId)  return res.status(400).json({ error: 'חסר userId' });
  if (!APP_ID)  return res.status(400).json({ error: 'INSTAGRAM_APP_ID לא מוגדר ב-.env' });

  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  const scope = 'instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_comments,instagram_business_content_publish';

  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id',     APP_ID);
  url.searchParams.set('redirect_uri',  REDIRECT_URI);
  url.searchParams.set('scope',         scope);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state',         state);

  res.redirect(url.toString());
});

// ── GET /api/instagram/callback ───────────────────────────────
// Instagram redirects here after the user grants / denies permission.
router.get('/callback', async (req, res) => {
  const { code, state, error: igError } = req.query;

  const frontendContent = `${APP_URL}/content`;

  if (igError) {
    return res.redirect(`${frontendContent}?ig=error&reason=${encodeURIComponent(igError)}`);
  }
  if (!code || !state) {
    return res.redirect(`${frontendContent}?ig=error&reason=missing_params`);
  }

  let userId;
  try {
    userId = JSON.parse(Buffer.from(state, 'base64').toString()).userId;
  } catch {
    return res.redirect(`${frontendContent}?ig=error&reason=invalid_state`);
  }

  try {
    // 1. Exchange code → short-lived token
    const shortData = await igFetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     APP_ID,
        client_secret: APP_SECRET,
        grant_type:    'authorization_code',
        redirect_uri:  REDIRECT_URI,
        code,
      }).toString(),
    });

    if (!shortData.access_token) {
      console.error('Instagram short token error:', shortData);
      return res.redirect(`${frontendContent}?ig=error&reason=token_exchange`);
    }

    const igUserId = shortData.user_id?.toString() || '';

    // 2. Exchange short-lived → long-lived token (60 days)
    const ltData = await igFetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${shortData.access_token}`
    );
    const accessToken = ltData.access_token || shortData.access_token;
    const expiresIn   = ltData.expires_in   || 5184000; // default 60 days

    // 3. Fetch basic profile to get username
    const profile = await igFetch(
      `https://graph.instagram.com/me?fields=id,username,followers_count,media_count&access_token=${accessToken}`
    );

    // 4. Save / update token in Supabase
    if (supabase) {
      await supabase.from('instagram_connections').upsert({
        user_id:          userId,
        ig_user_id:       profile.id || igUserId,
        username:         profile.username || '',
        access_token:     accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    res.redirect(`${frontendContent}?ig=connected`);
  } catch (err) {
    console.error('Instagram callback error:', err);
    res.redirect(`${frontendContent}?ig=error&reason=server_error`);
  }
});

// ── GET /api/instagram/status?userId=... ─────────────────────
router.get('/status', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'חסר userId' });

  const conn = await getConn(userId);
  if (!conn)  return res.json({ connected: false });

  res.json({ connected: true, username: conn.username, ig_user_id: conn.ig_user_id });
});

// ── GET /api/instagram/profile?userId=... ─────────────────────
router.get('/profile', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'חסר userId' });

  const conn = await getConn(userId);
  if (!conn)  return res.json({ connected: false });

  try {
    const fields = 'id,username,followers_count,media_count,profile_picture_url,biography,website';
    const profile = await igFetch(
      `https://graph.instagram.com/me?fields=${fields}&access_token=${conn.access_token}`
    );

    if (profile.error) {
      // Token likely expired
      return res.json({ connected: false, expired: true, error: profile.error.message });
    }

    res.json({ connected: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/instagram/media?userId=...&limit=12 ─────────────
router.get('/media', async (req, res) => {
  const { userId, limit = 12 } = req.query;
  if (!userId) return res.status(400).json({ error: 'חסר userId' });

  const conn = await getConn(userId);
  if (!conn)  return res.json({ connected: false, data: [] });

  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink,play_count,views';
    const data = await igFetch(
      `https://graph.instagram.com/me/media?fields=${fields}&limit=${limit}&access_token=${conn.access_token}`
    );

    if (data.error) return res.json({ connected: true, data: [] });

    res.json({ connected: true, data: data.data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/instagram/media-reach?userId=...&ids=id1,id2,... ─
// Fetches per-post reach from the media insights endpoint.
// Requires instagram_business_manage_insights (works in dev for testers).
router.get('/media-reach', async (req, res) => {
  const { userId, ids } = req.query;
  if (!userId || !ids) return res.status(400).json({ error: 'missing params' });

  const conn = await getConn(userId);
  if (!conn) return res.json({ available: false, reachMap: {} });

  const mediaIds = String(ids).split(',').filter(Boolean).slice(0, 30);

  try {
    const rows = await Promise.all(
      mediaIds.map(id =>
        igFetch(
          `https://graph.instagram.com/${id}/insights?metric=reach&access_token=${conn.access_token}`
        ).then(r => {
          if (r.error) return { id, reach: null };
          // v20+ returns total_value; older returns values[0].value
          const reach =
            r.data?.[0]?.total_value?.value ??
            r.data?.[0]?.values?.[0]?.value ??
            null;
          return { id, reach };
        }).catch(() => ({ id, reach: null }))
      )
    );

    const hasAny = rows.some(r => r.reach != null);
    if (!hasAny) return res.json({ available: false, reachMap: {} });

    const reachMap = Object.fromEntries(rows.map(r => [r.id, r.reach]));
    res.json({ available: true, reachMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/instagram/media-plays?userId=...&ids=id1,id2,... ─
// Fetches per-post play count (views) for VIDEO/REEL posts via insights.
router.get('/media-plays', async (req, res) => {
  const { userId, ids } = req.query;
  if (!userId || !ids) return res.status(400).json({ error: 'missing params' });

  const conn = await getConn(userId);
  if (!conn) return res.json({ available: false, playsMap: {} });

  const mediaIds = String(ids).split(',').filter(Boolean).slice(0, 30);

  try {
    const rows = await Promise.all(
      mediaIds.map(id =>
        igFetch(
          `https://graph.instagram.com/${id}/insights?metric=plays,views&access_token=${conn.access_token}`
        ).then(r => {
          if (r.error) {
            // Try single metric fallback
            return igFetch(
              `https://graph.instagram.com/${id}/insights?metric=plays&access_token=${conn.access_token}`
            ).then(r2 => {
              if (r2.error) return { id, plays: null };
              const plays =
                r2.data?.[0]?.total_value?.value ??
                r2.data?.[0]?.values?.[0]?.value ?? null;
              return { id, plays };
            }).catch(() => ({ id, plays: null }));
          }
          const playsItem = r.data?.find(d => d.name === 'plays' || d.name === 'views');
          const plays =
            playsItem?.total_value?.value ??
            playsItem?.values?.[0]?.value ?? null;
          return { id, plays };
        }).catch(() => ({ id, plays: null }))
      )
    );

    const hasAny = rows.some(r => r.plays != null);
    if (!hasAny) return res.json({ available: false, playsMap: {} });

    const playsMap = Object.fromEntries(rows.map(r => [r.id, r.plays]));
    res.json({ available: true, playsMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/instagram/insights?userId=...&days=30 ───────────
// Returns follower_count delta per day + reach/impressions totals.
// Requires instagram_business_manage_insights — gracefully returns
// { insightsAvailable: false } if the permission hasn't been granted yet.
router.get('/insights', async (req, res) => {
  const { userId, days = 30 } = req.query;
  if (!userId) return res.status(400).json({ error: 'חסר userId' });

  const conn = await getConn(userId);
  if (!conn)  return res.json({ connected: false });

  try {
    const since = Math.floor((Date.now() - Number(days) * 86400_000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const base  = `https://graph.instagram.com/${conn.ig_user_id}/insights`;

    // Follower count over time (daily delta)
    const followerData = await igFetch(
      `${base}?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${conn.access_token}`
    );

    if (followerData.error) {
      // No insights permission — return flag so UI can degrade gracefully
      return res.json({ connected: true, insightsAvailable: false });
    }

    // Reach (28 days) — "impressions" removed in newer Meta API versions
    const reachData = await igFetch(
      `${base}?metric=reach,views&period=days_28&access_token=${conn.access_token}`
    );

    const followerValues = followerData.data?.[0]?.values || [];

    // Instagram Graph API v16+ returns total_value.value for aggregated metrics.
    // Older versions used values[0].value. Support both formats.
    // Also handles period=day arrays by summing all daily values.
    function extractMetric(dataArr, name) {
      const item = dataArr?.find(d => d.name === name);
      if (!item) return 0;
      // New format: { total_value: { value: N } }
      if (item.total_value?.value != null) return item.total_value.value;
      // Old format single value: { values: [{ value: N }] }
      if (item.values?.length === 1) return item.values[0]?.value ?? 0;
      // Daily array — sum all values
      if (item.values?.length > 1) return item.values.reduce((s, v) => s + (v.value || 0), 0);
      return 0;
    }

    const reach       = extractMetric(reachData.data, 'reach');
    const impressions = extractMetric(reachData.data, 'views'); // views replaces impressions

    res.json({
      connected:         true,
      insightsAvailable: true,
      followerTimeline:  followerValues,   // [{ value, end_time }, ...]
      reach,
      impressions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/instagram/competitor?userId=...&username=... ─────
// Uses Instagram Business Discovery API to fetch a public Business/Creator profile.
// With Instagram Login tokens, use GET /me on graph.instagram.com (NOT /{ig-user-id}).
// Requires instagram_business_basic permission.
router.get('/competitor', async (req, res) => {
  const { userId, username } = req.query;
  if (!userId || !username) return res.status(400).json({ error: 'missing params' });

  const conn = await getConn(userId);
  if (!conn) return res.json({ connected: false });

  try {
    const mediaFields   = 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink';
    const profileFields = `id,username,biography,followers_count,media_count,profile_picture_url,website,media{${mediaFields}}`;

    // Business Discovery API with Instagram Login:
    //   - Host:  graph.instagram.com
    //   - Path:  /me  (NOT /{ig-user-id})
    //   - Token: Instagram user access token
    const url = new URL('https://graph.instagram.com/v21.0/me');
    url.searchParams.set('fields',       `business_discovery.fields(${profileFields})`);
    url.searchParams.set('username',     username.replace(/^@/, ''));
    url.searchParams.set('access_token', conn.access_token);

    const data = await igFetch(url.toString());
    console.log('Business Discovery response:', JSON.stringify(data).slice(0, 400));

    if (data.error) {
      console.error('Business Discovery error:', JSON.stringify(data.error));
      return res.json({ found: false, error: data.error.message, code: data.error.code });
    }

    const biz = data.business_discovery;
    if (!biz) return res.json({ found: false, error: 'לא נמצא משתמש' });

    res.json({
      found:   true,
      profile: {
        id:                  biz.id,
        username:            biz.username,
        biography:           biz.biography,
        followers_count:     biz.followers_count,
        media_count:         biz.media_count,
        profile_picture_url: biz.profile_picture_url,
        website:             biz.website,
      },
      media: biz.media?.data || [],
    });
  } catch (err) {
    console.error('competitor error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/instagram/disconnect?userId=... ───────────────
router.delete('/disconnect', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'חסר userId' });

  if (supabase) {
    await supabase.from('instagram_connections').delete().eq('user_id', userId);
  }
  res.json({ success: true });
});

export default router;
