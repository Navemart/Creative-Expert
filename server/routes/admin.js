/**
 * /api/admin/students
 * Admin-only endpoint — fetches all Clerk users + joins with Supabase monthly data.
 * Requires: CLERK_SECRET_KEY in .env
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

function isAdmin(req) {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  return adminId && req.headers['x-admin-id'] === adminId;
}

// ── GET /api/admin/students ──────────────────────────────────
// Returns all Clerk users joined with their monthly_submissions summary
router.get('/students', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return res.status(500).json({ error: 'CLERK_SECRET_KEY not configured' });

  try {
    // 1. Fetch all Clerk users
    const clerkRes = await fetch('https://api.clerk.com/v1/users?limit=200&order_by=-created_at', {
      headers: { Authorization: `Bearer ${clerkKey}` },
    });
    if (!clerkRes.ok) return res.status(502).json({ error: 'Clerk API error', status: clerkRes.status });
    const clerkUsers = await clerkRes.json();

    const adminId = process.env.VITE_ADMIN_USER_ID;

    // 2. Fetch monthly submissions + student_profiles from Supabase (service role not needed — admin JWT would work, but here we use anon since this is server-side and we're trusting admin auth)
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    );

    const [
      { data: submissions },
      { data: profiles },
      { data: rankReqs },
      { data: wins },
      { data: deals },
      { data: phases },
      { data: weeks },
      { data: tasks },
      { data: completions },
    ] = await Promise.all([
      supabase.from('monthly_submissions').select('*').order('month'),
      supabase.from('student_profiles').select('user_id, health_status, enrolled_at, total_paid, is_active, member_status, checkin_cadence_days, admin_rank, admin_notes'),
      supabase.from('rank_upgrade_requests').select('*').eq('status', 'pending'),
      supabase.from('sunday_wins').select('*').order('week_date', { ascending: false }),
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
      supabase.from('roadmap_phases').select('id, title, sort_order').order('sort_order'),
      supabase.from('roadmap_weeks').select('id, phase_id, title, sort_order').order('sort_order'),
      supabase.from('roadmap_tasks').select('id, week_id, title, sort_order').order('sort_order'),
      supabase.from('roadmap_completions').select('user_id, task_id'),
    ]);

    // 3. Join data per user
    const students = clerkUsers
      .filter(u => u.id !== adminId) // exclude admin
      .map(u => {
        const email = u.email_addresses?.[0]?.email_address || '';
        const name  = [u.first_name, u.last_name].filter(Boolean).join(' ') || email || u.id;
        const userSubs = (submissions || []).filter(s => s.user_id === u.id).sort((a,b) => a.month.localeCompare(b.month));
        const profile   = (profiles || []).find(p => p.user_id === u.id);
        const rankReq   = (rankReqs || []).find(r => r.user_id === u.id);

        const latest   = userSubs[userSubs.length - 1] ?? null;
        const previous = userSubs[userSubs.length - 2] ?? null;

        const latestIncome   = latest   ? Number(latest.total_income   || latest.amount   || 0) : null;
        const previousIncome = previous ? Number(previous.total_income  || previous.amount || 0) : null;

        // Revenue drop alert: ≥30% drop
        const revenueDrop = latestIncome != null && previousIncome != null && previousIncome > 0
          ? Math.round((previousIncome - latestIncome) / previousIncome * 100)
          : null;
        const hasRevenueDrop = revenueDrop != null && revenueDrop >= 30;

        // Missing report alert: today > 10th of month, no submission for last month
        const now = new Date();
        const lastMonthStr = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
        const hasThisMonth = userSubs.some(s => s.month?.slice(0, 7) === lastMonthStr);
        const missingReport = now.getDate() > 10 && !hasThisMonth && userSubs.length > 0;

        const userWins        = (wins        || []).filter(w => w.user_id === u.id);
        const userDeals       = (deals       || []).filter(d => d.user_id === u.id);
        const userCompletions = (completions || []).filter(c => c.user_id === u.id).map(c => c.task_id);

        return {
          id:            u.id,
          name,
          email,
          image_url:     u.image_url || null,
          created_at:    u.created_at,
          health_status: profile?.health_status || null,
          enrolled_at:   profile?.enrolled_at   || null,
          total_paid:    profile?.total_paid     ?? null,
          is_active:     profile?.is_active      ?? true,
          member_status:        profile?.member_status        || 'active',
          checkin_cadence_days: profile?.checkin_cadence_days ?? 14,
          monthly:       userSubs,
          wins:          userWins,
          deals:         userDeals,
          completions:   userCompletions,
          latest_income: latestIncome,
          latest_rank:   latest?.current_rank || null,
          auto_rank:     calcAutoRank(userSubs),
          admin_rank:    profile?.admin_rank   || null,
          admin_notes:   profile?.admin_notes  || null,
          effective_rank: profile?.admin_rank || calcAutoRank(userSubs),
          latest_month:  latest?.month || null,
          rank_request:  rankReq || null,
          has_revenue_drop: hasRevenueDrop,
          revenue_drop_pct: hasRevenueDrop ? revenueDrop : null,
          missing_report:   missingReport,
          has_data:      userSubs.length > 0,
        };
      });

    // Roadmap structure sent once (not per-student)
    const roadmap = { phases: phases || [], weeks: weeks || [], tasks: tasks || [] };

    res.json({ students, roadmap });
  } catch (err) {
    console.error('[admin/students]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/students/:userId/profile ────────────────
// Update any profile fields: health_status, enrolled_at, total_paid
router.patch('/students/:userId/profile', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { userId } = req.params;

  // On Vercel, req.body may not be parsed yet — read raw body if needed
  let body = req.body;
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      body = raw ? JSON.parse(raw) : {};
    } catch { body = {}; }
  }

  const allowed = ['health_status', 'enrolled_at', 'total_paid', 'member_status', 'checkin_cadence_days', 'admin_rank', 'admin_notes'];
  const updates = {};
  allowed.forEach(k => { if (body[k] !== undefined) updates[k] = body[k]; });
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { error } = await supabase
    .from('student_profiles')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── DELETE /api/admin/deals/:id ──────────────────────────────
router.delete('/deals/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Rank thresholds ──────────────────────────────────────────────
const RANKS = [
  { label: 'TRAINEE',        nextThreshold: 5000  },
  { label: 'CREW',           nextThreshold: 10000 },
  { label: 'SECOND OFFICER', nextThreshold: 15000 },
  { label: 'CO-PILOT',       nextThreshold: 20000 },
  { label: 'CAPTAIN',        nextThreshold: 30000 },
  { label: 'EXPERT',         nextThreshold: Infinity },
];

// Returns the auto-calculated rank based on 2 CONSECUTIVE CALENDAR months both above threshold.
function calcAutoRank(userSubs) {
  if (!userSubs.length) return 'TRAINEE';
  const sorted = [...userSubs].sort((a, b) => (a.month || '').localeCompare(b.month || ''));
  let currentRank = 'TRAINEE';
  for (let i = 1; i < sorted.length; i++) {
    // Months must be exactly 1 calendar month apart
    const pd = new Date(sorted[i - 1].month), cd = new Date(sorted[i].month);
    const gap = (cd.getFullYear() - pd.getFullYear()) * 12 + (cd.getMonth() - pd.getMonth());
    if (gap !== 1) continue;

    const rankIdx = RANKS.findIndex(r => r.label === currentRank);
    if (rankIdx === RANKS.length - 1) break;
    const threshold = RANKS[rankIdx].nextThreshold;
    const prev = Number(sorted[i - 1].total_income || sorted[i - 1].amount || 0);
    const curr = Number(sorted[i].total_income     || sorted[i].amount     || 0);
    if (prev >= threshold && curr >= threshold) {
      currentRank = RANKS[rankIdx + 1].label;
    }
  }
  return currentRank;
}

// Phase-based schedule:
// Days  0-7  → 3 check-ins (every ~2.3 days)
// Days  7-14 → 2 check-ins (every ~3.5 days)
// Days 14-30 → 4 check-ins (every   4 days)
// After 30   → every 7 days
const CHECKIN_PHASES = [
  { start: 0,  end: 7,  count: 3 },
  { start: 7,  end: 14, count: 2 },
  { start: 14, end: 30, count: 4 },
];
const POST_PHASE_CADENCE = 7; // days after day 30

function calcNextDue(enrolledAt, allCheckins) {
  const DAY = 86400000;
  const nowMs = Date.now();

  if (!enrolledAt) {
    // No enrollment date — overdue
    return null;
  }

  const enrollMs = new Date(enrolledAt).getTime();
  const sorted   = [...allCheckins].sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));

  for (const ph of CHECKIN_PHASES) {
    const phStartMs = enrollMs + ph.start * DAY;
    const phEndMs   = enrollMs + ph.end   * DAY;
    if (nowMs < phStartMs) return phStartMs; // Phase hasn't started yet

    const interval    = (ph.end - ph.start) / ph.count * DAY;
    const phCheckins  = sorted.filter(c => {
      const t = new Date(c.checked_at).getTime();
      return t >= phStartMs && t < phEndMs;
    });
    const done = phCheckins.length;

    if (done < ph.count) {
      // Next slot in this phase
      return phStartMs + (done + 1) * interval;
    }
    // Phase complete → continue to next
  }

  // Past all phases → weekly cadence from last check-in
  const lastMs = sorted.length ? new Date(sorted[sorted.length - 1].checked_at).getTime() : null;
  return lastMs ? lastMs + POST_PHASE_CADENCE * DAY : nowMs - DAY; // overdue if never checked in
}

// ── GET /api/admin/checkins ──────────────────────────────────
router.get('/checkins', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return res.status(500).json({ error: 'CLERK_SECRET_KEY not configured' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );

  const [clerkRes, { data: profiles }, { data: checkins }, { data: trafficStatuses }, { data: cadenceRow }] = await Promise.all([
    fetch('https://api.clerk.com/v1/users?limit=200&order_by=-created_at', {
      headers: { Authorization: `Bearer ${clerkKey}` },
    }),
    supabase.from('student_profiles').select('user_id, checkin_cadence_days, member_status, enrolled_at'),
    supabase.from('student_checkins').select('user_id, checked_at').order('checked_at', { ascending: true }),
    supabase.from('traffic_light_status').select('user_id, status'),
    supabase.from('traffic_light_cadence').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (!clerkRes.ok) return res.status(502).json({ error: 'Clerk API error' });
  const clerkUsers = await clerkRes.json();
  const adminId    = process.env.VITE_ADMIN_USER_ID;
  const nowMs      = Date.now();
  const DAY        = 86400000;

  const trafficMap = Object.fromEntries((trafficStatuses || []).map(t => [t.user_id, t.status]));
  const cadence = {
    green:  cadenceRow?.green_days  ?? 14,
    orange: cadenceRow?.orange_days ?? 7,
    red:    cadenceRow?.red_days    ?? 4,
  };

  // Group checkins by user
  const checkinsByUser = {};
  for (const c of checkins || []) {
    (checkinsByUser[c.user_id] = checkinsByUser[c.user_id] || []).push(c);
  }

  // Determine current phase label
  function phaseLabel(enrolledAt) {
    if (!enrolledAt) return 'שוטף';
    const days = (nowMs - new Date(enrolledAt).getTime()) / DAY;
    if (days <= 7)  return 'שבוע 1';
    if (days <= 14) return 'שבוע 2';
    if (days <= 30) return 'חודש ראשון';
    return 'שוטף';
  }

  const students = clerkUsers
    .filter(u => u.id !== adminId)
    .map(u => {
      const email        = u.email_addresses?.[0]?.email_address || '';
      const name         = [u.first_name, u.last_name].filter(Boolean).join(' ') || email || u.id;
      const profile      = (profiles || []).find(p => p.user_id === u.id);
      const status       = profile?.member_status || 'active';
      const enrolledAt   = profile?.enrolled_at   || null;
      const trafficStatus = trafficMap[u.id] || 'green';
      const trafficCadenceDays = cadence[trafficStatus];
      const userCheckins = checkinsByUser[u.id] || [];
      const lastAt       = userCheckins.length ? userCheckins[userCheckins.length - 1].checked_at : null;
      const lastMs       = lastAt ? new Date(lastAt).getTime() : null;
      const daysSince    = lastMs ? Math.floor((nowMs - lastMs) / DAY) : null;

      // Column logic based on traffic light cadence
      let column;
      const recentMs = trafficCadenceDays * DAY;
      if (lastMs && (nowMs - lastMs) < recentMs)      column = 'done';
      else if (lastMs && (nowMs - lastMs) < recentMs * 1.5) column = 'upcoming';
      else                                             column = 'overdue';

      const nextDueMs = lastMs ? lastMs + recentMs : null;

      return {
        id: u.id, name, email, image_url: u.image_url || null,
        status, enrolled_at: enrolledAt,
        last_checkin: lastAt, days_since: daysSince,
        next_due: nextDueMs ? new Date(nextDueMs).toISOString() : null,
        phase: phaseLabel(enrolledAt),
        checkin_count: userCheckins.length,
        checkin_cadence_days: trafficCadenceDays,
        traffic_status: trafficStatus,
        column,
      };
    })
    .filter(s => s.status === 'active');

  res.json({ students, cadence });
});

// ── GET /api/admin/traffic-cadence ──────────────────────────────
router.get('/traffic-cadence', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { data } = await supabase.from('traffic_light_cadence').select('*').eq('id', 1).maybeSingle();
  res.json({ green_days: data?.green_days ?? 14, orange_days: data?.orange_days ?? 7, red_days: data?.red_days ?? 4 });
});

// ── PUT /api/admin/traffic-cadence ──────────────────────────────
router.put('/traffic-cadence', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { green_days, orange_days, red_days } = req.body;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { error } = await supabase.from('traffic_light_cadence').upsert(
    { id: 1, green_days: Number(green_days), orange_days: Number(orange_days), red_days: Number(red_days), updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── POST /api/admin/checkins ─────────────────────────────────
router.post('/checkins', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  let body = req.body;
  if (!body || !body.user_id) {
    try {
      const raw = await new Promise((resolve, reject) => {
        let d = ''; req.on('data', c => { d += c; }); req.on('end', () => resolve(d)); req.on('error', reject);
      });
      body = raw ? JSON.parse(raw) : {};
    } catch { body = {}; }
  }

  const { user_id, notes, focus, bottleneck, checked_date } = body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { error } = await supabase.from('student_checkins').insert({
    user_id,
    notes: notes || null,
    focus: focus || null,
    bottleneck: bottleneck || null,
    checked_date: checked_date || null,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── GET /api/admin/checkins/:userId/history ──────────────────
router.get('/checkins/:userId/history', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { userId } = req.params;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { data, error } = await supabase
    .from('student_checkins')
    .select('id, checked_at, checked_date, focus, bottleneck, notes')
    .eq('user_id', userId)
    .order('checked_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ history: data || [] });
});

// ── GET /api/admin/rank-upgrades ────────────────────────────────
router.get('/rank-upgrades', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const clerkKey = process.env.CLERK_SECRET_KEY;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { data: requests, error } = await supabase
    .from('rank_upgrade_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Enrich with Clerk photo
  let clerkUsers = [];
  try {
    const r = await fetch('https://api.clerk.com/v1/users?limit=200', { headers: { Authorization: `Bearer ${clerkKey}` } });
    clerkUsers = r.ok ? await r.json() : [];
  } catch {}
  const photoMap = {};
  clerkUsers.forEach(u => { photoMap[u.id] = u.image_url || null; });

  const enriched = (requests || []).map(r => ({ ...r, image_url: photoMap[r.user_id] || null }));
  res.json({ requests: enriched });
});

// ── POST /api/admin/rank-upgrades/:id/approve ────────────────────
router.post('/rank-upgrades/:id/approve', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { data: req_, error: fetchErr } = await supabase
    .from('rank_upgrade_requests').select('user_id, proposed_rank').eq('id', id).single();
  if (fetchErr) return res.status(404).json({ error: 'Not found' });

  const [{ error: profileErr }, { error: reqErr }] = await Promise.all([
    supabase.from('student_profiles').upsert({ user_id: req_.user_id, admin_rank: req_.proposed_rank }, { onConflict: 'user_id' }),
    supabase.from('rank_upgrade_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id),
  ]);
  if (profileErr || reqErr) return res.status(500).json({ error: (profileErr || reqErr).message });
  res.json({ ok: true });
});

// ── POST /api/admin/rank-upgrades/:id/reject ─────────────────────
router.post('/rank-upgrades/:id/reject', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const { error } = await supabase
    .from('rank_upgrade_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── GET /api/admin/slack-failures ───────────────────────────────
// Returns deals and wins where Slack posting failed — shown in admin bell.
router.get('/slack-failures', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  const since = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
  const [{ data: deals }, { data: wins }] = await Promise.all([
    supabase.from('deals').select('id, user_name, total_amount, created_at, slack_failed_at')
      .is('slack_posted_at', null).not('slack_failed_at', 'is', null).gte('slack_failed_at', since),
    supabase.from('sunday_wins').select('id, user_name, win_1, week_date, slack_failed_at')
      .is('slack_posted_at', null).not('slack_failed_at', 'is', null).gte('slack_failed_at', since),
  ]);
  res.json({
    deals: (deals || []).map(d => ({ ...d, type: 'deal' })),
    wins:  (wins  || []).map(w => ({ ...w, type: 'win'  })),
  });
});

// keep old route for backward compat
router.patch('/students/:userId/health', async (req, res) => {
  req.url = req.url.replace('/health', '/profile');
  router.handle({ ...req, url: `/students/${req.params.userId}/profile` }, res, () => {});
});

export default router;
