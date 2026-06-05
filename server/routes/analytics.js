/**
 * Analytics / Monthly-reports API
 *
 * Supabase table (run once):
 * ─────────────────────────────────────────────────────────────
 *  create table monthly_reports (
 *    id               uuid primary key default gen_random_uuid(),
 *    user_id          text not null,
 *    month            text not null,          -- 'YYYY-MM'
 *    revenue          numeric default 0,
 *    active_clients   int     default 0,
 *    new_clients      int     default 0,
 *    proposals_sent   int     default 0,
 *    deals_closed     int     default 0,
 *    posts_published  int     default 0,
 *    notes            text,
 *    created_at       timestamptz default now(),
 *    unique(user_id, month)
 *  );
 *  alter table monthly_reports enable row level security;
 *  create policy "open" on monthly_reports
 *    for all using (true) with check (true);
 * ─────────────────────────────────────────────────────────────
 */

import { Router }       from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  : null;

// GET /api/analytics?userId=
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId)   return res.status(400).json({ error: 'חסר userId' });
  if (!supabase) return res.json({ data: [] });

  const { data, error } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(24);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});

// POST /api/analytics — upsert (insert or update) a monthly report
router.post('/', async (req, res) => {
  const { userId, ...fields } = req.body;
  if (!userId || !fields.month)
    return res.status(400).json({ error: 'חסר userId ו-month' });
  if (!supabase)
    return res.status(500).json({ error: 'Supabase לא מוגדר' });

  const payload = {
    user_id:         userId,
    month:           fields.month,
    revenue:         Number(fields.revenue)        || 0,
    active_clients:  Number(fields.active_clients) || 0,
    new_clients:     Number(fields.new_clients)    || 0,
    proposals_sent:  Number(fields.proposals_sent) || 0,
    deals_closed:    Number(fields.deals_closed)   || 0,
    posts_published: Number(fields.posts_published)|| 0,
    notes:           fields.notes || null,
  };

  const { data, error } = await supabase
    .from('monthly_reports')
    .upsert(payload, { onConflict: 'user_id,month' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

export default router;
