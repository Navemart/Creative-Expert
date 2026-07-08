import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

const APIFY_TOKEN        = process.env.APIFY_TOKEN;
const PROFILE_ACTOR_ID   = 'apify~instagram-profile-scraper';
const POST_ACTOR_ID      = 'apify~instagram-post-scraper';
const APIFY_BASE         = 'https://api.apify.com/v2';

async function runActor(actorId, input, timeout = 120) {
  const controller = new AbortController();
  // Kill the fetch if Apify doesn't respond within timeout + 15s grace
  const timer = setTimeout(() => controller.abort(), (timeout + 15) * 1000);
  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${timeout}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: controller.signal },
    );
    if (!res.ok) throw new Error(`Apify ${actorId} error: ${res.status} ${await res.text()}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeInstagramProfile(username) {
  const items = await runActor(PROFILE_ACTOR_ID, { usernames: [username] }, 90);
  if (!items?.length) throw new Error('לא נמצא פרופיל עם שם זה');
  return items[0];
}

async function scrapeInstagramPosts(username, limit = 30) {
  try {
    const input = { username: [username] };
    if (limit) input.resultsLimit = limit;
    const items = await runActor(POST_ACTOR_ID, input, limit > 100 ? 300 : 120);
    console.log(`[post-scraper] got ${items?.length ?? 0} posts for ${username} (limit=${limit ?? 'all'})`);
    return Array.isArray(items) ? items : [];
  } catch(e) {
    console.warn('[instagram-post-scraper] fallback to profile posts:', e.message);
    return null;
  }
}

// ── Normalize posts — works for both Profile Scraper and Post Scraper ──
function normalizePosts(rawPosts = []) {
  return rawPosts.map(p => ({
    id:         p.id || p.shortCode,
    type:       p.type || (p.videoUrl ? 'Video' : 'Image'),
    shortCode:  p.shortCode,
    url:        p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
    displayUrl: p.displayUrl || p.thumbnailUrl || null,
    caption:    p.caption || p.alt || '',
    likes:      p.likesCount    || p.likes    || 0,
    comments:   p.commentsCount || p.comments || 0,
    views:      p.videoViewCount || p.videoPlayCount || null,
    timestamp:  p.timestamp,
  }));
}

// ── Helper: compute stats from normalized posts ──────────────────
function computePostStats(posts) {
  const videoPosts = posts.filter(p => p.views != null && p.views > 0);
  const avgViews = videoPosts.length
    ? Math.round(videoPosts.reduce((s, p) => s + p.views, 0) / videoPosts.length) : 0;
  const avgEng = posts.length
    ? parseFloat((posts.reduce((s, p) => {
        const denom = p.views || p.likes || 1;
        return s + (p.likes + p.comments) / denom * 100;
      }, 0) / posts.length).toFixed(2)) : 0;
  return { avgViews, avgEng };
}

// ── GET /api/instagram-apify/proxy-image?url=xxx ────────────────
router.get('/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
      },
    });
    if (!r.ok) return res.status(r.status).end();
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch(e) {
    res.status(500).end();
  }
});

// ── GET /api/instagram-apify/profile?userId=xxx ──────────────────
router.get('/profile', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'missing userId' });

  const { data, error } = await supabase
    .from('instagram_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || null);
});

// ── POST /api/instagram-apify/connect ────────────────────────────
// body: { userId, username }
router.post('/connect', async (req, res) => {
  const { userId, username } = req.body;
  if (!userId || !username) return res.status(400).json({ error: 'missing fields' });

  try {
    const cleanUsername = username.replace('@', '');
    // connect: full scrape — profile + all posts (no limit)
    const [raw, rawPosts] = await Promise.all([
      scrapeInstagramProfile(cleanUsername),
      scrapeInstagramPosts(cleanUsername, null),
    ]);
    const now = new Date().toISOString();

    const postSource = rawPosts?.length ? rawPosts : (raw.latestPosts || []);
    const posts = normalizePosts(postSource);
    const { avgViews, avgEng } = computePostStats(posts);

    const row = {
      user_id:     userId,
      username:    raw.username || cleanUsername,
      full_name:   raw.fullName || null,
      bio:         raw.biography || null,
      followers:   raw.followersCount || 0,
      following:   raw.followsCount   || 0,
      posts_count: raw.postsCount     || 0,
      profile_pic: raw.profilePicUrl  || null,
      is_verified: raw.verified       || false,
      is_business: raw.isBusinessAccount || false,
      posts,
      scraped_at:  now,
    };

    const { error: upsertErr } = await supabase
      .from('instagram_profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (upsertErr) throw new Error(upsertErr.message);

    await supabase.from('instagram_history').insert({
      user_id: userId, followers: row.followers,
      following: row.following, posts_count: row.posts_count,
      avg_views: avgViews, avg_engagement: avgEng,
      recorded_at: now,
    });

    res.json({ ok: true, profile: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/instagram-apify/refresh ────────────────────────────
// body: { userId }
router.post('/refresh', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'missing userId' });

  const { data: existing } = await supabase
    .from('instagram_profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing?.username) return res.status(404).json({ error: 'no profile connected' });

  try {
    const [raw, rawPostsFromScraper] = await Promise.all([
      scrapeInstagramProfile(existing.username),
      scrapeInstagramPosts(existing.username, 30),
    ]);
    const now = new Date().toISOString();

    const postSource = rawPostsFromScraper?.length ? rawPostsFromScraper : (raw.latestPosts || []);
    const posts = normalizePosts(postSource);
    const { avgViews, avgEng } = computePostStats(posts);

    const row = {
      user_id:     userId,
      username:    raw.username || existing.username,
      full_name:   raw.fullName || null,
      bio:         raw.biography || null,
      followers:   raw.followersCount || 0,
      following:   raw.followsCount   || 0,
      posts_count: raw.postsCount     || 0,
      profile_pic: raw.profilePicUrl  || null,
      is_verified: raw.verified       || false,
      is_business: raw.isBusinessAccount || false,
      posts,
      scraped_at:  now,
    };

    await supabase.from('instagram_profiles').upsert(row, { onConflict: 'user_id' });
    await supabase.from('instagram_history').insert({
      user_id: userId, followers: row.followers,
      following: row.following, posts_count: row.posts_count,
      avg_views: avgViews, avg_engagement: avgEng,
      recorded_at: now,
    });
    res.json({ ok: true, profile: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/instagram-apify/history?userId=xxx ──────────────────
router.get('/history', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  const { data } = await supabase
    .from('instagram_history')
    .select('followers, avg_views, avg_engagement, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true });
  res.json(data || []);
});

// ── DELETE /api/instagram-apify/disconnect ───────────────────────
router.delete('/disconnect', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  await supabase.from('instagram_profiles').delete().eq('user_id', userId);
  res.json({ ok: true });
});

export default router;

// ── Daily auto-refresh — called by cron in server/index.js ────
// Runs all profiles IN PARALLEL (not sequentially) so the total wall time
// stays under Vercel's function timeout regardless of how many students
// are connected — a sequential loop would multiply each profile's scrape
// time and blow past the limit once there are more than 1-2 profiles.
async function refreshOneProfile(user_id, username) {
  const [raw, rawPosts] = await Promise.all([
    scrapeInstagramProfile(username),
    scrapeInstagramPosts(username),
  ]);
  const now = new Date().toISOString();
  const postSource = rawPosts?.length ? rawPosts : (raw.latestPosts || []);
  const posts = normalizePosts(postSource);
  const { avgViews, avgEng } = computePostStats(posts);

  const row = {
    user_id,
    username:    raw.username    || username,
    full_name:   raw.fullName    || null,
    bio:         raw.biography   || null,
    followers:   raw.followersCount || 0,
    following:   raw.followsCount   || 0,
    posts_count: raw.postsCount     || 0,
    profile_pic: raw.profilePicUrl  || null,
    is_verified: raw.verified       || false,
    is_business: raw.isBusinessAccount || false,
    posts,
    scraped_at: now,
  };

  await supabase.from('instagram_profiles').upsert(row, { onConflict: 'user_id' });
  await supabase.from('instagram_history').insert({
    user_id, followers: row.followers, following: row.following,
    posts_count: row.posts_count, avg_views: avgViews,
    avg_engagement: avgEng, recorded_at: now,
  });
}

export async function dailyRefreshAll() {
  const { data: profiles } = await supabase
    .from('instagram_profiles')
    .select('user_id, username');

  if (!profiles?.length) return 0;

  const results = await Promise.allSettled(
    profiles.map(({ user_id, username }) => refreshOneProfile(user_id, username))
  );

  let count = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') count++;
    else console.error(`[dailyRefresh] failed for ${profiles[i].username}:`, r.reason?.message);
  });
  return count;
}
