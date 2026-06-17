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
      supabase.from('student_profiles').select('user_id, health_status, enrolled_at, total_paid, is_active'),
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
          monthly:       userSubs,
          wins:          userWins,
          deals:         userDeals,
          completions:   userCompletions,
          latest_income: latestIncome,
          latest_rank:   latest?.current_rank || null,
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
  const allowed = ['health_status', 'enrolled_at', 'total_paid'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
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

// keep old route for backward compat
router.patch('/students/:userId/health', async (req, res) => {
  req.url = req.url.replace('/health', '/profile');
  router.handle({ ...req, url: `/students/${req.params.userId}/profile` }, res, () => {});
});

export default router;
