import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

function sb() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
}

// Fetch all Clerk users and return a map: { userId → { name, email, photo } }
async function getClerkUsersMap() {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return {};
  try {
    const res = await fetch('https://api.clerk.com/v1/users?limit=500&order_by=-created_at', {
      headers: { Authorization: `Bearer ${clerkKey}` },
    });
    const users = await res.json();
    const map = {};
    for (const u of Array.isArray(users) ? users : []) {
      const name  = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '—';
      const email = u.email_addresses?.[0]?.email_address || '—';
      const photo = u.image_url || null;
      map[u.id] = { name, email, photo };
    }
    return map;
  } catch {
    return {};
  }
}

// POST /api/events — save a user event
router.post('/', async (req, res) => {
  const { clerk_user_id, event, page, metadata, session_id } = req.body;
  if (!event) return res.status(400).json({ error: 'event required' });

  // Don't track admin actions
  if (clerk_user_id && clerk_user_id === process.env.VITE_ADMIN_USER_ID) {
    return res.json({ ok: true });
  }

  const { error } = await sb().from('user_events').insert({
    clerk_user_id: clerk_user_id || null,
    event,
    page:       page       || null,
    metadata:   metadata   || null,
    session_id: session_id || null,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// GET /api/events — admin: list events with filters + Clerk user info
router.get('/', async (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { user, event: eventFilter, page: pageFilter, from, to, limit = 200 } = req.query;

  let q = sb()
    .from('user_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (user)        q = q.eq('clerk_user_id', user);
  if (eventFilter) q = q.eq('event', eventFilter);
  if (pageFilter)  q = q.eq('page', pageFilter);
  if (from)        q = q.gte('created_at', from);
  if (to)          q = q.lte('created_at', to);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const usersMap = await getClerkUsersMap();
  const events = (data || []).map(ev => ({
    ...ev,
    user_info: ev.clerk_user_id ? (usersMap[ev.clerk_user_id] || null) : null,
  }));

  res.json({ events, users: usersMap });
});

// GET /api/events/stats — counts per event type + per page
router.get('/stats', async (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = sb();

  const [byEvent, byPage, byUser, daily] = await Promise.all([
    db.from('user_events').select('event').neq('ignore_on', true),
    db.from('user_events').select('page').eq('event', 'page_view').neq('ignore_on', true),
    db.from('user_events').select('clerk_user_id').neq('ignore_on', true).neq('clerk_user_id', null),
    db.from('user_events').select('created_at').eq('event', 'page_view').neq('ignore_on', true)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString()),
  ]);

  // Count by event
  const eventCounts = {};
  for (const r of byEvent.data || []) {
    eventCounts[r.event] = (eventCounts[r.event] || 0) + 1;
  }

  // Count by page
  const pageCounts = {};
  for (const r of byPage.data || []) {
    if (r.page) pageCounts[r.page] = (pageCounts[r.page] || 0) + 1;
  }

  // Unique users
  const uniqueUsers = new Set((byUser.data || []).map(r => r.clerk_user_id)).size;

  // Daily page views (last 30 days)
  const dailyCounts = {};
  for (const r of daily.data || []) {
    const day = r.created_at.slice(0, 10);
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  }

  res.json({
    byEvent: Object.entries(eventCounts).sort((a, b) => b[1] - a[1]),
    byPage:  Object.entries(pageCounts).sort((a, b) => b[1] - a[1]),
    uniqueUsers,
    daily:   Object.entries(dailyCounts).sort((a, b) => a[0].localeCompare(b[0])),
  });
});

// PATCH /api/events/:id/ignore — toggle ignore_on
router.patch('/:id/ignore', async (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { id } = req.params;
  const { ignore_on } = req.body;
  const { error } = await sb().from('user_events').update({ ignore_on }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
