import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

function supabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
}

// GET /api/traffic-lights
router.get('/', async (req, res) => {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return res.status(500).json({ error: 'CLERK_SECRET_KEY not configured' });

  const ADMIN_ID = process.env.VITE_ADMIN_USER_ID;
  const db = supabase();

  // 1. Fetch Clerk users
  const clerkRes = await fetch('https://api.clerk.com/v1/users?limit=200&order_by=-created_at', {
    headers: { Authorization: `Bearer ${clerkKey}` },
  });
  if (!clerkRes.ok) return res.status(502).json({ error: 'Clerk API error' });
  const clerkUsers = await clerkRes.json();

  // 2. Parallel Supabase data
  const [
    { data: statuses },
    { data: deals },
    { data: monthly },
    { data: studentProfiles },
    { data: instagramProfiles },
  ] = await Promise.all([
    db.from('traffic_light_status').select('*'),
    db.from('deals').select('user_id, total_amount'),
    db.from('monthly_submissions').select('user_id, total_income, report_month').order('report_month', { ascending: false }),
    db.from('student_profiles').select('user_id, admin_rank'),
    db.from('instagram_profiles').select('user_id, full_name, profile_pic'),
  ]);

  const statusMap  = Object.fromEntries((statuses  || []).map(s => [s.user_id, s]));
  const spMap      = Object.fromEntries((studentProfiles  || []).map(s => [s.user_id, s]));
  const igMap      = Object.fromEntries((instagramProfiles || []).map(s => [s.user_id, s]));

  // last monthly income per user
  const lastMonthly = {};
  for (const m of (monthly || [])) {
    if (!lastMonthly[m.user_id]) lastMonthly[m.user_id] = m;
  }

  // deals per user
  const dealsMap = {};
  for (const d of (deals || [])) {
    if (!dealsMap[d.user_id]) dealsMap[d.user_id] = { count: 0, total: 0 };
    dealsMap[d.user_id].count++;
    dealsMap[d.user_id].total += Number(d.total_amount) || 0;
  }

  const result = clerkUsers
    .filter(u => u.id !== ADMIN_ID)
    .map(u => {
      const ig   = igMap[u.id];
      const sp   = spMap[u.id];
      const name = ig?.full_name
        || [u.first_name, u.last_name].filter(Boolean).join(' ')
        || u.email_addresses?.[0]?.email_address
        || u.id;
      const photo = u.image_url || ig?.profile_pic || null;

      return {
        user_id:           u.id,
        full_name:         name,
        profile_image_url: photo,
        rank:              sp?.admin_rank || 'TRAINEE',
        status:            statusMap[u.id]?.status || 'green',
        updated_at:        statusMap[u.id]?.updated_at || null,
        last_monthly:      lastMonthly[u.id]?.total_income || 0,
        last_month_date:   lastMonthly[u.id]?.report_month || null,
        deals_count:       dealsMap[u.id]?.count  || 0,
        deals_total:       dealsMap[u.id]?.total  || 0,
      };
    });

  res.json(result);
});

// PUT /api/traffic-lights/:userId
router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { status }  = req.body;
  if (!['green','orange','red'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const { error } = await supabase().from('traffic_light_status').upsert({
    user_id: userId, status, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
