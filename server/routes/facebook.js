/**
 * Facebook Login — OAuth flow for Business Discovery API access
 *
 * Env vars needed:
 *   INSTAGRAM_APP_ID        — Meta App ID (same as Instagram)
 *   INSTAGRAM_APP_SECRET    — Meta App Secret (same as Instagram)
 *   FB_REDIRECT_URI         — e.g. https://xxx.ngrok-free.app/api/facebook/callback
 *   APP_URL                 — Frontend URL e.g. http://localhost:5173
 *
 * Supabase table (run once):
 * ─────────────────────────────────────────────────────────────
 *  create table facebook_connections (
 *    id               uuid primary key default gen_random_uuid(),
 *    user_id          text not null unique,
 *    access_token     text not null,
 *    ig_user_id       text not null,
 *    created_at       timestamptz default now(),
 *    updated_at       timestamptz default now()
 *  );
 *  alter table facebook_connections enable row level security;
 *  create policy "open" on facebook_connections
 *    for all using (true) with check (true);
 * ─────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  : null;

const APP_ID      = process.env.FACEBOOK_APP_ID;       // Main Meta App ID (for Facebook Login)
const CONFIG_ID   = process.env.FACEBOOK_CONFIG_ID;    // Facebook Login for Business config ID
const APP_SECRET  = process.env.FACEBOOK_APP_SECRET;   // Main Meta app secret
const REDIRECT_URI = process.env.FB_REDIRECT_URI
  || 'http://localhost:3001/api/facebook/callback';
const APP_URL     = process.env.APP_URL || 'http://localhost:5173';

async function fbFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

async function getFbConn(userId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('facebook_connections')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data || null;
}

// ── GET /api/facebook/connect?userId=... ──────────────────────
router.get('/connect', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  if (!APP_ID)  return res.status(400).json({ error: 'FACEBOOK_APP_ID לא מוגדר' });

  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id',     APP_ID);
  url.searchParams.set('redirect_uri',  REDIRECT_URI);
  url.searchParams.set('scope',         'pages_show_list');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state',         state);

  res.redirect(url.toString());
});

// ── GET /api/facebook/callback ────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error: fbError } = req.query;
  const frontendContent = `${APP_URL}/content`;

  if (fbError) return res.redirect(`${frontendContent}?fb=error&reason=${encodeURIComponent(fbError)}`);
  if (!code || !state) return res.redirect(`${frontendContent}?fb=error&reason=missing_params`);

  let userId;
  try {
    userId = JSON.parse(Buffer.from(state, 'base64').toString()).userId;
  } catch {
    return res.redirect(`${frontendContent}?fb=error&reason=invalid_state`);
  }

  try {
    // 1. Exchange code → short-lived User token
    const tokenData = await fbFetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?client_id=${APP_ID}&client_secret=${APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${code}`
    );

    if (!tokenData.access_token) {
      console.error('FB token exchange error:', tokenData);
      return res.redirect(`${frontendContent}?fb=error&reason=token_exchange`);
    }

    // 2. Exchange short-lived → long-lived User token (60 days)
    const ltData = await fbFetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}` +
      `&fb_exchange_token=${tokenData.access_token}`
    );
    const userToken = ltData.access_token || tokenData.access_token;

    // 3. Get IG Business Account ID — try Facebook Pages first (correct namespace for Business Discovery)
    let igUserId = null;

    // Step A: Facebook Pages → instagram_business_account (most reliable path)
    const pagesData = await fbFetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${userToken}`
    );
    console.log('FB pages:', JSON.stringify(pagesData).slice(0, 300));

    for (const page of (pagesData.data || [])) {
      const igData = await fbFetch(
        `https://graph.facebook.com/v21.0/${page.id}` +
        `?fields=instagram_business_account&access_token=${page.access_token}`
      );
      if (igData.instagram_business_account?.id) {
        igUserId = igData.instagram_business_account.id;
        console.log('IG Business Account ID from Pages:', igUserId);
        break;
      }
    }

    // Step B: instagram_accounts on /me (Instagram connected to personal FB profile)
    if (!igUserId) {
      const meData = await fbFetch(
        `https://graph.facebook.com/v21.0/me?fields=instagram_accounts{id,username}&access_token=${userToken}`
      );
      const igAccounts = meData.instagram_accounts?.data || [];
      if (igAccounts.length > 0) {
        igUserId = igAccounts[0].id;
        console.log('IG Account ID from instagram_accounts:', igUserId);
      }
    }

    // Step C: Fall back to stored Instagram connection (last resort)
    if (!igUserId && supabase) {
      const { data: igConn } = await supabase
        .from('instagram_connections')
        .select('ig_user_id')
        .eq('user_id', userId)
        .single();
      igUserId = igConn?.ig_user_id || null;
      if (igUserId) console.log('IG user ID from instagram_connections (fallback):', igUserId);
    }

    if (!igUserId) {
      console.log('No IG user ID found anywhere');
      return res.redirect(`${frontendContent}?fb=error&reason=no_ig_account`);
    }

    console.log('Using IG user ID:', igUserId);

    // 5. Save to Supabase (store Page token — works best for Business Discovery)
    if (supabase) {
      const { error: sbErr } = await supabase.from('facebook_connections').upsert({
        user_id:      userId,
        access_token: userToken,
        ig_user_id:   igUserId,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (sbErr) console.error('Supabase save error:', sbErr);
      else console.log('Supabase save OK');
    }

    res.redirect(`${frontendContent}?fb=connected`);
  } catch (err) {
    console.error('Facebook callback error:', err);
    res.redirect(`${frontendContent}?fb=error&reason=server_error`);
  }
});

// ── GET /api/facebook/status?userId=... ───────────────────────
router.get('/status', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  const conn = await getFbConn(userId);
  res.json({ connected: !!conn });
});

// ── DELETE /api/facebook/disconnect?userId=... ────────────────
router.delete('/disconnect', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  if (supabase) {
    await supabase.from('facebook_connections').delete().eq('user_id', userId);
  }
  res.json({ success: true });
});

// ── helper: get Facebook-side IG Business Account ID ──────────
async function getFbIgUserId(conn) {
  // Debug: what can this token see?
  const meData = await fbFetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name,accounts{id,name,instagram_business_account{id,username}},instagram_accounts{id,username}&access_token=${conn.access_token}`
  );
  console.log('FB /me debug:', JSON.stringify(meData).slice(0, 600));

  // Try accounts → instagram_business_account
  for (const page of (meData.accounts?.data || [])) {
    const igId = page.instagram_business_account?.id;
    if (igId) return { id: igId, token: conn.access_token };
  }

  // Try instagram_accounts directly
  const igAccounts = meData.instagram_accounts?.data || [];
  if (igAccounts.length > 0) {
    return { id: igAccounts[0].id, token: conn.access_token };
  }

  // Fallback: use stored ig_user_id
  return { id: conn.ig_user_id, token: conn.access_token };
}

// ── GET /api/facebook/competitor?userId=...&username=... ──────
router.get('/competitor', async (req, res) => {
  const { userId, username } = req.query;
  if (!userId || !username) return res.status(400).json({ error: 'missing params' });

  const conn = await getFbConn(userId);
  if (!conn) return res.json({ connected: false });

  try {
    const { id: igUserId, token: accessToken } = await getFbIgUserId(conn);
    console.log('Using igUserId for discovery:', igUserId);

    const mediaFields   = 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink';
    const profileFields = `id,username,biography,followers_count,media_count,profile_picture_url,website,media{${mediaFields}}`;

    const url = new URL(`https://graph.facebook.com/v21.0/${igUserId}`);
    url.searchParams.set('fields',       `business_discovery.fields(${profileFields})`);
    url.searchParams.set('username',     username.replace(/^@/, ''));
    url.searchParams.set('access_token', accessToken);

    const data = await fbFetch(url.toString());
    console.log('Business Discovery response:', JSON.stringify(data).slice(0, 300));

    if (data.error) {
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

export { getFbConn };
export default router;
